import { query, transaction } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class SrnService {
  async generateNumber(client = null, circleId = null, clusterId = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run('SELECT generate_srn_number($1,$2) AS srn_number', [circleId, clusterId]);
    return rows[0]?.srn_number;
  }

  async create(payload, userId) {
    return transaction(async (client) => {
      // Resolve circle/cluster primarily from the reference challan (issue), otherwise from destination warehouse
      let circleId = null;
      let clusterId = null;
      if (payload.reference_challan_id) {
        const ref = await client.query('SELECT circle_id, cluster_id FROM inventory_issues WHERE id = $1', [payload.reference_challan_id]);
        if (ref.rows.length) {
          circleId = ref.rows[0].circle_id || null;
          clusterId = ref.rows[0].cluster_id || null;
        }
      }
      if ((!circleId || !clusterId) && payload.destination_warehouse_id) {
        const r = await client.query('SELECT circle_id, cluster_id FROM warehouses WHERE id = $1', [payload.destination_warehouse_id]);
        if (r.rows.length) {
          circleId = circleId || r.rows[0].circle_id || null;
          clusterId = clusterId || r.rows[0].cluster_id || null;
        }
      }
      const srnNumber = await this.generateNumber(client, circleId, clusterId);
      const { rows: ins } = await client.query(`
        INSERT INTO store_return_notes (
          srn_number, reference_challan_id, source_type, source_id,
          destination_warehouse_id, return_reason, eway_bill_number, eway_bill_date,
          vehicle_number, driver_name, driver_phone,
          status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',$12) RETURNING *
      `, [
        srnNumber, payload.reference_challan_id || null, payload.source_type || null, payload.source_id || null,
        payload.destination_warehouse_id || null, payload.return_reason || null,
        payload.eway_bill_number || null, payload.eway_bill_date || null,
        payload.vehicle_number || null, payload.driver_name || null, payload.driver_phone || null,
        userId
      ]);
      const srn = ins[0];
      if (Array.isArray(payload.items)) {
        for (let i = 0; i < payload.items.length; i++) {
          const it = payload.items[i];
          await client.query(`
            INSERT INTO store_return_items (
              srn_id, challan_line_id, item_id,
              quantity_returned, quantity_accepted, quantity_rejected, condition, remarks
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [
            srn.id, it.challan_line_id || null, it.item_id || null,
            Number(it.quantity_returned || 0), Number(it.quantity_accepted || 0), Number(it.quantity_rejected || 0),
            it.condition || null, it.remarks || null
          ]);
        }
      }
      await domainEventService.publishEvent('INVENTORY.SRN.CREATED', srn.id.toString(), 'store_return_note', { srn_id: srn.id });
      return srn;
    });
  }

  async post(srnId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT * FROM store_return_notes WHERE id = $1 AND status IN ('draft', 'approved') FOR UPDATE", [srnId]);
      if (rows.length === 0) throw new Error('SRN not found or cannot be posted (must be draft or approved)');
      const srn = rows[0];
      const { rows: items } = await client.query('SELECT * FROM store_return_items WHERE srn_id = $1', [srnId]);
      if (items.length === 0) throw new Error('No items to receive');

      let consignmentTotalValue = 0;
      for (const it of items) {
        const qty = Number(it.quantity_accepted || it.quantity_returned || 0);
        if (qty <= 0) continue;
        const { rows: clRows } = await client.query('SELECT il.*, i.warehouse_id, i.bin_id FROM inventory_issue_lines il JOIN inventory_issues i ON i.id = il.issue_id WHERE il.id = $1', [it.challan_line_id]);
        const ctx = clRows[0] || {};
        const destWh = srn.destination_warehouse_id || ctx.warehouse_id || null;
        // Route to QUARANTINE bin for defective/damaged returns; otherwise use source bin or null
        const isFaulty = String(it.condition || '').toUpperCase() === 'DAMAGED' || String(it.condition || '').toUpperCase() === 'DEFECTIVE';
        let destBin = ctx.bin_id || null;
        if (isFaulty && destWh) {
          const { rows: qb } = await client.query('SELECT id FROM bins WHERE warehouse_id = $1 AND bin_type = $2 LIMIT 1', [destWh, 'QUARANTINE']);
          destBin = qb[0]?.id || null;
        }
        // Policy: Receive returns at current moving average of destination warehouse
        const avgRes = await client.query(`
          SELECT CASE WHEN COALESCE(SUM(il.quantity),0) = 0 THEN 0::numeric
                      ELSE COALESCE(SUM(il.total_cost),0)::numeric / NULLIF(COALESCE(SUM(il.quantity),0)::numeric,0) END AS avg_cost
          FROM inventory_layers il
          WHERE il.item_id = $1 AND il.warehouse_id = $2
        `, [it.item_id, destWh]);
        const unitCost = Number(avgRes.rows[0]?.avg_cost || 0);
        const totalCost = unitCost * qty;
        consignmentTotalValue += totalCost;
        await client.query(`
          INSERT INTO inventory_transactions (item_id, warehouse_id, bin_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id)
          VALUES ($1,$2,$3,'SRN_RECEIPT',$4,$5,$6,'SRN',$7)
        `, [it.item_id, destWh, destBin, qty, unitCost, totalCost, it.id]);
        await client.query(`
          INSERT INTO inventory_layers (item_id, warehouse_id, bin_id, quantity, unit_cost, total_cost, source_type, source_id)
          VALUES ($1,$2,$3,$4,$5,$6,'SRN',$7)
        `, [it.item_id, destWh, destBin, qty, unitCost, totalCost, it.id]);
        await client.query('UPDATE inventory_issue_lines SET quantity_returned = COALESCE(quantity_returned,0) + $1 WHERE id = $2', [qty, it.challan_line_id]);
      }

      // Enforce E-Way Bill for consignments >= 50000
      if (consignmentTotalValue >= 50000) {
        const ewbNumber = (srn.eway_bill_number || '').toString().trim();
        const ewbDate = srn.eway_bill_date;
        if (!ewbNumber || !ewbDate) {
          throw new Error('E-Way Bill number and date are required for SRNs with consignment value >= 50,000');
        }
      }

      const { rows: upd } = await client.query("UPDATE store_return_notes SET status = 'posted', received_at = NOW(), received_by = $1 WHERE id = $2 RETURNING *", [userId, srnId]);
      const posted = upd[0];
      
      // Recompute return completion is reflected dynamically via aggregates in list/getById.
      // No need to persist a return_status column on inventory_issues.
      await domainEventService.publishEvent('INVENTORY.SRN.POSTED', srnId.toString(), 'store_return_note', { srn_id: srnId }, { posted_by: userId });
      return posted;
    });
  }

  async getById(id) {
    const { rows } = await query(`
      SELECT 
        srn.*,
        i.challan_number AS reference_challan_number,
        i.destination_type AS reference_destination_type,
        i.site_id AS reference_site_id,
        i.site_name AS reference_site_name,
        i.circle_id AS reference_circle_id,
        i.cluster_id AS reference_cluster_id,
        tc.name AS reference_circle_name,
        cl.name AS reference_cluster_name,
        COALESCE(tc.code, tc.name) AS reference_circle_code,
        COALESCE(cl.code, cl.name) AS reference_cluster_code,
        s.id AS reference_vendor_id,
        s.supplier_code AS reference_vendor_code,
        s.name AS reference_vendor_name,
        s.contact_person AS reference_vendor_contact_person,
        s.phone AS reference_vendor_phone,
        i.eway_bill_number AS reference_eway_bill_number,
        i.eway_bill_date AS reference_eway_bill_date,
        i.origin_gst_number AS reference_origin_gst_number,
        i.destination_gst_number AS reference_destination_gst_number,
        w.name AS destination_warehouse_name,
        CONCAT_WS(', ', w.address_line1, w.address_line2, w.city, w.state, w.postal_code, w.country) AS destination_warehouse_address,
        COALESCE(json_agg(json_build_object(
          'id', srit.id,
          'challan_line_id', srit.challan_line_id,
          'item_id', srit.item_id,
          'item_name', itm.name,
          'item_code', itm.item_code,
          'item_description', itm.description,
          'manufacturer', itm.manufacturer,
          'quantity_returned', srit.quantity_returned,
          'quantity_accepted', srit.quantity_accepted,
          'quantity_rejected', srit.quantity_rejected,
          'condition', srit.condition,
          'remarks', srit.remarks,
          'unit_of_measure', itm.unit_of_measure
        ) ORDER BY srit.id) FILTER (WHERE srit.id IS NOT NULL), '[]') AS items
      FROM store_return_notes srn
      LEFT JOIN store_return_items srit ON srit.srn_id = srn.id
      LEFT JOIN items itm ON itm.id = srit.item_id
      LEFT JOIN inventory_issues i ON i.id = srn.reference_challan_id
      LEFT JOIN suppliers s ON s.id = i.vendor_id
      LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
      LEFT JOIN clusters cl ON cl.id = i.cluster_id
      LEFT JOIN warehouses w ON w.id = srn.destination_warehouse_id
      WHERE srn.id = $1
      GROUP BY srn.id, i.challan_number, i.destination_type, i.site_id, i.site_name, i.circle_id, i.cluster_id, tc.name, cl.name, tc.code, cl.code,
               s.id, s.supplier_code, s.name, s.contact_person, s.phone,
               i.eway_bill_number, i.eway_bill_date, i.origin_gst_number, i.destination_gst_number,
               w.name, w.address_line1, w.address_line2, w.city, w.state, w.postal_code, w.country
    `, [id]);
    if (rows.length === 0) throw new Error('SRN not found');
    return rows[0];
  }

  async list({ page = 1, limit = 10, status, search, circle_id, cluster_id } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const { whereClause, params, limitParam, offsetParam } = this.#buildListFilterClauses({ status, search, circle_id, cluster_id, limit, offset });
    const sql = `
      SELECT srn.id, srn.srn_number, srn.status, srn.created_at,
             i.challan_number as reference_challan_number,
             COALESCE(tc.code, tc.name) AS reference_circle_code,
             COALESCE(cl.code, cl.name) AS reference_cluster_code,
             COUNT(sri.id)::int as item_count
      FROM store_return_notes srn
      LEFT JOIN store_return_items sri ON sri.srn_id = srn.id
      LEFT JOIN inventory_issues i ON i.id = srn.reference_challan_id
      LEFT JOIN sites s ON s.id = i.site_id
      LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
      LEFT JOIN clusters cl ON cl.id = i.cluster_id
      ${whereClause}
      GROUP BY srn.id, i.challan_number, tc.name, cl.name, tc.code, cl.code
      ORDER BY srn.created_at DESC 
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;
    
    const { rows } = await query(sql, params);
    
    // Count query with same filters
    const countSql = `
      SELECT COUNT(DISTINCT srn.id)::int AS total 
      FROM store_return_notes srn
      LEFT JOIN inventory_issues i ON i.id = srn.reference_challan_id
      LEFT JOIN sites s ON s.id = i.site_id
      ${whereClause}
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const { rows: c } = await query(countSql, countParams);

    return {
      items: rows.map(r => ({
        ...r,
        lines: Array(r.item_count).fill({}) // Mock lines array for count
      })),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: c[0].total,
        totalPages: Math.ceil(c[0].total / Number(limit))
      }
    };
  }

  async export({ status, search, circle_id, cluster_id } = {}) {
    const { whereClause, params } = this.#buildListFilterClauses({ status, search, circle_id, cluster_id });
    const limit = 5000;
    const sql = `
      SELECT srn.id, srn.srn_number, srn.status, srn.created_at,
             i.challan_number as reference_challan_number,
             COALESCE(tc.code, tc.name) AS reference_circle_code,
             COALESCE(cl.code, cl.name) AS reference_cluster_code,
             COUNT(sri.id)::int as item_count
      FROM store_return_notes srn
      LEFT JOIN store_return_items sri ON sri.srn_id = srn.id
      LEFT JOIN inventory_issues i ON i.id = srn.reference_challan_id
      LEFT JOIN sites s ON s.id = i.site_id
      LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
      LEFT JOIN clusters cl ON cl.id = i.cluster_id
      ${whereClause}
      GROUP BY srn.id, i.challan_number, tc.name, cl.name, tc.code, cl.code
      ORDER BY srn.created_at DESC 
      LIMIT ${limit}
    `;
    const { rows } = await query(sql, params);
    return rows;
  }

  #buildListFilterClauses({ status, search, circle_id, cluster_id, limit, offset } = {}) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`srn.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(srn.srn_number ILIKE $${paramIndex} OR i.challan_number ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (circle_id) {
      conditions.push(`s.circle_id = $${paramIndex}`);
      params.push(Number(circle_id));
      paramIndex++;
    }

    if (cluster_id) {
      conditions.push(`s.cluster_id = $${paramIndex}`);
      params.push(Number(cluster_id));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (typeof limit === 'undefined' || typeof offset === 'undefined') {
      return { whereClause, params };
    }

    const limitParam = `$${paramIndex}`;
    const offsetParam = `$${paramIndex + 1}`;
    params.push(limit, offset);

    return { whereClause, params, limitParam, offsetParam };
  }

  async update(srnId, payload, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT status FROM store_return_notes WHERE id = $1 FOR UPDATE", [srnId]);
      if (rows.length === 0) throw new Error('SRN not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft SRNs can be updated');

      // Build updates as tuples so we can retry without updated_* columns if missing
      const updates = [];
      const add = (col, val) => { updates.push([col, val]); };
      if (payload.reference_challan_id != null) add('reference_challan_id', Number(payload.reference_challan_id));
      if (payload.destination_warehouse_id != null) add('destination_warehouse_id', Number(payload.destination_warehouse_id));
      if (payload.return_reason != null) add('return_reason', payload.return_reason);
      if (payload.eway_bill_number != null) add('eway_bill_number', payload.eway_bill_number);
      if (payload.eway_bill_date != null) add('eway_bill_date', payload.eway_bill_date);
      if (payload.vehicle_number != null) add('vehicle_number', payload.vehicle_number);
      if (payload.driver_name != null) add('driver_name', payload.driver_name);
      if (payload.driver_phone != null) add('driver_phone', payload.driver_phone);
      add('updated_at', new Date());
      add('updated_by', userId);

      const runUpdate = async (pairs) => {
        if (!pairs.length) return;
        const fields = [];
        const params = [];
        let i = 1;
        for (const [col, val] of pairs) { fields.push(`${col} = $${i}`); params.push(val); i++; }
        await client.query(`UPDATE store_return_notes SET ${fields.join(', ')} WHERE id = $${i}`, [...params, srnId]);
      };

      try {
        await runUpdate(updates);
      } catch (e) {
        const msg = String(e?.message || '');
        if (msg.includes('column "updated_at"') || msg.includes('column "updated_by"')) {
          const filtered = updates.filter(([col]) => col !== 'updated_at' && col !== 'updated_by');
          await runUpdate(filtered);
        } else {
          throw e;
        }
      }

      if (Array.isArray(payload.items)) {
        await client.query('DELETE FROM store_return_items WHERE srn_id = $1', [srnId]);
        for (let idx = 0; idx < payload.items.length; idx++) {
          const it = payload.items[idx];
          await client.query(`
            INSERT INTO store_return_items (
              srn_id, challan_line_id, item_id,
              quantity_returned, quantity_accepted, quantity_rejected, condition, remarks
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          `, [
            srnId, it.challan_line_id || null, it.item_id || null,
            Number(it.quantity_returned || 0), Number(it.quantity_accepted || 0), Number(it.quantity_rejected || 0),
            it.condition || null, it.remarks || null
          ]);
        }
      }

      const { rows: out } = await client.query('SELECT * FROM store_return_notes WHERE id = $1', [srnId]);
      return out[0];
    });
  }

  async delete(srnId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status FROM store_return_notes WHERE id = $1', [srnId]);
      if (rows.length === 0) throw new Error('SRN not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft SRNs can be deleted');
      await client.query('DELETE FROM store_return_items WHERE srn_id = $1', [srnId]);
      await client.query('DELETE FROM store_return_notes WHERE id = $1', [srnId]);
      await domainEventService.publishEvent('INVENTORY.SRN.DELETED', srnId.toString(), 'store_return_note', { srn_id: srnId }, { deleted_by: userId });
      return { deleted: true };
    });
  }

  async withdraw(srnId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status, workflow_instance_id FROM store_return_notes WHERE id = $1 FOR UPDATE', [srnId]);
      if (rows.length === 0) throw new Error('SRN not found');
      const srn = rows[0];
      if (!['draft', 'submitted', 'pending_approval'].includes(srn.status)) {
        throw new Error('Only draft or submitted SRNs can be withdrawn');
      }

      const { rows: upd } = await client.query(
        `UPDATE store_return_notes
         SET status = 'withdrawn',
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
         RETURNING *`,
        [srnId, userId]
      );

      if (srn.workflow_instance_id) {
        try {
          const { actOnInstance } = await import('../system/workflowService.js');
          await actOnInstance({
            instanceId: srn.workflow_instance_id,
            actorId: userId,
            action: 'withdraw',
            comment: 'Withdrawn by creator'
          });
        } catch (e) {
          console.warn('Workflow withdraw failed:', e.message);
        }
      }

      await domainEventService.publishEvent('INVENTORY.SRN.WITHDRAWN', srnId.toString(), 'store_return_note', { srn_id: srnId }, { withdrawn_by: userId });
      return upd[0];
    });
  }
}

export default new SrnService();


