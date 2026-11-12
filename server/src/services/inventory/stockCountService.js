import { query, transaction } from '../../database/connection.js';

class StockCountService {
  async generateNumber(client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run('SELECT generate_stock_count_number() AS count_number');
    return rows[0].count_number;
  }

  async create(payload, userId) {
    return transaction(async (client) => {
      const num = await this.generateNumber(client);
      const ins = await client.query(`
        INSERT INTO stock_counts (count_number, title, remarks, conducted_by, created_by, updated_by)
        VALUES ($1,$2,$3,$4,$5,$5) RETURNING *
      `, [num, payload.title || null, payload.remarks || null, payload.conducted_by || null, userId]);
      const sc = ins.rows[0];

      // Snapshot: simple snapshot from inventory_layers by item/location
      const { rows: snap } = await client.query(`
        SELECT il.item_id, il.warehouse_id, il.bin_id, COALESCE(SUM(il.quantity),0)::numeric AS qty
        FROM inventory_layers il
        WHERE il.item_id IS NOT NULL
        GROUP BY il.item_id, il.warehouse_id, il.bin_id
        ORDER BY il.item_id
      `);
      let lineNum = 1;
      for (const r of snap) {
        await client.query(`
          INSERT INTO stock_count_lines (stock_count_id, line_number, item_id, warehouse_id, bin_id, snapshot_qty, counted_qty, variance_qty)
          VALUES ($1,$2,$3,$4,$5,$6,0,$6)
        `, [sc.id, lineNum++, r.item_id, r.warehouse_id, r.bin_id, r.qty]);
      }

      return sc;
    });
  }

  async updateLine(countId, lineId, countedQty, userId) {
    const { rows } = await query('SELECT * FROM stock_count_lines WHERE id = $1 AND stock_count_id = $2', [lineId, countId]);
    if (rows.length === 0) throw new Error('Line not found');
    const line = rows[0];
    const variance = Number(countedQty) - Number(line.snapshot_qty);
    const { rows: upd } = await query(`
      UPDATE stock_count_lines
      SET counted_qty = $1, variance_qty = $2
      WHERE id = $3 RETURNING *
    `, [countedQty, variance, lineId]);
    return upd[0];
  }

  async post(countId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT * FROM stock_counts WHERE id = $1 AND status IN ('draft','approved') FOR UPDATE", [countId]);
      if (rows.length === 0) throw new Error('Stock count not found or cannot be posted');
      const sc = rows[0];
      const { rows: lines } = await client.query('SELECT * FROM stock_count_lines WHERE stock_count_id = $1 ORDER BY line_number', [countId]);

      // Apply variances as ADJUSTMENT transactions
      for (const l of lines) {
        const variance = Number(l.variance_qty || 0);
        if (variance === 0) continue;
        const trxType = variance > 0 ? 'ADJUST_IN' : 'ADJUST_OUT';
        await client.query(`
          INSERT INTO inventory_transactions (item_id, warehouse_id, bin_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id)
          VALUES ($1,$2,$3,$4,$5,0,0,'STOCK_COUNT',$6)
        `, [l.item_id, l.warehouse_id, l.bin_id, trxType, Math.abs(variance), sc.id]);
        await client.query(`
          INSERT INTO inventory_layers (item_id, warehouse_id, bin_id, quantity, unit_cost, total_cost, source_type, source_id)
          VALUES ($1,$2,$3,$4,0,0,'STOCK_COUNT',$5)
        `, [l.item_id, l.warehouse_id, l.bin_id, variance, l.id]);
      }

      const { rows: upd } = await client.query(`
        UPDATE stock_counts SET status = 'posted', posted_at = NOW(), posted_by = $1, updated_at = NOW(), updated_by = $1 WHERE id = $2 RETURNING *
      `, [userId, countId]);
      return upd[0];
    });
  }

  async getById(id) {
    const sql = `
      SELECT sc.*,
             json_agg(json_build_object('id', scl.id, 'line_number', scl.line_number, 'item_id', scl.item_id, 'warehouse_id', scl.warehouse_id, 'bin_id', scl.bin_id, 'snapshot_qty', scl.snapshot_qty, 'counted_qty', scl.counted_qty, 'variance_qty', scl.variance_qty, 'unit_of_measure', scl.unit_of_measure) ORDER BY scl.line_number)
             FILTER (WHERE scl.id IS NOT NULL) AS lines
      FROM stock_counts sc
      LEFT JOIN stock_count_lines scl ON scl.stock_count_id = sc.id
      WHERE sc.id = $1
      GROUP BY sc.id
    `;
    const { rows } = await query(sql, [id]);
    if (rows.length === 0) throw new Error('Stock count not found');
    return rows[0];
  }

  async list({ page = 1, limit = 10 } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const { rows } = await query('SELECT id, count_number, title, status, snapshot_at, posted_at, created_at FROM stock_counts ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
    const { rows: c } = await query('SELECT COUNT(*)::int AS total FROM stock_counts');
    return { items: rows, pagination: { page: Number(page), limit: Number(limit), total: c[0].total, totalPages: Math.ceil(c[0].total / Number(limit)) } };
  }

  async updateHeader(id, { conducted_by }, userId) {
    const { rows } = await query(
      `UPDATE stock_counts 
       SET conducted_by = COALESCE($2, conducted_by),
           updated_at = NOW(), updated_by = $3
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [id, conducted_by || null, userId]
    );
    if (rows.length === 0) throw new Error('Stock count not found or not editable');
    return rows[0];
  }
}

export default new StockCountService();



