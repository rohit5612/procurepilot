import { query, transaction } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class AdjustmentService {
  async generateNumber(client = null, circleId = null, clusterId = null) {
    const run = client ? client.query.bind(client) : query;
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

    const today = new Date();
    const fyStart = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    const fyEnd = fyStart + 1;
    const fy = `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
    const prefix = `ADJ/VRP/${circleCode}-${clusterCode}/${fy}/`;

    const { rows } = await run(
      `
        SELECT COALESCE(MAX(NULLIF(split_part(adjustment_number, '/', 5), '')::INT), 0) + 1 AS next_num
        FROM inventory_adjustments
        WHERE adjustment_number LIKE $1
      `,
      [`${prefix}%`]
    );
    const nextNum = rows[0]?.next_num || 1;
    return `${prefix}${String(nextNum).padStart(3, '0')}`;
  }

  async create(payload, userId) {
    return transaction(async (client) => {
      // Resolve circle/cluster from warehouse
      let circleId = null;
      let clusterId = null;
      if (payload.warehouse_id) {
        try {
          const wh = await client.query('SELECT circle_id, cluster_id FROM warehouses WHERE id = $1', [payload.warehouse_id]);
          if (wh.rows.length) {
            circleId = wh.rows[0].circle_id || null;
            clusterId = wh.rows[0].cluster_id || null;
          }
        } catch (_) {}
      }

      const number = await this.generateNumber(client, circleId, clusterId);
      const ins = await client.query(`
        INSERT INTO inventory_adjustments (adjustment_number, warehouse_id, bin_id, reason_code, remarks, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *
      `, [number, payload.warehouse_id || null, payload.bin_id || null, payload.reason_code, payload.remarks || null, userId]);
      const adj = ins.rows[0];
      if (Array.isArray(payload.lines)) {
        for (let i = 0; i < payload.lines.length; i++) {
          const l = payload.lines[i];
          const delta = Number(l.quantity_delta || 0);
          await client.query(`
            INSERT INTO inventory_adjustment_lines (adjustment_id, line_number, item_id, quantity_delta, unit_of_measure)
            VALUES ($1,$2,$3,$4,$5)
          `, [adj.id, i + 1, l.item_id || null, delta, l.unit_of_measure || 'PCS']);
        }
      }
      await domainEventService.publishEvent('INVENTORY.ADJUSTMENT.CREATED', adj.id.toString(), 'inventory_adjustment', { adjustment_id: adj.id });
      return adj;
    });
  }

  async post(adjustmentId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT * FROM inventory_adjustments WHERE id = $1 AND status IN ('draft','approved') FOR UPDATE", [adjustmentId]);
      if (rows.length === 0) throw new Error('Adjustment not found or cannot be posted');
      const adj = rows[0];
      const { rows: lines } = await client.query('SELECT * FROM inventory_adjustment_lines WHERE adjustment_id = $1 ORDER BY line_number', [adjustmentId]);
      if (lines.length === 0) throw new Error('No lines to adjust');

      for (const l of lines) {
        const delta = Number(l.quantity_delta || 0);
        if (delta === 0) continue;
        const trxType = delta > 0 ? 'ADJUST_IN' : 'ADJUST_OUT';
        // Use current moving average cost at the warehouse for valuation
        const avgRes = await client.query(`
          SELECT CASE WHEN COALESCE(SUM(il.quantity),0) = 0 THEN 0::numeric
                      ELSE COALESCE(SUM(il.total_cost),0)::numeric / NULLIF(COALESCE(SUM(il.quantity),0)::numeric,0) END AS avg_cost
          FROM inventory_layers il
          WHERE il.item_id = $1 AND il.warehouse_id = $2
        `, [l.item_id, adj.warehouse_id]);
        const unitCost = Number(avgRes.rows[0]?.avg_cost || 0);
        const trxQty = Math.abs(delta);
        const trxTotal = unitCost * trxQty;

        await client.query(`
          INSERT INTO inventory_transactions (item_id, warehouse_id, bin_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'ADJUSTMENT',$8)
        `, [l.item_id, adj.warehouse_id, adj.bin_id, trxType, trxQty, unitCost, trxTotal, adj.id]);
        await client.query(`
          INSERT INTO inventory_layers (item_id, warehouse_id, bin_id, quantity, unit_cost, total_cost, source_type, source_id)
          VALUES ($1,$2,$3,$4,$5,$6,'ADJUSTMENT',$7)
        `, [l.item_id, adj.warehouse_id, adj.bin_id, delta, unitCost, unitCost * delta, l.id]);
      }

      const { rows: upd } = await client.query(`
        UPDATE inventory_adjustments SET status = 'posted', posted_at = NOW(), posted_by = $1, updated_at = NOW(), updated_by = $1
        WHERE id = $2 RETURNING *
      `, [userId, adjustmentId]);
      const posted = upd[0];
      await domainEventService.publishEvent('INVENTORY.ADJUSTMENT.POSTED', adjustmentId.toString(), 'inventory_adjustment', { adjustment_id: adjustmentId }, { posted_by: userId });
      return posted;
    });
  }

  async getById(id) {
    const sql = `
      SELECT a.*, 
             json_agg(json_build_object('id', al.id, 'line_number', al.line_number, 'item_id', al.item_id, 'quantity_delta', al.quantity_delta, 'unit_of_measure', al.unit_of_measure) ORDER BY al.line_number)
             FILTER (WHERE al.id IS NOT NULL) AS lines
      FROM inventory_adjustments a
      LEFT JOIN inventory_adjustment_lines al ON al.adjustment_id = a.id
      WHERE a.id = $1
      GROUP BY a.id
    `;
    const { rows } = await query(sql, [id]);
    if (rows.length === 0) throw new Error('Adjustment not found');
    return rows[0];
  }

  async list({ page = 1, limit = 10, search, warehouse_id, delta_sign, status } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const { whereSql, params, nextIndex } = this.#buildListFilterClauses({ search, warehouse_id, delta_sign, status });
    const sql = `
      WITH agg AS (
        SELECT adjustment_id, COALESCE(SUM(quantity_delta),0)::numeric AS sum_delta
        FROM inventory_adjustment_lines
        GROUP BY adjustment_id
      )
      SELECT a.id, a.adjustment_number, a.status, a.created_at, a.warehouse_id, w.name AS warehouse_name, COALESCE(agg.sum_delta,0)::numeric AS sum_delta
      FROM inventory_adjustments a
      LEFT JOIN agg ON agg.adjustment_id = a.id
      LEFT JOIN warehouses w ON w.id = a.warehouse_id
      ${whereSql}
      ORDER BY a.created_at DESC
      LIMIT $${nextIndex} OFFSET $${nextIndex+1}
    `;
    const rowsRes = await query(sql, [...params, limit, offset]);
    const countSql = `
      WITH agg AS (
        SELECT adjustment_id, COALESCE(SUM(quantity_delta),0)::numeric AS sum_delta
        FROM inventory_adjustment_lines
        GROUP BY adjustment_id
      )
      SELECT COUNT(*)::int AS total
      FROM inventory_adjustments a
      LEFT JOIN agg ON agg.adjustment_id = a.id
      LEFT JOIN warehouses w ON w.id = a.warehouse_id
      ${whereSql}
    `;
    const c = await query(countSql, params);
    return {
      items: rowsRes.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: c.rows[0].total,
        totalPages: Math.ceil(c.rows[0].total / Number(limit))
      }
    };
  }

  async export({ search, warehouse_id, delta_sign, status } = {}) {
    const { whereSql, params } = this.#buildListFilterClauses({ search, warehouse_id, delta_sign, status });
    const limit = 5000;
    const sql = `
      WITH agg AS (
        SELECT adjustment_id, COALESCE(SUM(quantity_delta),0)::numeric AS sum_delta
        FROM inventory_adjustment_lines
        GROUP BY adjustment_id
      )
      SELECT a.id, a.adjustment_number, a.status, a.created_at, a.warehouse_id, w.name AS warehouse_name, COALESCE(agg.sum_delta,0)::numeric AS sum_delta
      FROM inventory_adjustments a
      LEFT JOIN agg ON agg.adjustment_id = a.id
      LEFT JOIN warehouses w ON w.id = a.warehouse_id
      ${whereSql}
      ORDER BY a.created_at DESC
      LIMIT ${limit}
    `;
    const res = await query(sql, params);
    return res.rows;
  }

  #buildListFilterClauses({ search, warehouse_id, delta_sign, status } = {}) {
    const where = [];
    const params = [];
    let i = 1;
    if (warehouse_id) { where.push(`a.warehouse_id = $${i++}`); params.push(Number(warehouse_id)); }
    if (status) { where.push(`a.status = $${i++}`); params.push(status); }
    if (delta_sign === '+') { where.push(`sum_delta > 0`); }
    if (delta_sign === '-') { where.push(`sum_delta < 0`); }
    if (search) {
      where.push(`(a.adjustment_number ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return { whereSql, params, nextIndex: i };
  }

  async update(adjustmentId, payload, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT status FROM inventory_adjustments WHERE id = $1 FOR UPDATE", [adjustmentId]);
      if (rows.length === 0) throw new Error('Adjustment not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft adjustments can be updated');

      const fields = [];
      const params = [];
      let i = 1;
      const setField = (col, val) => { fields.push(`${col} = $${i}`); params.push(val); i++; };
      if (payload.warehouse_id != null) setField('warehouse_id', Number(payload.warehouse_id));
      if (payload.bin_id != null) setField('bin_id', Number(payload.bin_id));
      if (payload.reason_code != null) setField('reason_code', payload.reason_code);
      if (payload.remarks != null) setField('remarks', payload.remarks);
      setField('updated_at', new Date());
      setField('updated_by', userId);
      if (fields.length) await client.query(`UPDATE inventory_adjustments SET ${fields.join(', ')} WHERE id = $${i}`, [...params, adjustmentId]);

      if (Array.isArray(payload.lines)) {
        await client.query('DELETE FROM inventory_adjustment_lines WHERE adjustment_id = $1', [adjustmentId]);
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const l = payload.lines[idx];
          const delta = Number(l.quantity_delta || 0);
          await client.query(`
            INSERT INTO inventory_adjustment_lines (adjustment_id, line_number, item_id, quantity_delta, unit_of_measure)
            VALUES ($1,$2,$3,$4,$5)
          `, [adjustmentId, idx + 1, l.item_id || null, delta, l.unit_of_measure || 'PCS']);
        }
      }

      const { rows: out } = await client.query('SELECT * FROM inventory_adjustments WHERE id = $1', [adjustmentId]);
      return out[0];
    });
  }

  async delete(adjustmentId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT status FROM inventory_adjustments WHERE id = $1", [adjustmentId]);
      if (rows.length === 0) throw new Error('Adjustment not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft adjustments can be deleted');
      await client.query('DELETE FROM inventory_adjustment_lines WHERE adjustment_id = $1', [adjustmentId]);
      await client.query('DELETE FROM inventory_adjustments WHERE id = $1', [adjustmentId]);
      await domainEventService.publishEvent('INVENTORY.ADJUSTMENT.DELETED', adjustmentId.toString(), 'inventory_adjustment', { adjustment_id: adjustmentId }, { deleted_by: userId });
      return { deleted: true };
    });
  }

  async withdraw(adjustmentId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status, workflow_instance_id FROM inventory_adjustments WHERE id = $1 FOR UPDATE', [adjustmentId]);
      if (rows.length === 0) throw new Error('Adjustment not found');
      const adj = rows[0];
      if (!['draft', 'submitted', 'pending_approval'].includes(adj.status)) {
        throw new Error('Only draft or submitted adjustments can be withdrawn');
      }

      const { rows: upd } = await client.query(
        `UPDATE inventory_adjustments
         SET status = 'withdrawn',
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
         RETURNING *`,
        [adjustmentId, userId]
      );

      if (adj.workflow_instance_id) {
        try {
          const { actOnInstance } = await import('../system/workflowService.js');
          await actOnInstance({
            instanceId: adj.workflow_instance_id,
            actorId: userId,
            action: 'withdraw',
            comment: 'Withdrawn by creator'
          });
        } catch (e) {
          console.warn('Workflow withdraw failed:', e.message);
        }
      }

      await domainEventService.publishEvent('INVENTORY.ADJUSTMENT.WITHDRAWN', adjustmentId.toString(), 'inventory_adjustment', { adjustment_id: adjustmentId }, { withdrawn_by: userId });
      return upd[0];
    });
  }
}

export default new AdjustmentService();



