import { query, transaction } from '../../database/connection.js';

const QTY_TOLERANCE = 0.01;
const AMOUNT_TOLERANCE = 1;

class SupplierInvoiceService {
  async list(filters = {}) {
    const limit = Math.min(Number(filters.limit) || 50, 200);
    const { rows } = await query(
      `SELECT si.*, s.name AS supplier_name, po.po_number
       FROM supplier_invoices si
       JOIN suppliers s ON s.id = si.supplier_id
       LEFT JOIN purchase_orders po ON po.id = si.purchase_order_id
       ORDER BY si.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async getById(id) {
    const { rows } = await query(
      `SELECT si.*, s.name AS supplier_name FROM supplier_invoices si
       JOIN suppliers s ON s.id = si.supplier_id WHERE si.id = $1`,
      [id]
    );
    if (!rows[0]) throw new Error('Invoice not found');
    const lines = await query(
      'SELECT * FROM supplier_invoice_lines WHERE supplier_invoice_id = $1 ORDER BY line_number',
      [id]
    );
    return { ...rows[0], lines: lines.rows };
  }

  async capture(userId, payload) {
    return transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO supplier_invoices (
           invoice_number, supplier_id, purchase_order_id, invoice_date, currency,
           subtotal, tax_amount, total_amount, status, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'captured',$9) RETURNING *`,
        [
          payload.invoice_number,
          payload.supplier_id,
          payload.purchase_order_id || null,
          payload.invoice_date,
          payload.currency || 'INR',
          payload.subtotal || 0,
          payload.tax_amount || 0,
          payload.total_amount || 0,
          userId
        ]
      );
      const inv = rows[0];
      const lines = payload.lines || [];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await client.query(
          `INSERT INTO supplier_invoice_lines (
             supplier_invoice_id, line_number, po_line_id, grn_line_id, quantity, unit_price, line_total
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            inv.id,
            i + 1,
            l.po_line_id || null,
            l.grn_line_id || null,
            l.quantity || 0,
            l.unit_price || 0,
            l.line_total || (Number(l.quantity || 0) * Number(l.unit_price || 0))
          ]
        );
      }
      return this.runMatch(client, inv.id, userId);
    });
  }

  async runMatch(clientOrId, invoiceId, userId) {
    const runInTx = typeof clientOrId?.query === 'function';
    const exec = async (client) => {
      const { rows: invRows } = await client.query('SELECT * FROM supplier_invoices WHERE id = $1', [invoiceId]);
      const inv = invRows[0];
      if (!inv) throw new Error('Invoice not found');
      const { rows: lines } = await client.query(
        'SELECT * FROM supplier_invoice_lines WHERE supplier_invoice_id = $1',
        [invoiceId]
      );
      const exceptions = [];
      for (const line of lines) {
        if (line.po_line_id) {
          const { rows: poLine } = await client.query(
            'SELECT quantity, total_price FROM po_lines WHERE id = $1',
            [line.po_line_id]
          );
          const orderedQty = Number(poLine[0]?.quantity || 0);
          const orderedAmt = Number(poLine[0]?.total_price || 0);
          if (Math.abs(Number(line.quantity) - orderedQty) > QTY_TOLERANCE) {
            exceptions.push({ line_number: line.line_number, type: 'qty_po_mismatch', po_line_id: line.po_line_id });
          }
          if (Math.abs(Number(line.line_total) - orderedAmt) > AMOUNT_TOLERANCE) {
            exceptions.push({ line_number: line.line_number, type: 'amount_po_mismatch', po_line_id: line.po_line_id });
          }
        }
        if (line.grn_line_id) {
          const { rows: grnLine } = await client.query(
            'SELECT accepted_qty FROM grn_lines WHERE id = $1',
            [line.grn_line_id]
          );
          const accepted = Number(grnLine[0]?.accepted_qty || 0);
          if (Math.abs(Number(line.quantity) - accepted) > QTY_TOLERANCE) {
            exceptions.push({ line_number: line.line_number, type: 'qty_grn_mismatch', grn_line_id: line.grn_line_id });
          }
        }
      }
      const status = exceptions.length ? 'exception' : 'matched';
      await client.query(
        `UPDATE supplier_invoices SET status = $2,
         match_notes = $3, updated_at = NOW() WHERE id = $1`,
        [invoiceId, status, JSON.stringify(exceptions)]
      );
      return { invoice_id: invoiceId, status, exceptions };
    };
    if (runInTx) return exec(clientOrId);
    return transaction((client) => exec(client));
  }

  async handoffToFinance(invoiceId, userId) {
    const { rows } = await query(
      `UPDATE supplier_invoices
       SET status = 'ready_for_finance', finance_handoff_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('matched', 'exception')
       RETURNING *`,
      [invoiceId]
    );
    if (!rows[0]) throw new Error('Invoice not ready for finance handoff');
    return rows[0];
  }
}

export default new SupplierInvoiceService();
