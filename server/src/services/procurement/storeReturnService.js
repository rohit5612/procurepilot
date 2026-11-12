import { query, transaction } from '../../database/connection.js';

class StoreReturnService {
  async generateNumber(client) {
    const { rows } = await client.query('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM store_return_notes');
    const n = rows[0]?.n || 1;
    return `SRN-${new Date().getFullYear()}-${String(n).padStart(5, '0')}`;
  }

  async list(limit = 50) {
    const { rows } = await query(
      `SELECT srn.*, s.name AS supplier_name, grn.grn_number
       FROM store_return_notes srn
       LEFT JOIN suppliers s ON s.id = srn.supplier_id
       LEFT JOIN goods_receipts grn ON grn.id = srn.goods_receipt_id
       ORDER BY srn.created_at DESC LIMIT $1`,
      [Math.min(limit, 200)]
    );
    return rows;
  }

  async getById(id) {
    const { rows } = await query('SELECT * FROM store_return_notes WHERE id = $1', [id]);
    if (!rows[0]) throw new Error('Return note not found');
    const lines = await query(
      'SELECT * FROM srn_lines WHERE store_return_note_id = $1 ORDER BY line_number',
      [id]
    );
    return { ...rows[0], lines: lines.rows };
  }

  async createFromGrn(grnId, userId, payload = {}) {
    return transaction(async (client) => {
      const { rows: grnRows } = await client.query(
        `SELECT * FROM goods_receipts WHERE id = $1 AND status = 'posted'`,
        [grnId]
      );
      if (!grnRows[0]) throw new Error('Posted GRN not found');
      const grn = grnRows[0];
      const srnNumber = await this.generateNumber(client);
      const { rows: srnRows } = await client.query(
        `INSERT INTO store_return_notes (
           srn_number, goods_receipt_id, purchase_order_id, supplier_id, status, reason, created_by
         ) VALUES ($1,$2,$3,$4,'draft',$5,$6) RETURNING *`,
        [srnNumber, grnId, grn.purchase_order_id, grn.supplier_id, payload.reason || null, userId]
      );
      const srn = srnRows[0];
      const lines = payload.lines || [];
      let lineNo = 1;
      for (const l of lines) {
        const { rows: gl } = await client.query(
          'SELECT * FROM grn_lines WHERE id = $1 AND goods_receipt_id = $2',
          [l.grn_line_id, grnId]
        );
        if (!gl[0]) throw new Error(`GRN line ${l.grn_line_id} not found`);
        const returnQty = Number(l.return_qty || 0);
        if (returnQty <= 0 || returnQty > Number(gl[0].accepted_qty)) {
          throw new Error('Invalid return quantity');
        }
        await client.query(
          `INSERT INTO srn_lines (
             store_return_note_id, line_number, grn_line_id, po_line_id, item_id, return_qty, unit_price, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            srn.id,
            lineNo++,
            gl[0].id,
            gl[0].po_line_id,
            gl[0].item_id,
            returnQty,
            l.unit_price ?? gl[0].unit_price,
            l.notes || null
          ]
        );
      }
      return this.getById(srn.id);
    });
  }

  async post(srnId, userId) {
    return transaction(async (client) => {
      const { rows: srnRows } = await client.query(
        `SELECT * FROM store_return_notes WHERE id = $1 FOR UPDATE`,
        [srnId]
      );
      if (!srnRows[0] || srnRows[0].status !== 'draft') {
        throw new Error('Return note not found or cannot be posted');
      }
      const grn = srnRows[0];
      const { rows: grnHeader } = await client.query(
        'SELECT warehouse_id FROM goods_receipts WHERE id = $1',
        [grn.goods_receipt_id]
      );
      const warehouseId = grnHeader[0]?.warehouse_id || null;
      const { rows: lines } = await client.query(
        'SELECT * FROM srn_lines WHERE store_return_note_id = $1',
        [srnId]
      );
      for (const line of lines) {
        if (line.item_id && warehouseId) {
          await client.query(
            `INSERT INTO inventory_transactions (
               item_id, warehouse_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id
             ) VALUES ($1, $2, 'ADJUST', $3, $4, $5, 'SRN', $6)`,
            [
              line.item_id,
              warehouseId,
              -Number(line.return_qty),
              Number(line.unit_price || 0),
              -Number(line.return_qty) * Number(line.unit_price || 0),
              line.id
            ]
          );
        }
      }
      const { rows: upd } = await client.query(
        `UPDATE store_return_notes SET status = 'posted', posted_at = NOW(), posted_by = $2, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [srnId, userId]
      );
      return upd[0];
    });
  }
}

export default new StoreReturnService();
