import { query, transaction } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class TransferService {
  async generateNumber(client = null, circleId = null, clusterId = null) {
    const run = client ? client.query.bind(client) : query;
    // Resolve codes
    const { rows: codeRows } = await run(
      `
      SELECT 
        COALESCE(tc.code, tc.name, 'NA') AS circle_code,
        COALESCE(cl.code, cl.name, 'NA') AS cluster_code
      FROM telecom_circles tc
      FULL JOIN clusters cl ON cl.id = $2
      WHERE tc.id = $1
      `,
      [circleId, clusterId]
    );
    const circleCode = codeRows[0]?.circle_code || 'NA';
    const clusterCode = codeRows[0]?.cluster_code || 'NA';

    // FY
    const today = new Date();
    const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const fyEnd = fyStart + 1;
    const fy = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
    const prefix = `TR/VRP/${circleCode}-${clusterCode}/${fy}/`;

    const { rows } = await run(
      `
        SELECT COALESCE(MAX(NULLIF(split_part(transfer_number, '/', 5), '')::INT), 0) + 1 AS next_num
        FROM inventory_transfers
        WHERE transfer_number LIKE $1
      `,
      [`${prefix}%`]
    );
    const nextNum = rows[0]?.next_num || 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async generateChallanNumber(client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows} = await run('SELECT generate_transfer_challan_number() AS challan_number');
    return rows[0]?.challan_number;
  }

  async create(payload, userId) {
    return transaction(async (client) => {
      // Resolve circle/cluster from source warehouse (fallback to destination)
      let circleId = null;
      let clusterId = null;
      const whId = payload.from_warehouse_id || payload.to_warehouse_id || null;
      if (whId) {
        try {
          const wh = await client.query(
            'SELECT circle_id, cluster_id FROM warehouses WHERE id = $1',
            [whId]
          );
          if (wh.rows.length) {
            circleId = wh.rows[0].circle_id || null;
            clusterId = wh.rows[0].cluster_id || null;
          }
        } catch (_) {}
      }

      const number = await this.generateNumber(client, circleId, clusterId);
      const ins = await client.query(`
        INSERT INTO inventory_transfers (
          transfer_number, from_warehouse_id, from_bin_id, to_warehouse_id, to_bin_id,
          from_warehouse_address, to_warehouse_address,
          remarks, challan_date, eway_bill_number, eway_bill_date,
          vehicle_number, driver_name, driver_phone, note,
          created_by, updated_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *
      `, [
        number,
        payload.from_warehouse_id || null,
        payload.from_bin_id || null,
        payload.to_warehouse_id || null,
        payload.to_bin_id || null,
        payload.from_warehouse_address || null,
        payload.to_warehouse_address || null,
        payload.remarks || null,
        payload.challan_date || null,
        payload.eway_bill_number || null,
        payload.eway_bill_date || null,
        payload.vehicle_number || null,
        payload.driver_name || null,
        payload.driver_phone || null,
        'THESE ITEMS ARE NOT FOR SALE. INTERNAL STOCK TRANSFER BETWEEN WAREHOUSES',
        userId,
        userId
      ]);
      const tr = ins.rows[0];
      if (Array.isArray(payload.lines)) {
        for (let i = 0; i < payload.lines.length; i++) {
          const l = payload.lines[i];
          const qty = Math.max(Number(l.quantity) || 0, 0);
          await client.query(`
            INSERT INTO inventory_transfer_lines (transfer_id, line_number, item_id, quantity, unit_of_measure)
            VALUES ($1,$2,$3,$4,$5)
          `, [tr.id, i + 1, l.item_id || null, qty, l.unit_of_measure || 'PCS']);
        }
      }
      await domainEventService.publishEvent('INVENTORY.TRANSFER.CREATED', tr.id.toString(), 'inventory_transfer', { transfer_id: tr.id });
      return tr;
    });
  }

  async post(transferId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM inventory_transfers WHERE id = $1 AND status IN (\'draft\', \'approved\') FOR UPDATE', [transferId]);
      if (rows.length === 0) throw new Error('Transfer not found or cannot be posted (must be draft or approved)');
      const tr = rows[0];
      
      // Generate challan number at posting time (Transfer Challan creation)
      const challanNumber = await this.generateChallanNumber(client);
      
      const { rows: lines } = await client.query('SELECT * FROM inventory_transfer_lines WHERE transfer_id = $1 ORDER BY line_number', [transferId]);
      if (lines.length === 0) throw new Error('No lines to transfer');

      let consignmentTotalValue = 0;
      for (const l of lines) {
        const qty = Number(l.quantity || 0);
        if (qty <= 0) continue;

        // Determine current moving average cost at the source warehouse for this item
        const avgRes = await client.query(`
          SELECT CASE WHEN COALESCE(SUM(il.quantity),0) = 0 THEN 0::numeric
                      ELSE COALESCE(SUM(il.total_cost),0)::numeric / NULLIF(COALESCE(SUM(il.quantity),0)::numeric,0) END AS avg_cost
          FROM inventory_layers il
          WHERE il.item_id = $1 AND il.warehouse_id = $2
        `, [l.item_id, tr.from_warehouse_id]);
        const unitCost = Number(avgRes.rows[0]?.avg_cost || 0);
        const totalCost = unitCost * qty;
        consignmentTotalValue += totalCost;

        // OUT from source - carry unit cost
        await client.query(`
          INSERT INTO inventory_transactions (item_id, warehouse_id, bin_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id)
          VALUES ($1,$2,$3,'TRANSFER_OUT',$4,$5,$6,'TRANSFER',$7)
        `, [l.item_id, tr.from_warehouse_id, tr.from_bin_id, qty, unitCost, totalCost, tr.id]);
        await client.query(`
          INSERT INTO inventory_layers (item_id, warehouse_id, bin_id, quantity, unit_cost, total_cost, source_type, source_id)
          VALUES ($1,$2,$3,$4,$5,$6,'TRANSFER_OUT',$7)
        `, [l.item_id, tr.from_warehouse_id, tr.from_bin_id, -qty, unitCost, -totalCost, l.id]);

        // IN to destination - same unit cost so value transfers with the stock
        await client.query(`
          INSERT INTO inventory_transactions (item_id, warehouse_id, bin_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id)
          VALUES ($1,$2,$3,'TRANSFER_IN',$4,$5,$6,'TRANSFER',$7)
        `, [l.item_id, tr.to_warehouse_id, tr.to_bin_id, qty, unitCost, totalCost, tr.id]);
        await client.query(`
          INSERT INTO inventory_layers (item_id, warehouse_id, bin_id, quantity, unit_cost, total_cost, source_type, source_id)
          VALUES ($1,$2,$3,$4,$5,$6,'TRANSFER_IN',$7)
        `, [l.item_id, tr.to_warehouse_id, tr.to_bin_id, qty, unitCost, totalCost, l.id]);
      }

      // Enforce E-Way Bill for consignments >= 50000
      if (consignmentTotalValue >= 50000) {
        const ewbNumber = (tr.eway_bill_number || '').toString().trim();
        const ewbDate = tr.eway_bill_date;
        if (!ewbNumber || !ewbDate) {
          throw new Error('E-Way Bill number and date are required for transfers with consignment value >= 50,000');
        }
      }

      const { rows: postedRows } = await client.query(`
        UPDATE inventory_transfers 
        SET status = 'posted', challan_number = $1, posted_at = NOW(), posted_by = $2, updated_at = NOW(), updated_by = $2
        WHERE id = $3 RETURNING *
      `, [challanNumber, userId, transferId]);
      const posted = postedRows[0];
      await domainEventService.publishEvent('INVENTORY.TRANSFER.POSTED', transferId.toString(), 'inventory_transfer', { transfer_id: transferId, challan_number: challanNumber }, { posted_by: userId });
      return posted;
    });
  }

  async withdraw(transferId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM inventory_transfers WHERE id = $1 FOR UPDATE', [transferId]);
      if (rows.length === 0) throw new Error('Transfer not found');
      const tr = rows[0];
      if (tr.status !== 'draft' && tr.status !== 'submitted' && tr.status !== 'pending_approval') {
        throw new Error('Only draft or submitted transfers can be withdrawn');
      }
      const { rows: upd } = await client.query(`
        UPDATE inventory_transfers
        SET status = 'withdrawn', updated_at = NOW(), updated_by = $1
        WHERE id = $2
        RETURNING *
      `, [userId, transferId]);
      await domainEventService.publishEvent('INVENTORY.TRANSFER.WITHDRAWN', transferId.toString(), 'inventory_transfer', { transfer_id: transferId }, { withdrawn_by: userId });
      return upd[0];
    });
  }

  async getById(id) {
    const sql = `
      SELECT tr.*, 
             fw.name AS from_warehouse_name,
             tw.name AS to_warehouse_name,
             json_agg(json_build_object(
               'id', tl.id, 'line_number', tl.line_number, 'item_id', tl.item_id, 
               'item_name', it.name, 'item_code', it.item_code,
               'quantity', tl.quantity, 'unit_of_measure', tl.unit_of_measure
             ) ORDER BY tl.line_number)
             FILTER (WHERE tl.id IS NOT NULL) AS lines
      FROM inventory_transfers tr
      LEFT JOIN inventory_transfer_lines tl ON tl.transfer_id = tr.id
      LEFT JOIN items it ON it.id = tl.item_id
      LEFT JOIN warehouses fw ON fw.id = tr.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = tr.to_warehouse_id
      WHERE tr.id = $1
      GROUP BY tr.id, fw.name, tw.name
    `;
    const { rows } = await query(sql, [id]);
    if (rows.length === 0) throw new Error('Transfer not found');
    return rows[0];
  }

  async list({ page = 1, limit = 10, status, search, from_warehouse_id, to_warehouse_id } = {}) {
    const offset = (Number(page) - 1) * Number(limit);

    const { whereClause, params, limitParam, offsetParam } = this.#buildListFilterClauses({
      status,
      search,
      from_warehouse_id,
      to_warehouse_id,
      limit,
      offset
    });

    const { rows } = await query(`
      SELECT tr.id, tr.transfer_number, tr.challan_number, tr.status, tr.created_at,
             fw.name AS from_warehouse_name,
             tw.name AS to_warehouse_name,
             COUNT(tl.id)::int AS line_count
      FROM inventory_transfers tr
      LEFT JOIN inventory_transfer_lines tl ON tl.transfer_id = tr.id
      LEFT JOIN warehouses fw ON fw.id = tr.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = tr.to_warehouse_id
      ${whereClause}
      GROUP BY tr.id, fw.name, tw.name
      ORDER BY tr.created_at DESC 
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `, params);

    const countParams = params.slice(0, -2);
    const { rows: c } = await query(`
      SELECT COUNT(DISTINCT tr.id)::int AS total 
      FROM inventory_transfers tr
      LEFT JOIN warehouses fw ON fw.id = tr.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = tr.to_warehouse_id
      ${whereClause}
    `, countParams);
    
    return {
      items: rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: c[0].total,
        totalPages: Math.ceil(c[0].total / Number(limit))
      }
    };
  }

  async export({ status, search, from_warehouse_id, to_warehouse_id } = {}) {
    const { whereClause, params } = this.#buildListFilterClauses({
      status,
      search,
      from_warehouse_id,
      to_warehouse_id
    }, true);

    const limit = 5000;

    const { rows } = await query(`
      SELECT tr.id, tr.transfer_number, tr.challan_number, tr.status, tr.created_at,
             fw.name AS from_warehouse_name,
             tw.name AS to_warehouse_name,
             COUNT(tl.id)::int AS line_count
      FROM inventory_transfers tr
      LEFT JOIN inventory_transfer_lines tl ON tl.transfer_id = tr.id
      LEFT JOIN warehouses fw ON fw.id = tr.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = tr.to_warehouse_id
      ${whereClause}
      GROUP BY tr.id, fw.name, tw.name
      ORDER BY tr.created_at DESC 
      LIMIT ${limit}
    `, params);

    return rows;
  }

  #buildListFilterClauses(filters = {}, isExport = false) {
    const { status, search, from_warehouse_id, to_warehouse_id, limit, offset } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`tr.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(tr.transfer_number ILIKE $${paramIndex} OR tr.challan_number ILIKE $${paramIndex} OR fw.name ILIKE $${paramIndex} OR tw.name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (from_warehouse_id) {
      conditions.push(`tr.from_warehouse_id = $${paramIndex}`);
      params.push(Number(from_warehouse_id));
      paramIndex++;
    }
    if (to_warehouse_id) {
      conditions.push(`tr.to_warehouse_id = $${paramIndex}`);
      params.push(Number(to_warehouse_id));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    if (isExport) {
      return { whereClause, params };
    }

    params.push(limit, offset);
    const limitParam = `$${paramIndex}`;
    const offsetParam = `$${paramIndex + 1}`;

    return { whereClause, params, limitParam, offsetParam };
  }

  async update(transferId, payload, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT status FROM inventory_transfers WHERE id = $1 FOR UPDATE", [transferId]);
      if (rows.length === 0) throw new Error('Transfer not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft transfers can be updated');

      const fields = [];
      const params = [];
      let i = 1;
      const setField = (col, val) => { fields.push(`${col} = $${i}`); params.push(val); i++; };
      if (payload.from_warehouse_id != null) setField('from_warehouse_id', Number(payload.from_warehouse_id));
      if (payload.from_bin_id != null) setField('from_bin_id', Number(payload.from_bin_id));
      if (payload.to_warehouse_id != null) setField('to_warehouse_id', Number(payload.to_warehouse_id));
      if (payload.to_bin_id != null) setField('to_bin_id', Number(payload.to_bin_id));
      if (payload.from_warehouse_address != null) setField('from_warehouse_address', payload.from_warehouse_address);
      if (payload.to_warehouse_address != null) setField('to_warehouse_address', payload.to_warehouse_address);
      if (payload.remarks != null) setField('remarks', payload.remarks);
      if (payload.challan_date != null) setField('challan_date', payload.challan_date);
      if (payload.eway_bill_number != null) setField('eway_bill_number', payload.eway_bill_number);
      if (payload.eway_bill_date != null) setField('eway_bill_date', payload.eway_bill_date);
      if (payload.vehicle_number != null) setField('vehicle_number', payload.vehicle_number);
      if (payload.driver_name != null) setField('driver_name', payload.driver_name);
      if (payload.driver_phone != null) setField('driver_phone', payload.driver_phone);
      setField('updated_at', new Date());
      setField('updated_by', userId);
      if (fields.length) await client.query(`UPDATE inventory_transfers SET ${fields.join(', ')} WHERE id = $${i}`, [...params, transferId]);

      if (Array.isArray(payload.lines)) {
        await client.query('DELETE FROM inventory_transfer_lines WHERE transfer_id = $1', [transferId]);
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const l = payload.lines[idx];
          const qty = Math.max(Number(l.quantity) || 0, 0);
          await client.query(`
            INSERT INTO inventory_transfer_lines (transfer_id, line_number, item_id, quantity, unit_of_measure)
            VALUES ($1,$2,$3,$4,$5)
          `, [transferId, idx + 1, l.item_id || null, qty, l.unit_of_measure || 'PCS']);
        }
      }

      const { rows: out } = await client.query('SELECT * FROM inventory_transfers WHERE id = $1', [transferId]);
      return out[0];
    });
  }

  async delete(transferId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status FROM inventory_transfers WHERE id = $1', [transferId]);
      if (rows.length === 0) throw new Error('Transfer not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft transfers can be deleted');
      await client.query('DELETE FROM inventory_transfer_lines WHERE transfer_id = $1', [transferId]);
      await client.query('DELETE FROM inventory_transfers WHERE id = $1', [transferId]);
      await domainEventService.publishEvent('INVENTORY.TRANSFER.DELETED', transferId.toString(), 'inventory_transfer', { transfer_id: transferId }, { deleted_by: userId });
      return { deleted: true };
    });
  }
}

export default new TransferService();



