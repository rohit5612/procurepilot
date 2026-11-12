import { query, transaction } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';
import { emitWorkflowEvent, actOnInstance, rawQuery } from '../system/workflowService.js';
import priceListService from './priceListService.js';
import procurementPolicyService from './procurementPolicyService.js';
import supplierQualificationService from './supplierQualificationService.js';

const LATERAL_RECEIVED_GRN = `LEFT JOIN LATERAL (
  SELECT COALESCE(SUM(gl.accepted_qty), 0) AS received_quantity
  FROM goods_receipts grn
  JOIN grn_lines gl ON gl.goods_receipt_id = grn.id
  WHERE grn.purchase_order_id = po.id AND grn.status = 'posted'
) rec ON TRUE`;

class PurchaseOrderService {
  async generatePoNumber(client = null, circleId = null) {
    const q = client ? client.query.bind(client) : query;
    let sql;
    let params;
    if (circleId !== null) {
      sql = 'SELECT generate_po_number($1) AS po_number';
      params = [circleId];
    } else {
      sql = `SELECT generate_po_number((SELECT circle_id FROM purchase_orders WHERE circle_id IS NOT NULL ORDER BY id DESC LIMIT 1)) AS po_number`;
      params = [];
    }
    const res = await q(sql, params);
    return res.rows[0].po_number;
  }

  async getById(poId, client = null, userId = null) {
    const run = client ? client.query.bind(client) : query;
    const sql = `
      SELECT po.*, 
             s.name AS supplier_name,
             s.contact_person AS supplier_contact,
             s.email AS supplier_email,
             s.phone AS supplier_phone,
             s.gst_number AS supplier_gst_number,
             (s.address_line1 || COALESCE(', ' || s.address_line2, '') || COALESCE(', ' || s.city, '') || COALESCE(', ' || s.state, '') || COALESCE(' - ' || s.postal_code, '')) AS supplier_address,
             si.name AS site_name, 
             w.name AS warehouse_name,
             CONCAT_WS(', ', w.address_line1, w.address_line2) AS warehouse_address_line1,
             CONCAT_WS(', ', w.city, w.state, w.postal_code, w.country) AS warehouse_address_line2,
             r.requisition_number AS indent_number,
             r.created_at AS indent_date,
             COALESCE(MAX(rec.received_quantity), 0)::numeric AS received_quantity,
             CASE 
               WHEN COALESCE(MAX(rec.received_quantity), 0) = 0 THEN 'not_received'
               WHEN COALESCE(MAX(rec.received_quantity), 0) < COALESCE(po.total_quantity, 0) THEN 'partially_received'
               ELSE 'fully_received'
             END AS receiving_status,
             CASE 
               WHEN po.status = 'rejected' THEN 'closed'
               WHEN po.receiving_status = 'closed' THEN 'closed'
               WHEN COALESCE(MAX(rec.received_quantity), 0) >= COALESCE(po.total_quantity, 0) THEN 'closed'
               ELSE 'open'
             END AS receiving_phase,
             tc.name AS transaction_category_name,
             json_agg(
               json_build_object(
                 'id', pl.id,
                 'line_number', pl.line_number,
                 'item_id', pl.item_id,
                 'item_code', pl.item_code,
                 'item_name', pl.item_name,
                 'item_description', pl.item_description,
                 'quantity', pl.quantity,
                 'received_quantity', (
                   SELECT COALESCE(SUM(gl.accepted_qty), 0)
                   FROM goods_receipts grn2
                   JOIN grn_lines gl ON gl.goods_receipt_id = grn2.id
                   WHERE grn2.purchase_order_id = po.id AND grn2.status = 'posted' AND gl.po_line_id = pl.id
                 ),
                 'remaining_quantity', GREATEST(pl.quantity - (
                   SELECT COALESCE(SUM(gl.accepted_qty), 0)
                   FROM goods_receipts grn2
                   JOIN grn_lines gl ON gl.goods_receipt_id = grn2.id
                   WHERE grn2.purchase_order_id = po.id AND grn2.status = 'posted' AND gl.po_line_id = pl.id
                 ), 0),
                 'unit_of_measure', pl.unit_of_measure,
                 'unit_price', pl.unit_price,
                 'total_price', pl.total_price,
                 'manufacturer', pl.manufacturer,
                 'spare_type', pl.spare_type,
                 'brand', pl.brand,
                 'model', pl.model,
                 'promised_date', pl.promised_date,
                 'gst_rate', pl.gst_rate,
                 'cgst_rate', pl.cgst_rate,
                 'sgst_rate', pl.sgst_rate,
                 'igst_rate', pl.igst_rate,
                 'cgst_amount', pl.cgst_amount,
                 'sgst_amount', pl.sgst_amount,
                 'igst_amount', pl.igst_amount,
                 'base_amount', pl.base_amount,
                 'hsn_code', i.hsn_code
               ) ORDER BY pl.line_number
             ) FILTER (WHERE pl.id IS NOT NULL) AS lines
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN transaction_categories tc ON tc.id = po.transaction_category_id
      LEFT JOIN sites si ON si.id = po.site_id
      LEFT JOIN warehouses w ON w.id = po.warehouse_id
      LEFT JOIN requisitions r ON r.id = po.requisition_id
      ${LATERAL_RECEIVED_GRN}
      LEFT JOIN po_lines pl ON pl.purchase_order_id = po.id
      LEFT JOIN items i ON i.id = pl.item_id
      WHERE po.id = $1
      GROUP BY po.id, s.name, s.contact_person, s.email, s.phone, s.gst_number, s.address_line1, s.address_line2, s.city, s.state, s.postal_code,
               si.name, w.name, w.address_line1, w.address_line2, w.city, w.state, w.postal_code, w.country,
               tc.name, r.requisition_number, r.created_at
    `;
    const res = await run(sql, [poId]);
    if (res.rows.length === 0) throw new Error('Purchase order not found');
    const po = res.rows[0];
    // Enforce draft visibility for getById if userId provided
    if (userId && po.status === 'draft' && po.created_by !== userId) {
      throw new Error('Purchase order not found');
    }
    return po;
  }

  async list(filters = {}, userId = null) {
    const { whereSql, params, havingSql } = this.#buildFilterClauses(filters, userId);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const offset = Math.max(0, (Number(filters.page || 1) - 1) * limit);
    const includeLines = String(filters.include || '').toLowerCase() === 'lines' || String(filters.lines || '') === 'true';
    let sql;
    if (includeLines) {
      sql = `
        SELECT po.id, po.po_number, po.title, po.status, po.total_amount, po.total_quantity,
               po.supplier_id,
               po.created_at, s.name AS supplier_name,
               tc.name AS transaction_category_name,
               COALESCE(MAX(rec.received_quantity), 0)::numeric AS received_quantity,
               CASE 
                 WHEN COALESCE(MAX(rec.received_quantity), 0) = 0 THEN 'not_received'
                 WHEN COALESCE(MAX(rec.received_quantity), 0) < COALESCE(po.total_quantity, 0) THEN 'partially_received'
                 ELSE 'fully_received'
               END AS receiving_status,
               CASE 
                 WHEN po.status = 'rejected' THEN 'closed'
                 WHEN po.receiving_status = 'closed' THEN 'closed'
                 WHEN COALESCE(MAX(rec.received_quantity), 0) >= COALESCE(po.total_quantity, 0) THEN 'closed'
                 ELSE 'open'
               END AS receiving_phase,
               json_agg(
                 json_build_object(
                   'id', pl.id,
                   'line_number', pl.line_number,
                   'item_id', pl.item_id,
                   'item_code', pl.item_code,
                   'item_name', pl.item_name,
                   'quantity', pl.quantity,
                   'unit_of_measure', pl.unit_of_measure,
                   'unit_price', pl.unit_price,
                   'total_price', pl.total_price,
                   'promised_date', pl.promised_date
                 ) ORDER BY pl.line_number
               ) FILTER (WHERE pl.id IS NOT NULL) AS lines
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id = po.supplier_id
        LEFT JOIN transaction_categories tc ON tc.id = po.transaction_category_id
        ${LATERAL_RECEIVED_GRN}
        LEFT JOIN po_lines pl ON pl.purchase_order_id = po.id
        ${whereSql}
        GROUP BY po.id, s.name, tc.name
        ${havingSql}
        ORDER BY po.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      sql = `
        SELECT po.id, po.po_number, po.title, po.status, po.total_amount, po.total_quantity,
               po.supplier_id,
               po.created_at, s.name AS supplier_name,
               tc.name AS transaction_category_name,
               COALESCE(MAX(rec.received_quantity), 0)::numeric AS received_quantity,
               CASE 
                 WHEN COALESCE(MAX(rec.received_quantity), 0) = 0 THEN 'not_received'
                 WHEN COALESCE(MAX(rec.received_quantity), 0) < COALESCE(po.total_quantity, 0) THEN 'partially_received'
                 ELSE 'fully_received'
               END AS receiving_status,
               CASE 
                 WHEN po.status = 'rejected' THEN 'closed'
                 WHEN po.receiving_status = 'closed' THEN 'closed'
                 WHEN COALESCE(MAX(rec.received_quantity), 0) >= COALESCE(po.total_quantity, 0) THEN 'closed'
                 ELSE 'open'
               END AS receiving_phase
        FROM purchase_orders po
        LEFT JOIN suppliers s ON s.id = po.supplier_id
        LEFT JOIN transaction_categories tc ON tc.id = po.transaction_category_id
        ${LATERAL_RECEIVED_GRN}
        ${whereSql}
        GROUP BY po.id, s.name, tc.name
        ${havingSql}
        ORDER BY po.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    const res = await query(sql, params);
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM purchase_orders po ${whereSql}`, params);
    return { items: res.rows, pagination: { page: Number(filters.page || 1), limit, total: countRes.rows[0].total, totalPages: Math.ceil(countRes.rows[0].total / limit) } };
  }

  async export(filters = {}, userId = null) {
    const { whereSql, params, havingSql } = this.#buildFilterClauses(filters, userId);
    const limit = 5000;
    const sql = `
      SELECT po.id, po.po_number, po.title, po.status, po.total_amount, po.total_quantity,
             po.supplier_id,
             po.created_at, po.issued_at,
             s.name AS supplier_name,
             tc.name AS transaction_category_name,
             COALESCE(MAX(rec.received_quantity), 0)::numeric AS received_quantity,
             CASE 
               WHEN COALESCE(MAX(rec.received_quantity), 0) = 0 THEN 'not_received'
               WHEN COALESCE(MAX(rec.received_quantity), 0) < COALESCE(po.total_quantity, 0) THEN 'partially_received'
               ELSE 'fully_received'
             END AS receiving_status,
             CASE 
               WHEN po.status = 'rejected' THEN 'closed'
               WHEN po.receiving_status = 'closed' THEN 'closed'
               WHEN COALESCE(MAX(rec.received_quantity), 0) >= COALESCE(po.total_quantity, 0) THEN 'closed'
               ELSE 'open'
             END AS receiving_phase
      FROM purchase_orders po
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      LEFT JOIN transaction_categories tc ON tc.id = po.transaction_category_id
      ${LATERAL_RECEIVED_GRN}
      ${whereSql}
      GROUP BY po.id, s.name, tc.name
      ${havingSql}
      ORDER BY po.created_at DESC
      LIMIT ${limit}
    `;
    const res = await query(sql, params);
    return res.rows;
  }

  async generateXlsx() {
    throw new Error('Legacy PO Excel export removed. Use Print preview in the app.');
  }

  async generatePdf() {
    throw new Error('Legacy PO PDF export removed. Use Print preview in the app.');
  }

  async generatePdfWithTerms() {
    throw new Error('Legacy PO PDF export removed. Use Print preview in the app.');
  }

  #buildFilterClauses(filters = {}, userId = null) {
    const where = [];
    const params = [];
    let i = 1;
    if (filters.status) { where.push(`po.status = $${i++}`); params.push(filters.status); }
    if (filters.transaction_category_id) { where.push(`po.transaction_category_id = $${i++}`); params.push(Number(filters.transaction_category_id)); }
    if (filters.supplier_id) { where.push(`po.supplier_id = $${i++}`); params.push(filters.supplier_id); }
    if (filters.search) { where.push(`(po.po_number ILIKE $${i} OR po.title ILIKE $${i})`); params.push(`%${filters.search}%`); i++; }
    if (filters.circle_id) { where.push(`po.circle_id = $${i++}`); params.push(filters.circle_id); }
    if (filters.cluster_id) { where.push(`po.cluster_id = $${i++}`); params.push(filters.cluster_id); }
    // Restrict draft visibility to creator if userId is present
    if (userId) { where.push(`(po.status <> 'draft' OR po.created_by = $${i++})`); params.push(userId); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const receivingFilter = String(filters.receiving || filters.receiving_phase || '').toLowerCase();
    const havingSql = receivingFilter === 'open'
      ? `HAVING (po.status != 'rejected' AND po.receiving_status != 'closed' AND COALESCE(MAX(rec.received_quantity), 0) < COALESCE(po.total_quantity, 0))`
      : receivingFilter === 'closed'
        ? `HAVING (po.status = 'rejected' OR po.receiving_status = 'closed' OR COALESCE(MAX(rec.received_quantity), 0) >= COALESCE(po.total_quantity, 0))`
        : '';
    return { whereSql, params, havingSql };
  }

  async createDirect(payload, userId) {
    return transaction(async (client) => {
      if (!Number.isInteger(Number(payload.transaction_category_id))) {
        throw new Error('transaction_category_id is required');
      }
      // Ensure category exists and active
      const cat = await client.query('SELECT id FROM transaction_categories WHERE id = $1 AND is_active = TRUE', [Number(payload.transaction_category_id)]);
      if (cat.rows.length === 0) throw new Error('Invalid or inactive transaction category');
      const poNumber = await this.generatePoNumber(client, payload.circle_id || null);
      const ins = await client.query(`
        INSERT INTO purchase_orders (
          po_number, title, description, supplier_id, site_id, warehouse_id,
          currency, price_tolerance_percent, promised_date, circle_id, cluster_id, created_by, updated_by
          , transaction_category_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13)
        RETURNING *
      `, [
        poNumber,
        payload.title,
        payload.description || null,
        payload.supplier_id,
        payload.site_id || null,
        payload.warehouse_id || null,
        payload.currency || 'INR',
        payload.price_tolerance_percent || 0,
        payload.promised_date || null,
        payload.circle_id || null,
        payload.cluster_id || null,
        userId,
        Number(payload.transaction_category_id)
      ]);
      const po = ins.rows[0];
      if (Array.isArray(payload.lines)) {
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const line = payload.lines[idx];
          const qty = Math.max(parseFloat(line.quantity) || 0, 0.001);
          let up = parseFloat(line.unit_price) || 0;
          if (!up && payload.supplier_id && line.item_id) {
            const price = await priceListService.getAppliedPriceForSupplierItem(payload.supplier_id, line.item_id);
            if (price && Number(price.unit_price) > 0) {
              up = Number(price.unit_price);
            }
          }
          
          const baseAmt = qty * up;
          const gstRate = parseFloat(line.gst_rate) || 0;
          const cgstRate = parseFloat(line.cgst_rate) || 0;
          const sgstRate = parseFloat(line.sgst_rate) || 0;
          const igstRate = parseFloat(line.igst_rate) || 0;
          const cgstAmt = (baseAmt * cgstRate) / 100;
          const sgstAmt = (baseAmt * sgstRate) / 100;
          const igstAmt = (baseAmt * igstRate) / 100;
          const totalPrice = baseAmt + cgstAmt + sgstAmt + igstAmt;
          
          await client.query(`
            INSERT INTO po_lines (
              purchase_order_id, line_number, requisition_line_id, item_id, item_code, item_name,
              item_description, quantity, unit_of_measure, unit_price, total_price, brand, model, promised_date,
              manufacturer, spare_type, gst_rate, cgst_rate, sgst_rate, igst_rate,
              cgst_amount, sgst_amount, igst_amount, base_amount
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
          `, [
            po.id, idx + 1, line.requisition_line_id || null, line.item_id || null, line.item_code || null,
            line.item_name, line.item_description || null, qty, line.unit_of_measure || 'PCS', up, totalPrice,
            line.brand || null, line.model || null, line.promised_date || null,
            line.manufacturer || null, line.spare_type || null,
            gstRate, cgstRate, sgstRate, igstRate, cgstAmt, sgstAmt, igstAmt, baseAmt
          ]);
        }
      }
      await client.query('SELECT calculate_po_totals($1)', [po.id]);
      await domainEventService.publishEvent('PROCUREMENT.PO_CREATED', po.id.toString(), 'purchase_order', { po_id: po.id, po_number: po.po_number }, { created_by: userId });
      return { ...po, lines: payload.lines || [] };
    });
  }

  async createFromRequisition(requisitionId, payload, userId) {
    // Minimal: use provided lines, link requisition_id
    return transaction(async (client) => {
      if (!Number.isInteger(Number(payload.transaction_category_id))) {
        throw new Error('transaction_category_id is required');
      }
      const cat = await client.query('SELECT id FROM transaction_categories WHERE id = $1 AND is_active = TRUE', [Number(payload.transaction_category_id)]);
      if (cat.rows.length === 0) throw new Error('Invalid or inactive transaction category');
      // Ensure requisition is approved
      const chk = await client.query(`SELECT status, circle_id, cluster_id FROM requisitions WHERE id = $1`, [requisitionId]);
      if (chk.rows.length === 0) throw new Error('Requisition not found');
      if (chk.rows[0].status !== 'approved') throw new Error('Only approved requisitions can be converted to PO');

      const poNumber = await this.generatePoNumber(client, (payload.circle_id ?? chk.rows[0].circle_id) || null);
      const ins = await client.query(`
        INSERT INTO purchase_orders (
          po_number, title, description, requisition_id, supplier_id, site_id, warehouse_id,
          currency, promised_date, circle_id, cluster_id, created_by, updated_by, transaction_category_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13) RETURNING *
      `, [
        poNumber, payload.title, payload.description || null, requisitionId,
        payload.supplier_id, payload.site_id || null, payload.warehouse_id || null,
        payload.currency || 'INR', payload.promised_date || null,
        // Default circle/cluster from PR unless explicitly overridden
        payload.circle_id ?? chk.rows[0].circle_id,
        payload.cluster_id ?? chk.rows[0].cluster_id,
        userId,
        Number(payload.transaction_category_id)
      ]);
      const po = ins.rows[0];
      if (Array.isArray(payload.lines)) {
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const line = payload.lines[idx];
          const qty = Math.max(parseFloat(line.quantity) || 0, 0.001);
          let up = parseFloat(line.unit_price) || 0;
          if (!up && payload.supplier_id && line.item_id) {
            const price = await priceListService.getAppliedPriceForSupplierItem(payload.supplier_id, line.item_id);
            if (price && Number(price.unit_price) > 0) {
              up = Number(price.unit_price);
            }
          }
          
          const baseAmt = qty * up;
          const gstRate = parseFloat(line.gst_rate) || 0;
          const cgstRate = parseFloat(line.cgst_rate) || 0;
          const sgstRate = parseFloat(line.sgst_rate) || 0;
          const igstRate = parseFloat(line.igst_rate) || 0;
          const cgstAmt = (baseAmt * cgstRate) / 100;
          const sgstAmt = (baseAmt * sgstRate) / 100;
          const igstAmt = (baseAmt * igstRate) / 100;
          const totalPrice = baseAmt + cgstAmt + sgstAmt + igstAmt;
          
          await client.query(`
            INSERT INTO po_lines (
              purchase_order_id, line_number, requisition_line_id, item_id, item_code, item_name,
              item_description, quantity, unit_of_measure, unit_price, total_price, brand, model, promised_date,
              manufacturer, spare_type, gst_rate, cgst_rate, sgst_rate, igst_rate,
              cgst_amount, sgst_amount, igst_amount, base_amount
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
          `, [
            po.id, idx + 1, line.requisition_line_id || null, line.item_id || null, line.item_code || null,
            line.item_name, line.item_description || null, qty, line.unit_of_measure || 'PCS', up, totalPrice,
            line.brand || null, line.model || null, line.promised_date || null,
            line.manufacturer || null, line.spare_type || null,
            gstRate, cgstRate, sgstRate, igstRate, cgstAmt, sgstAmt, igstAmt, baseAmt
          ]);
        }
      }
      await client.query('SELECT calculate_po_totals($1)', [po.id]);
      await domainEventService.publishEvent('PROCUREMENT.PO_CREATED', po.id.toString(), 'purchase_order', { po_id: po.id, po_number: po.po_number, requisition_id: requisitionId }, { created_by: userId });
      return { ...po, lines: payload.lines || [] };
    });
  }

  async submit(poId, userId) {
    return transaction(async (client) => {
      const pre = await client.query(
        `SELECT id, status, created_by, total_amount, requisition_id, supplier_id
         FROM purchase_orders WHERE id = $1 FOR UPDATE`,
        [poId]
      );
      if (pre.rows.length === 0) throw new Error('Purchase order not found');
      if (pre.rows[0].status !== 'draft') throw new Error('Purchase order not found or cannot be submitted');
      const prePo = pre.rows[0];
      const ownerId = prePo.created_by || userId;
      const totalAmount = Number(prePo.total_amount || 0);

      await supplierQualificationService.assertSupplierQualified(client, prePo.supplier_id);
      await procurementPolicyService.assertEligible(client, ownerId, {
        amount: totalAmount,
        category: 'other',
        actorUserId: userId
      });

      const upd = await client.query(`
        UPDATE purchase_orders SET status = 'pending_approval', submitted_at = NOW(), submitted_by = $1, updated_at = NOW(), updated_by = $1
        WHERE id = $2 AND status = 'draft' RETURNING *
      `, [userId, poId]);
      if (upd.rows.length === 0) throw new Error('Purchase order not found or cannot be submitted');
      const po = upd.rows[0];

      const skipReserve = await procurementPolicyService.hasCommittedParentRequisition(
        client,
        po.requisition_id
      );
      if (!skipReserve) {
        await procurementPolicyService.reserveForDocument(client, ownerId, {
          referenceType: 'purchase_order',
          referenceId: poId,
          amount: totalAmount,
          category: 'other',
          actorUserId: userId
        });
      }

      // Mark the requisition as closed for PO generation
      if (po.requisition_id) {
        await client.query(`
          UPDATE requisitions 
          SET is_po_generated = TRUE, updated_at = NOW()
          WHERE id = $1
        `, [po.requisition_id]);
      }

      // Get complete PO data with JOINs for workflow
      const completeDataQuery = `
        SELECT 
          po.id, po.po_number, po.title, po.description, po.supplier_id, 
          po.total_amount, po.total_quantity, po.created_by,
          po.site_id, po.circle_id, po.cluster_id, po.requisition_id,
          s.name as supplier_name,
          u.first_name || ' ' || u.last_name as requester_name,
          st.name as site_name,
          r.department_id,
          d.name as department_name,
          r.project_id,
          (SELECT COUNT(*) FROM po_lines WHERE purchase_order_id = po.id) as item_count
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u ON po.created_by = u.id
        LEFT JOIN sites st ON po.site_id = st.id
        LEFT JOIN requisitions r ON po.requisition_id = r.id
        LEFT JOIN departments d ON r.department_id = d.id
        WHERE po.id = $1
      `;
      
      const completeDataResult = await client.query(completeDataQuery, [poId]);
      const completePO = completeDataResult.rows[0];

      // Workflow
      let wfInfo = null;
      try {
        const featureRes = await rawQuery(`SELECT id FROM features WHERE name = 'purchase_order' LIMIT 1`);
        const featureId = featureRes.rows[0]?.id;
        if (!featureId) throw new Error('purchase_order feature not found');
        const wf = await emitWorkflowEvent({ 
          featureId, 
          event: 'onStatusChange', 
          entityId: poId, 
          entityType: 'purchase_order', 
          data: { 
            poId, 
            poNumber: completePO.po_number,
            title: completePO.title,
            description: completePO.description,
            supplierId: completePO.supplier_id,
            supplierName: completePO.supplier_name,
            totalAmount: Number(completePO.total_amount || 0),
            itemCount: Number(completePO.item_count || 0),
            departmentId: completePO.department_id,
            departmentName: completePO.department_name,
            siteId: completePO.site_id,
            siteName: completePO.site_name,
            projectId: completePO.project_id,
            projectName: completePO.project_id ? `Project ${completePO.project_id}` : null,
            circleId: completePO.circle_id,
            clusterId: completePO.cluster_id,
            createdBy: completePO.created_by,
            requesterName: completePO.requester_name
          }, 
          actorId: userId 
        });
        if (wf?.instanceId) {
          await client.query('UPDATE purchase_orders SET workflow_instance_id = $1 WHERE id = $2', [wf.instanceId, poId]);
          wfInfo = { bound: true, instance_id: wf.instanceId };
        }
      } catch (e) {
        console.warn('PO workflow creation failed:', e.message);
        wfInfo = { bound: false, message: 'No active workflow binding found for purchase_order; submission will not create approval tasks.' };
      }

      await domainEventService.publishEvent('PROCUREMENT.PO_SUBMITTED', poId.toString(), 'purchase_order', {
        po_id: poId,
        po_number: completePO?.po_number,
        total_amount: Number(completePO?.total_amount || 0),
        created_by: completePO?.created_by,
        department_id: completePO?.department_id
      }, { submitted_by: userId });
      return { ...po, _workflow: wfInfo };
    });
  }

  async approve(poId, userId, comment = 'Approved') {
    return transaction(async (client) => {
      const upd = await client.query(`
        UPDATE purchase_orders SET status = 'approved', approved_at = NOW(), approved_by = $1, updated_at = NOW(), updated_by = $1
        WHERE id = $2 AND status = 'pending_approval' RETURNING *
      `, [userId, poId]);
      if (upd.rows.length === 0) throw new Error('Purchase order not found or cannot be approved');
      const po = upd.rows[0];
      const skipCommit = await procurementPolicyService.hasCommittedParentRequisition(client, po.requisition_id);
      if (!skipCommit) {
        await procurementPolicyService.commitDocument(client, 'purchase_order', poId, userId);
      }
      if (po.workflow_instance_id) {
        try { await actOnInstance({ instanceId: po.workflow_instance_id, actorId: userId, action: 'approve', comment }); } catch (e) { console.warn('PO workflow approve failed:', e.message); }
      }
      await domainEventService.publishEvent('PROCUREMENT.PO_APPROVED', poId.toString(), 'purchase_order', {
        po_id: poId,
        po_number: po.po_number,
        created_by: po.created_by,
        total_amount: Number(po.total_amount || 0)
      }, { approved_by: userId });
      return po;
    });
  }

  async issue(poId, userId) {
    return transaction(async (client) => {
      const pre = await client.query(
        `SELECT id, status, created_by, total_amount, supplier_id FROM purchase_orders WHERE id = $1 FOR UPDATE`,
        [poId]
      );
      if (pre.rows.length === 0 || pre.rows[0].status !== 'approved') {
        throw new Error('Purchase order not found or cannot be issued');
      }
      const prePo = pre.rows[0];
      await supplierQualificationService.assertSupplierQualified(client, prePo.supplier_id);
      await procurementPolicyService.assertEligible(client, prePo.created_by || userId, {
        amount: Number(prePo.total_amount || 0),
        category: 'other',
        actorUserId: userId
      });

      const upd = await client.query(`
        UPDATE purchase_orders SET status = 'issued', receiving_status = 'open', issued_at = NOW(), issued_by = $1, updated_at = NOW(), updated_by = $1
        WHERE id = $2 AND status = 'approved' RETURNING *
      `, [userId, poId]);
      if (upd.rows.length === 0) throw new Error('Purchase order not found or cannot be issued');
      const po = upd.rows[0];
      await domainEventService.publishEvent('PROCUREMENT.PO_ISSUED', poId.toString(), 'purchase_order', { po_id: poId }, { issued_by: userId });

      return po;
    });
  }

  async delete(poId, userId) {
    return transaction(async (client) => {
      const check = await client.query('SELECT status FROM purchase_orders WHERE id = $1', [poId]);
      if (check.rows.length === 0) throw new Error('Purchase order not found');
      if (check.rows[0].status !== 'draft') throw new Error('Only draft purchase orders can be deleted');
      
      // Delete PO lines first
      await client.query('DELETE FROM po_lines WHERE purchase_order_id = $1', [poId]);
      
      // Delete PO
      await client.query('DELETE FROM purchase_orders WHERE id = $1', [poId]);
      
      await domainEventService.publishEvent('PROCUREMENT.PO_DELETED', poId.toString(), 'purchase_order', { po_id: poId }, { deleted_by: userId });
      return { deleted: true };
    });
  }

  async withdraw(poId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status, workflow_instance_id FROM purchase_orders WHERE id = $1 FOR UPDATE', [poId]);
      if (rows.length === 0) throw new Error('Purchase order not found');
      const po = rows[0];
      if (!['draft', 'pending_approval'].includes(po.status)) {
        throw new Error('Only draft or pending approval POs can be withdrawn');
      }

      const { rows: upd } = await client.query(
        `UPDATE purchase_orders
         SET status = 'withdrawn',
             receiving_status = 'closed',
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
         RETURNING *`,
        [poId, userId]
      );

      if (po.workflow_instance_id) {
        try {
          const { actOnInstance } = await import('../system/workflowService.js');
          await actOnInstance({
            instanceId: po.workflow_instance_id,
            actorId: userId,
            action: 'withdraw',
            comment: 'PO withdrawn by creator'
          });
        } catch (e) {
          console.warn('Workflow withdraw failed:', e.message);
        }
      }

      const { rows: fullPo } = await client.query(
        'SELECT requisition_id FROM purchase_orders WHERE id = $1',
        [poId]
      );
      const skipRelease = await procurementPolicyService.hasCommittedParentRequisition(
        client,
        fullPo[0]?.requisition_id
      );
      if (!skipRelease) {
        await procurementPolicyService.releaseDocument(client, 'purchase_order', poId, userId);
      }

      await domainEventService.publishEvent('PROCUREMENT.PO.WITHDRAWN', poId.toString(), 'purchase_order', { po_id: poId }, { withdrawn_by: userId });
      return upd[0];
    });
  }

  async cancelIssued(poId, userId, reason = 'Cancelled') {
    return transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT id, status, po_number FROM purchase_orders WHERE id = $1 FOR UPDATE`,
        [poId]
      );
      if (rows.length === 0) throw new Error('Purchase order not found');
      const po = rows[0];
      if (po.status !== 'issued') {
        throw new Error('Only issued purchase orders can be cancelled');
      }
      const grn = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM goods_receipts
         WHERE purchase_order_id = $1 AND status = 'posted'`,
        [poId]
      );
      if (Number(grn.rows[0]?.cnt || 0) > 0) {
        throw new Error('Cannot cancel PO with posted goods receipts');
      }
      const { rows: upd } = await client.query(
        `UPDATE purchase_orders
         SET status = 'closed', receiving_status = 'closed', rejection_reason = $2,
             updated_at = NOW(), updated_by = $3
         WHERE id = $1
         RETURNING *`,
        [poId, reason, userId]
      );
      await domainEventService.publishEvent(
        'PROCUREMENT.PO_CANCELLED',
        poId.toString(),
        'purchase_order',
        { po_id: poId, po_number: po.po_number, reason },
        { cancelled_by: userId }
      );
      return upd[0];
    });
  }

  async amendIssued(poId, payload, userId, reason = 'Amendment') {
    return transaction(async (client) => {
      const { rows: poRows } = await client.query(
        `SELECT * FROM purchase_orders WHERE id = $1 FOR UPDATE`,
        [poId]
      );
      if (poRows.length === 0) throw new Error('Purchase order not found');
      const po = poRows[0];
      if (!['issued', 'approved'].includes(po.status)) {
        throw new Error('Only approved or issued POs can be amended');
      }
      const { rows: lineRows } = await client.query(
        'SELECT * FROM po_lines WHERE purchase_order_id = $1 ORDER BY line_number',
        [poId]
      );
      const { rows: amendCount } = await client.query(
        'SELECT COALESCE(MAX(amendment_number), 0) + 1 AS next_no FROM po_amendments WHERE purchase_order_id = $1',
        [poId]
      );
      const amendmentNumber = Number(amendCount[0]?.next_no || 1);
      await client.query(
        `INSERT INTO po_amendments (purchase_order_id, amendment_number, reason, snapshot_json, created_by)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [
          poId,
          amendmentNumber,
          reason,
          JSON.stringify({ header: po, lines: lineRows }),
          userId
        ]
      );
      await client.query(
        `UPDATE purchase_orders SET updated_at = NOW(), updated_by = $2 WHERE id = $1`,
        [poId, userId]
      );
      if (Array.isArray(payload.lines)) {
        await client.query('DELETE FROM po_lines WHERE purchase_order_id = $1', [poId]);
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const line = payload.lines[idx];
          const qty = Math.max(parseFloat(line.quantity) || 0, 0.001);
          const up = Math.max(parseFloat(line.unit_price) || 0, 0);
          const baseAmt = qty * up;
          const gstRate = parseFloat(line.gst_rate) || 0;
          const cgstRate = parseFloat(line.cgst_rate) || 0;
          const sgstRate = parseFloat(line.sgst_rate) || 0;
          const igstRate = parseFloat(line.igst_rate) || 0;
          const cgstAmt = (baseAmt * cgstRate) / 100;
          const sgstAmt = (baseAmt * sgstRate) / 100;
          const igstAmt = (baseAmt * igstRate) / 100;
          const totalPrice = baseAmt + cgstAmt + sgstAmt + igstAmt;
          await client.query(
            `INSERT INTO po_lines (
              purchase_order_id, line_number, requisition_line_id, item_id, item_code, item_name,
              item_description, quantity, unit_of_measure, unit_price, total_price, brand, model, promised_date,
              manufacturer, spare_type, gst_rate, cgst_rate, sgst_rate, igst_rate,
              cgst_amount, sgst_amount, igst_amount, base_amount
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
            [
              poId, idx + 1, line.requisition_line_id || null, line.item_id || null, line.item_code || null,
              line.item_name, line.item_description || null, qty, line.unit_of_measure || 'PCS', up, totalPrice,
              line.brand || null, line.model || null, line.promised_date || null,
              line.manufacturer || null, line.spare_type || null,
              gstRate, cgstRate, sgstRate, igstRate, cgstAmt, sgstAmt, igstAmt, baseAmt
            ]
          );
        }
        await client.query('SELECT calculate_po_totals($1)', [poId]);
      }
      const { rows: out } = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
      return { amendment_number: amendmentNumber, purchase_order: out[0] };
    });
  }

  async update(poId, payload, userId) {
    return transaction(async (client) => {
      // Only allow updates in draft
      const { rows: chk } = await client.query('SELECT status FROM purchase_orders WHERE id = $1 FOR UPDATE', [poId]);
      if (chk.length === 0) throw new Error('Purchase order not found');
      if (chk[0].status !== 'draft') throw new Error('Only draft purchase orders can be updated');

      // Update header fields
      const fields = [];
      const params = [];
      let i = 1;
      const setField = (col, val) => { fields.push(`${col} = $${i}`); params.push(val); i++; };
      if (payload.title != null) setField('title', payload.title);
      if (payload.description != null) setField('description', payload.description);
      if (payload.supplier_id != null) setField('supplier_id', Number(payload.supplier_id));
      if (payload.site_id != null) setField('site_id', Number(payload.site_id));
      if (payload.warehouse_id != null) setField('warehouse_id', Number(payload.warehouse_id));
      if (payload.currency != null) setField('currency', String(payload.currency));
      if (payload.promised_date != null) setField('promised_date', payload.promised_date);
      if (payload.circle_id != null) setField('circle_id', Number(payload.circle_id));
      if (payload.cluster_id != null) setField('cluster_id', Number(payload.cluster_id));
      // audit
      setField('updated_at', new Date());
      setField('updated_by', userId);
      if (fields.length) {
        await client.query(`UPDATE purchase_orders SET ${fields.join(', ')} WHERE id = $${i}`, [...params, poId]);
      }

      // Replace lines if provided
      if (Array.isArray(payload.lines)) {
        await client.query('DELETE FROM po_lines WHERE purchase_order_id = $1', [poId]);
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const line = payload.lines[idx];
          const qty = Math.max(parseFloat(line.quantity) || 0, 0.001);
          const up = Math.max(parseFloat(line.unit_price) || 0, 0);
          const baseAmt = qty * up;
          const gstRate = parseFloat(line.gst_rate) || 0;
          const cgstRate = parseFloat(line.cgst_rate) || 0;
          const sgstRate = parseFloat(line.sgst_rate) || 0;
          const igstRate = parseFloat(line.igst_rate) || 0;
          const cgstAmt = (baseAmt * cgstRate) / 100;
          const sgstAmt = (baseAmt * sgstRate) / 100;
          const igstAmt = (baseAmt * igstRate) / 100;
          const totalPrice = baseAmt + cgstAmt + sgstAmt + igstAmt;
          await client.query(`
            INSERT INTO po_lines (
              purchase_order_id, line_number, requisition_line_id, item_id, item_code, item_name,
              item_description, quantity, unit_of_measure, unit_price, total_price, brand, model, promised_date,
              manufacturer, spare_type, gst_rate, cgst_rate, sgst_rate, igst_rate,
              cgst_amount, sgst_amount, igst_amount, base_amount
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
          `, [
            poId, idx + 1, line.requisition_line_id || null, line.item_id || null, line.item_code || null,
            line.item_name, line.item_description || null, qty, line.unit_of_measure || 'PCS', up, totalPrice,
            line.brand || null, line.model || null, line.promised_date || null,
            line.manufacturer || null, line.spare_type || null,
            gstRate, cgstRate, sgstRate, igstRate, cgstAmt, sgstAmt, igstAmt, baseAmt
          ]);
        }
      }

      await client.query('SELECT calculate_po_totals($1)', [poId]);
      const { rows: out } = await client.query('SELECT * FROM purchase_orders WHERE id = $1', [poId]);
      return out[0];
    });
  }

  async reject(poId, userId, reason = 'Rejected') {
    return transaction(async (client) => {
      const upd = await client.query(`
        UPDATE purchase_orders SET status = 'rejected', receiving_status = 'closed', rejected_at = NOW(), rejected_by = $1, rejection_reason = $2, updated_at = NOW(), updated_by = $1
        WHERE id = $3 AND status = 'pending_approval' RETURNING *
      `, [userId, reason || 'Rejected', poId]);
      if (upd.rows.length === 0) throw new Error('Purchase order not found or cannot be rejected');
      const po = upd.rows[0];
      const skipRelease = await procurementPolicyService.hasCommittedParentRequisition(client, po.requisition_id);
      if (!skipRelease) {
        await procurementPolicyService.releaseDocument(client, 'purchase_order', poId, userId);
      }
      if (po.workflow_instance_id) {
        try { await actOnInstance({ instanceId: po.workflow_instance_id, actorId: userId, action: 'reject', comment: reason }); } catch (e) { console.warn('PO workflow reject failed:', e.message); }
      }
      await domainEventService.publishEvent('PROCUREMENT.PO_REJECTED', poId.toString(), 'purchase_order', {
        po_id: poId,
        po_number: po.po_number,
        created_by: po.created_by,
        reason
      }, { rejected_by: userId, reason });
      return po;
    });
  }

  // Update receiving status based on GRN quantities
  async updateReceivingStatus(poId) {
    return transaction(async (client) => {
      const result = await client.query(
        `SELECT id, total_quantity, status FROM purchase_orders WHERE id = $1`,
        [poId]
      );

      if (result.rows.length === 0) throw new Error('Purchase order not found');

      const po = result.rows[0];
      let newReceivingStatus = 'not_started';

      if (po.status === 'rejected') {
        newReceivingStatus = 'closed';
      } else if (po.status === 'issued') {
        newReceivingStatus = 'open';
      }

      await client.query(`
        UPDATE purchase_orders 
        SET receiving_status = $1, updated_at = NOW()
        WHERE id = $2
      `, [newReceivingStatus, poId]);

      return { poId, receiving_status: newReceivingStatus };
    });
  }
}

export default new PurchaseOrderService();


