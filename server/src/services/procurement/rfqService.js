import { query, transaction } from '../../database/connection.js';
import procurementPolicyService from './procurementPolicyService.js';

class RfqService {
  async generateNumber(client) {
    const { rows } = await client.query(
      `SELECT COALESCE(MAX(id), 0) + 1 AS n FROM rfqs`
    );
    const n = rows[0]?.n || 1;
    const year = new Date().getFullYear();
    return `RFQ-${year}-${String(n).padStart(5, '0')}`;
  }

  async list(filters = {}) {
    const limit = Math.min(Number(filters.limit) || 50, 200);
    const page = Math.max(Number(filters.page) || 1, 1);
    const offset = (page - 1) * limit;
    const { rows } = await query(
      `SELECT r.*, COUNT(DISTINCT ri.supplier_id) AS invited_count,
              COUNT(DISTINCT sq.id) FILTER (WHERE sq.status = 'submitted') AS quote_count
       FROM rfqs r
       LEFT JOIN rfq_invitations ri ON ri.rfq_id = r.id
       LEFT JOIN supplier_quotations sq ON sq.rfq_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { items: rows, pagination: { page, limit } };
  }

  async getById(rfqId) {
    const { rows } = await query('SELECT * FROM rfqs WHERE id = $1', [rfqId]);
    if (!rows[0]) throw new Error('RFQ not found');
    const lines = await query('SELECT * FROM rfq_lines WHERE rfq_id = $1 ORDER BY line_number', [rfqId]);
    const invitations = await query(
      `SELECT ri.*, s.name AS supplier_name FROM rfq_invitations ri
       JOIN suppliers s ON s.id = ri.supplier_id WHERE ri.rfq_id = $1`,
      [rfqId]
    );
    const quotes = await query(
      `SELECT sq.*, s.name AS supplier_name FROM supplier_quotations sq
       JOIN suppliers s ON s.id = sq.supplier_id WHERE sq.rfq_id = $1`,
      [rfqId]
    );
    return { ...rows[0], lines: lines.rows, invitations: invitations.rows, quotations: quotes.rows };
  }

  async createFromRequisition(requisitionId, userId, payload = {}) {
    return transaction(async (client) => {
      const { rows: pr } = await client.query(
        `SELECT * FROM requisitions WHERE id = $1 AND status = 'approved'`,
        [requisitionId]
      );
      if (!pr[0]) throw new Error('Approved requisition not found');
      const rfqNumber = await this.generateNumber(client);
      const { rows: rfqRows } = await client.query(
        `INSERT INTO rfqs (rfq_number, title, description, requisition_id, status, response_deadline, created_by, updated_by)
         VALUES ($1, $2, $3, $4, 'draft', $5, $6, $6) RETURNING *`,
        [
          rfqNumber,
          payload.title || pr[0].title,
          payload.description || pr[0].description,
          requisitionId,
          payload.response_deadline || null,
          userId
        ]
      );
      const rfq = rfqRows[0];
      const { rows: prLines } = await client.query(
        'SELECT * FROM requisition_lines WHERE requisition_id = $1 ORDER BY line_number',
        [requisitionId]
      );
      for (const line of prLines) {
        await client.query(
          `INSERT INTO rfq_lines (rfq_id, line_number, requisition_line_id, item_id, item_name, quantity, unit_of_measure, specifications)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            rfq.id,
            line.line_number,
            line.id,
            line.item_id,
            line.item_name,
            line.quantity,
            line.unit_of_measure,
            line.specifications
          ]
        );
      }
      return rfq;
    });
  }

  async inviteSuppliers(rfqId, supplierIds, userId) {
    return transaction(async (client) => {
      for (const sid of supplierIds) {
        await client.query(
          `INSERT INTO rfq_invitations (rfq_id, supplier_id, invited_by, status)
           VALUES ($1, $2, $3, 'invited') ON CONFLICT (rfq_id, supplier_id) DO NOTHING`,
          [rfqId, sid, userId]
        );
      }
      await client.query(
        `UPDATE rfqs SET status = 'sent', updated_at = NOW(), updated_by = $2 WHERE id = $1 AND status = 'draft'`,
        [rfqId, userId]
      );
      return this.getById(rfqId);
    });
  }

  async upsertQuotation(rfqId, supplierId, userId, { lines = [], notes, valid_until }) {
    return transaction(async (client) => {
      const { rows: qRows } = await client.query(
        `INSERT INTO supplier_quotations (rfq_id, supplier_id, status, notes, valid_until, submitted_at)
         VALUES ($1, $2, 'submitted', $3, $4, NOW())
         ON CONFLICT (rfq_id, supplier_id)
         DO UPDATE SET status = 'submitted', notes = EXCLUDED.notes, valid_until = EXCLUDED.valid_until,
                       submitted_at = NOW(), updated_at = NOW()
         RETURNING *`,
        [rfqId, supplierId, notes || null, valid_until || null]
      );
      const quotation = qRows[0];
      let total = 0;
      for (const line of lines) {
        const qtyRes = await client.query('SELECT quantity FROM rfq_lines WHERE id = $1', [line.rfq_line_id]);
        const qty = Number(qtyRes.rows[0]?.quantity || line.quantity || 0);
        const unitPrice = Number(line.unit_price || 0);
        const lineTotal = qty * unitPrice;
        total += lineTotal;
        await client.query(
          `INSERT INTO quotation_lines (quotation_id, rfq_line_id, unit_price, total_price, lead_time_days, notes)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (quotation_id, rfq_line_id)
           DO UPDATE SET unit_price = EXCLUDED.unit_price, total_price = EXCLUDED.total_price,
                         lead_time_days = EXCLUDED.lead_time_days, notes = EXCLUDED.notes`,
          [quotation.id, line.rfq_line_id, unitPrice, lineTotal, line.lead_time_days || null, line.notes || null]
        );
      }
      await client.query(
        'UPDATE supplier_quotations SET total_amount = $2 WHERE id = $1',
        [quotation.id, total]
      );
      await client.query(
        `UPDATE rfqs SET status = 'responses_open', updated_at = NOW(), updated_by = $2 WHERE id = $1`,
        [rfqId, userId]
      );
      return { ...quotation, total_amount: total };
    });
  }

  async compareQuotations(rfqId) {
    const { rows } = await query(
      `SELECT sq.id, sq.supplier_id, s.name AS supplier_name, sq.total_amount, sq.status,
              json_agg(json_build_object(
                'rfq_line_id', ql.rfq_line_id,
                'unit_price', ql.unit_price,
                'total_price', ql.total_price,
                'lead_time_days', ql.lead_time_days
              ) ORDER BY ql.rfq_line_id) AS lines
       FROM supplier_quotations sq
       JOIN suppliers s ON s.id = sq.supplier_id
       LEFT JOIN quotation_lines ql ON ql.quotation_id = sq.id
       WHERE sq.rfq_id = $1 AND sq.status = 'submitted'
       GROUP BY sq.id, sq.supplier_id, s.name, sq.total_amount, sq.status
       ORDER BY sq.total_amount ASC NULLS LAST`,
      [rfqId]
    );
    return rows;
  }

  async award(rfqId, quotationId, userId) {
    return transaction(async (client) => {
      const { rows: q } = await client.query(
        `SELECT sq.*, r.requisition_id FROM supplier_quotations sq
         JOIN rfqs r ON r.id = sq.rfq_id
         WHERE sq.id = $1 AND sq.rfq_id = $2`,
        [quotationId, rfqId]
      );
      if (!q[0]) throw new Error('Quotation not found');
      const amount = Number(q[0].total_amount || 0);
      await procurementPolicyService.assertEligible(client, userId, {
        amount,
        category: 'other',
        actorUserId: userId
      });
      await client.query(
        `UPDATE supplier_quotations SET status = 'awarded', updated_at = NOW()
         WHERE id = $1`,
        [quotationId]
      );
      await client.query(
        `UPDATE supplier_quotations SET status = 'rejected', updated_at = NOW()
         WHERE rfq_id = $1 AND id != $2 AND status = 'submitted'`,
        [rfqId, quotationId]
      );
      await client.query(
        `UPDATE rfqs SET status = 'awarded', awarded_supplier_id = $2, awarded_quotation_id = $3,
                         updated_at = NOW(), updated_by = $4 WHERE id = $1`,
        [rfqId, q[0].supplier_id, quotationId, userId]
      );
      return { rfq_id: rfqId, awarded_quotation_id: quotationId, supplier_id: q[0].supplier_id, total_amount: amount };
    });
  }
}

export default new RfqService();
