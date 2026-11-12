import { query, transaction } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';
import { emitWorkflowEvent, rawQuery } from '../system/workflowService.js';
/** ProcurePilot: skip stock layers until inventory module is enabled (default true). */
const SKIP_INVENTORY_ON_GRN_POST = process.env.PROCUREPILOT_GRN_SKIP_INVENTORY !== 'false';

class GoodsReceiptService {
  async #syncPoReceivingState(client, poId, userId) {
    const { rows: poRows } = await client.query(
      'SELECT id, status, total_quantity FROM purchase_orders WHERE id = $1 FOR UPDATE',
      [poId]
    );
    if (poRows.length === 0) return;
    const po = poRows[0];
    if (!['issued', 'closed'].includes(po.status)) return;

    const { rows: sumRows } = await client.query(`
      SELECT COALESCE(SUM(gl.accepted_qty), 0)::numeric AS received
      FROM goods_receipts grn2
      JOIN grn_lines gl ON gl.goods_receipt_id = grn2.id
      WHERE grn2.purchase_order_id = $1 AND grn2.status = 'posted'
    `, [poId]);
    const totalReceived = Number(sumRows[0]?.received || 0);
    const totalOrdered = Number(po.total_quantity || 0);
    const epsilon = 1e-6;

    if (totalOrdered > 0 && totalReceived + epsilon >= totalOrdered) {
      await client.query(`
        UPDATE purchase_orders
        SET status = CASE WHEN status = 'issued' THEN 'closed'::po_status ELSE status END,
            receiving_status = 'closed',
            is_closed = true,
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1
      `, [poId, userId]);
    } else if (totalReceived > 0) {
      await client.query(`
        UPDATE purchase_orders
        SET receiving_status = 'open',
            updated_at = NOW(),
            updated_by = $2
        WHERE id = $1 AND status = 'issued'
      `, [poId, userId]);
    }
  }
  async generateGrnNumber(client = null, circleId = null, clusterId = null) {
    const run = client ? client.query.bind(client) : query;
    let sql;
    let params;
    if (circleId !== null || clusterId !== null) {
      sql = 'SELECT generate_grn_number($1,$2) AS grn_number';
      params = [circleId, clusterId];
    } else {
      sql = `SELECT generate_grn_number(
               (SELECT circle_id FROM goods_receipts WHERE circle_id IS NOT NULL ORDER BY id DESC LIMIT 1),
               (SELECT cluster_id FROM goods_receipts WHERE cluster_id IS NOT NULL ORDER BY id DESC LIMIT 1)
             ) AS grn_number`;
      params = [];
    }
    const res = await run(sql, params);
    return res.rows[0].grn_number;
  }

  async create(payload, userId) {
    return transaction(async (client) => {
      const grnNumber = await this.generateGrnNumber(client, payload.circle_id || null, payload.cluster_id || null);
      let ins;
      try {
        ins = await client.query(`
          INSERT INTO goods_receipts (
            grn_number, purchase_order_id, supplier_id, site_id, warehouse_id, bin_id, remarks, circle_id, cluster_id, created_by, updated_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING *
        `, [
          grnNumber,
          payload.purchase_order_id,
          payload.supplier_id,
          payload.site_id || null,
          payload.warehouse_id || null,
          payload.bin_id || null,
          payload.remarks || null,
          payload.circle_id || null,
          payload.cluster_id || null,
          userId
        ]);
      } catch (e) {
        if (String(e.message || '').includes('column "bin_id" of relation "goods_receipts" does not exist')) {
          ins = await client.query(`
            INSERT INTO goods_receipts (
              grn_number, purchase_order_id, supplier_id, site_id, warehouse_id, remarks, circle_id, cluster_id, created_by, updated_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *
          `, [
            grnNumber,
            payload.purchase_order_id,
            payload.supplier_id,
            payload.site_id || null,
            payload.warehouse_id || null,
            payload.remarks || null,
            payload.circle_id || null,
            payload.cluster_id || null,
            userId
          ]);
        } else {
          throw e;
        }
      }
      const grn = ins.rows[0];
      if (Array.isArray(payload.lines)) {
        // Resolve po_line_id for each item if missing
        let poLineByItemId = new Map();
        try {
          if (payload.purchase_order_id) {
            const { rows: polRows } = await client.query('SELECT id, item_id FROM po_lines WHERE purchase_order_id = $1', [payload.purchase_order_id]);
            poLineByItemId = new Map(polRows.filter(r => r.item_id != null).map(r => [String(r.item_id), Number(r.id)]));
          }
        } catch {}
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const l = payload.lines[idx];
          const received = Math.max(parseFloat(l.received_qty) || 0, 0);
          const accepted = Math.max(parseFloat(l.accepted_qty) || 0, 0);
          const rejected = Math.max(parseFloat(l.rejected_qty) || 0, 0);
          const resolvedPoLineId = (l.po_line_id != null && Number(l.po_line_id))
            ? Number(l.po_line_id)
            : (l.item_id != null && poLineByItemId.has(String(l.item_id)) ? poLineByItemId.get(String(l.item_id)) : null);

          // Compute snapshot values from PO
          let qtyOrdered = null;
          let alreadyPosted = null;
          let expectedSnap = null;
          if (resolvedPoLineId) {
            try {
              const qOrd = await client.query('SELECT quantity FROM po_lines WHERE id = $1', [resolvedPoLineId]);
              qtyOrdered = Number(qOrd.rows?.[0]?.quantity || 0);
              const qRec = await client.query(`
                SELECT COALESCE(SUM(gl.accepted_qty), 0)::numeric AS posted_accepted
                FROM goods_receipts grn2
                JOIN grn_lines gl ON gl.goods_receipt_id = grn2.id
                WHERE grn2.purchase_order_id = $1 AND grn2.status = 'posted' AND gl.po_line_id = $2
              `, [payload.purchase_order_id, resolvedPoLineId]);
              alreadyPosted = Number(qRec.rows?.[0]?.posted_accepted || 0);
              expectedSnap = Math.max(qtyOrdered - alreadyPosted, 0);
            } catch {}
          }
          // Try insert with snapshot columns if available
          try {
            await client.query(`
              INSERT INTO grn_lines (
                goods_receipt_id, line_number, po_line_id, item_id, item_code, item_name,
                received_qty, accepted_qty, rejected_qty, unit_of_measure, unit_price, lot_number, serial_numbers,
                manufacturer, spare_type,
                qty_as_per_po_snapshot, already_received_snapshot, expected_qty_snapshot
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            `, [
              grn.id, idx + 1, resolvedPoLineId, l.item_id || null, l.item_code || null, l.item_name,
              received, accepted, rejected, l.unit_of_measure || 'PCS', parseFloat(l.unit_price) || 0,
              l.lot_number || null, Array.isArray(l.serial_numbers) ? l.serial_numbers.join(',') : (l.serial_numbers || null),
              l.manufacturer || null, l.spare_type || null,
              qtyOrdered, alreadyPosted, expectedSnap
            ]);
          } catch (e) {
            if (String(e.message || '').includes('column') && String(e.message || '').includes('qty_as_per_po_snapshot')) {
              // Fallback without snapshot columns
              await client.query(`
                INSERT INTO grn_lines (
                  goods_receipt_id, line_number, po_line_id, item_id, item_code, item_name,
                  received_qty, accepted_qty, rejected_qty, unit_of_measure, unit_price, lot_number, serial_numbers,
                  manufacturer, spare_type
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
              `, [
                grn.id, idx + 1, resolvedPoLineId, l.item_id || null, l.item_code || null, l.item_name,
                received, accepted, rejected, l.unit_of_measure || 'PCS', parseFloat(l.unit_price) || 0,
                l.lot_number || null, Array.isArray(l.serial_numbers) ? l.serial_numbers.join(',') : (l.serial_numbers || null),
                l.manufacturer || null, l.spare_type || null
              ]);
            } else {
              throw e;
            }
          }
        }
      }
      await domainEventService.publishEvent('PROCUREMENT.GRN_CREATED', grn.id.toString(), 'goods_receipt', { grn_id: grn.id, grn_number: grn.grn_number }, { created_by: userId });
      return grn;
    });
  }

  async post(grnId, userId) {
    return transaction(async (client) => {
      // Load GRN in approved state (posting is allowed only after approval)
      const { rows: grnRows } = await client.query("SELECT * FROM goods_receipts WHERE id = $1 AND status = 'approved' FOR UPDATE", [grnId]);
      if (grnRows.length === 0) throw new Error('GRN not found or cannot be posted');
      const grn = grnRows[0];

      // Validate PO status and receiving openness
      const { rows: poRows } = await client.query('SELECT id, status, total_quantity FROM purchase_orders WHERE id = $1 FOR UPDATE', [grn.purchase_order_id]);
      if (poRows.length === 0) throw new Error('Linked PO not found');
      const po = poRows[0];
      if (po.status !== 'issued') throw new Error('Only issued POs can be received');

      // Load current GRN lines
      const { rows: grnLines } = await client.query('SELECT id, po_line_id, item_id, item_name, accepted_qty FROM grn_lines WHERE goods_receipt_id = $1', [grnId]);
      if (grnLines.length === 0) throw new Error('No lines to post');

      // Sum of already posted accepted qty per po_line_id for this PO
      const { rows: postedSums } = await client.query(`
        SELECT gl.po_line_id, COALESCE(SUM(gl.accepted_qty), 0)::numeric AS posted_accepted
        FROM goods_receipts grn2
        JOIN grn_lines gl ON gl.goods_receipt_id = grn2.id
        WHERE grn2.purchase_order_id = $1 AND grn2.status = 'posted'
        GROUP BY gl.po_line_id
      `, [grn.purchase_order_id]);
      const postedByLine = new Map(postedSums.map(r => [String(r.po_line_id), Number(r.posted_accepted || 0)]));

      // Ordered quantities per po_line
      const { rows: poLines } = await client.query('SELECT id, line_number, quantity FROM po_lines WHERE purchase_order_id = $1', [grn.purchase_order_id]);
      const orderedByLine = new Map(poLines.map(r => [String(r.id), Number(r.quantity || 0)]));
      const lineNumById = new Map(poLines.map(r => [String(r.id), Number(r.line_number || 0)]));

      // Validate over-receipt per line (allow exactly remaining; block only strictly greater)
      const epsilon = 1e-6; // quantities are up to 3 decimals; epsilon guards float rounding
      for (const l of grnLines) {
        if (!l.po_line_id) continue; // If not linked, skip strict validation
        const ordered = orderedByLine.get(String(l.po_line_id)) || 0;
        const already = postedByLine.get(String(l.po_line_id)) || 0;
        const incoming = Number(l.accepted_qty || 0);
        if ((already + incoming) - ordered > epsilon) {
          const ln = lineNumById.get(String(l.po_line_id)) || '?';
          throw new Error(`Over-receipt on PO line ${ln}: ordered ${ordered}, already received ${already}, incoming ${incoming}`);
        }
      }

      // Optional inventory posting (disabled in ProcurePilot until inventory is live)
      if (!SKIP_INVENTORY_ON_GRN_POST) {
      for (const line of grnLines) {
        if (Number(line.accepted_qty) > 0) {
          // Determine landed unit cost (base + GST per unit)
          // 1) Start with GRN line unit_price if present (base, without GST)
          // 2) If missing/zero and linked to PO line, derive base from PO (unit_price or total/qty)
          // 3) Add GST per unit from PO: (cgst+sgst+igst)/qty, else unit_base * (gst_rate/100)
          const qty = Number(line.accepted_qty);
          let baseUnit = Number(line.unit_price || 0);
          let gstPerUnit = 0;
          if ((!(baseUnit > 0) || !Number.isFinite(baseUnit)) && line.po_line_id) {
            const { rows: poLineRows } = await client.query('SELECT unit_price, total_price, quantity, gst_rate, cgst_amount, sgst_amount, igst_amount, base_amount FROM po_lines WHERE id = $1', [line.po_line_id]);
            const pol = poLineRows[0] || {};
            const polQty = Number(pol.quantity || 0);
            // Prefer base_amount if populated, else unit_price, else total/qty
            const polBase = Number(pol.base_amount || 0);
            const polUnit = Number(pol.unit_price || 0);
            const polTotal = Number(pol.total_price || 0);
            // Per-unit base precedence: unit_price > base_amount/qty > total_price/qty
            baseUnit = (polUnit > 0
              ? polUnit
              : (polBase > 0 && polQty > 0
                  ? (polBase / polQty)
                  : (polQty > 0 && polTotal > 0 ? (polTotal / polQty) : 0)));
            const taxTotal = Number(pol.cgst_amount || 0) + Number(pol.sgst_amount || 0) + Number(pol.igst_amount || 0);
            if (taxTotal > 0 && polQty > 0) {
              gstPerUnit = taxTotal / polQty;
            } else if (Number(pol.gst_rate || 0) > 0) {
              gstPerUnit = baseUnit * (Number(pol.gst_rate) / 100);
            }
          } else if (line.po_line_id) {
            // We have a baseUnit from GRN; still add GST per unit from PO if available
            const { rows: poLineRows } = await client.query('SELECT quantity, gst_rate, cgst_amount, sgst_amount, igst_amount FROM po_lines WHERE id = $1', [line.po_line_id]);
            const pol = poLineRows[0] || {};
            const polQty = Number(pol.quantity || 0);
            const taxTotal = Number(pol.cgst_amount || 0) + Number(pol.sgst_amount || 0) + Number(pol.igst_amount || 0);
            if (taxTotal > 0 && polQty > 0) {
              gstPerUnit = taxTotal / polQty;
            } else if (Number(pol.gst_rate || 0) > 0) {
              gstPerUnit = baseUnit * (Number(pol.gst_rate) / 100);
            }
          }

          const unitCost = baseUnit + gstPerUnit;
          const totalCost = unitCost * qty;
          await client.query(`
            INSERT INTO inventory_layers (item_id, warehouse_id, bin_id, quantity, unit_cost, total_cost, source_type, source_id, circle_id, cluster_id)
            VALUES ($1,$2,$3,$4,$5,$6,'RECEIPT',$7,$8,$9)
          `, [line.item_id, grn.warehouse_id, grn.bin_id || null, qty, unitCost, totalCost, line.id, grn.circle_id || null, grn.cluster_id || null]);
          await client.query(`
            INSERT INTO inventory_transactions (item_id, warehouse_id, bin_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id, circle_id, cluster_id)
            VALUES ($1,$2,$3,'RECEIPT',$4,$5,$6,'GRN',$7,$8,$9)
          `, [line.item_id, grn.warehouse_id, grn.bin_id || null, qty, unitCost, totalCost, grn.id, grn.circle_id || null, grn.cluster_id || null]);
        }
      }
      }

      // Mark GRN as posted
      const { rows: updRows } = await client.query(`
        UPDATE goods_receipts SET status = 'posted', posted_at = NOW(), posted_by = $1, updated_at = NOW(), updated_by = $1
        WHERE id = $2 RETURNING *
      `, [userId, grnId]);
      const posted = updRows[0];

      await this.#syncPoReceivingState(client, grn.purchase_order_id, userId);

      await domainEventService.publishEvent('PROCUREMENT.GRN_POSTED', grnId.toString(), 'goods_receipt', { grn_id: grnId }, { posted_by: userId });
      return posted;
    });
  }

  async getById(grnId) {
    const sql = `
      SELECT grn.*, 
             s.supplier_code AS supplier_code,
             s.name AS supplier_name, 
             (s.address_line1 || COALESCE(', ' || s.address_line2, '') || COALESCE(', ' || s.city, '') || COALESCE(', ' || s.state, '') || COALESCE(' - ' || s.postal_code, '')) AS supplier_address,
             si.name AS site_name,
             si.site_code AS site_code,
             w.name AS warehouse_name,
             CONCAT_WS(', ', w.address_line1, w.address_line2, w.city, w.state, w.postal_code, w.country) AS warehouse_address,
             tc.name AS circle_name,
             cl.name AS cluster_name,
             po.po_number, po.title AS po_title,
             COALESCE(po.issued_at, po.created_at) AS po_date,
             json_agg(
               json_build_object(
                 'id', gl.id,
                 'line_number', gl.line_number,
                 'item_id', gl.item_id,
                 'item_code', gl.item_code,
                 'item_name', gl.item_name,
                  'qty_as_per_po', pol.quantity,
                  'qty_as_per_po_snapshot', gl.qty_as_per_po_snapshot,
                  'already_received', (
                    CASE WHEN gl.po_line_id IS NOT NULL THEN (
                      SELECT COALESCE(SUM(gl2.accepted_qty), 0)
                      FROM goods_receipts grn2
                      JOIN grn_lines gl2 ON gl2.goods_receipt_id = grn2.id
                      WHERE grn2.purchase_order_id = grn.purchase_order_id
                        AND grn2.status = 'posted'
                        AND gl2.po_line_id = gl.po_line_id
                    ) ELSE NULL END
                  ),
                  'already_received_snapshot', gl.already_received_snapshot,
                  'expected_qty', (
                    CASE WHEN pol.quantity IS NOT NULL THEN GREATEST(
                      pol.quantity - (
                        SELECT COALESCE(SUM(gl2.accepted_qty), 0)
                        FROM goods_receipts grn2
                        JOIN grn_lines gl2 ON gl2.goods_receipt_id = grn2.id
                        WHERE grn2.purchase_order_id = grn.purchase_order_id
                          AND grn2.status = 'posted'
                          AND gl2.po_line_id = gl.po_line_id
                      ), 0
                    ) ELSE NULL END
                  ),
                  'expected_qty_snapshot', gl.expected_qty_snapshot,
                 'received_qty', gl.received_qty,
                 'accepted_qty', gl.accepted_qty,
                 'rejected_qty', gl.rejected_qty,
                 'unit_of_measure', gl.unit_of_measure,
                 'unit_price', gl.unit_price,
                  'manufacturer', COALESCE(gl.manufacturer, pol.manufacturer),
                 'spare_type', gl.spare_type,
                 'company_code', it.company_code,
                 'hsn_code', it.hsn_code,
                 'gst_rate', COALESCE(
                   pol.gst_rate,
                   (COALESCE(pol.cgst_rate, 0) + COALESCE(pol.sgst_rate, 0) + COALESCE(pol.igst_rate, 0)),
                   CASE 
                     WHEN COALESCE(pol.base_amount, 0) > 0 THEN 
                       ((COALESCE(pol.cgst_amount, 0) + COALESCE(pol.sgst_amount, 0) + COALESCE(pol.igst_amount, 0)) 
                         / pol.base_amount) * 100
                     ELSE NULL 
                   END
                 )
               ) ORDER BY gl.line_number
             ) FILTER (WHERE gl.id IS NOT NULL) AS lines
      FROM goods_receipts grn
      LEFT JOIN suppliers s ON s.id = grn.supplier_id
      LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
      LEFT JOIN sites si ON si.id = COALESCE(grn.site_id, po.site_id)
      LEFT JOIN warehouses w ON w.id = grn.warehouse_id
      LEFT JOIN telecom_circles tc ON tc.id = grn.circle_id
      LEFT JOIN clusters cl ON cl.id = grn.cluster_id
      LEFT JOIN grn_lines gl ON gl.goods_receipt_id = grn.id
      LEFT JOIN po_lines pol ON pol.id = gl.po_line_id
      LEFT JOIN items it ON it.id = gl.item_id
      WHERE grn.id = $1
      GROUP BY grn.id, s.supplier_code, s.name, s.address_line1, s.address_line2, s.city, s.state, s.postal_code,
               si.name, si.site_code, w.name, w.address_line1, w.address_line2, w.city, w.state, w.postal_code, w.country,
               tc.name, cl.name, po.po_number, po.title, po.issued_at, po.created_at
    `;
    const res = await query(sql, [grnId]);
    if (res.rows.length === 0) throw new Error('GRN not found');
    return res.rows[0];
  }

  async list(filters = {}) {
    const { whereSql, params, limit, offset } = this.#buildListQueryParts(filters);

    const sql = `
      SELECT 
        grn.id,
        grn.grn_number,
        grn.purchase_order_id,
        grn.status,
        grn.created_at,
        grn.posted_at,
        po.po_number,
        po.title AS po_title,
        w.name AS warehouse_name,
        s.name AS supplier_name
      FROM goods_receipts grn
      LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
      LEFT JOIN warehouses w ON w.id = grn.warehouse_id
      LEFT JOIN suppliers s ON s.id = grn.supplier_id
      ${whereSql}
      ORDER BY grn.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const res = await query(sql, params);
    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM goods_receipts grn
      LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
      LEFT JOIN warehouses w ON w.id = grn.warehouse_id
      LEFT JOIN suppliers s ON s.id = grn.supplier_id
      ${whereSql}
    `;
    const countRes = await query(countSql, params);

    return {
      items: res.rows,
      pagination: {
        page: Number(filters.page || 1),
        limit,
        total: countRes.rows[0].total,
        totalPages: Math.ceil(countRes.rows[0].total / limit)
      }
    };
  }

  async export(filters = {}) {
    const { whereSql, params } = this.#buildListQueryParts(filters, true);
    const limit = 5000;

    const sql = `
      SELECT 
        grn.id,
        grn.grn_number,
        grn.status,
        grn.created_at,
        grn.posted_at,
        po.po_number,
        po.title AS po_title,
        w.name AS warehouse_name,
        s.name AS supplier_name
      FROM goods_receipts grn
      LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
      LEFT JOIN warehouses w ON w.id = grn.warehouse_id
      LEFT JOIN suppliers s ON s.id = grn.supplier_id
      ${whereSql}
      ORDER BY grn.created_at DESC
      LIMIT ${limit}
    `;

    const res = await query(sql, params);
    return res.rows;
  }

  async generateXlsx() {
    throw new Error('Legacy GRN Excel export removed. Use Print preview in the app.');
  }

  #buildListQueryParts(filters = {}, isExport = false) {
    const where = [];
    const params = [];
    let i = 1;

    if (filters.status) {
      where.push(`grn.status = $${i++}`);
      params.push(String(filters.status));
    }

    if (filters.purchase_order_id || filters.poId) {
      where.push(`grn.purchase_order_id = $${i++}`);
      params.push(Number(filters.purchase_order_id || filters.poId));
    }

    if (filters.warehouse_id) {
      where.push(`grn.warehouse_id = $${i++}`);
      params.push(Number(filters.warehouse_id));
    }

    if (filters.supplier_id) {
      where.push(`grn.supplier_id = $${i++}`);
      params.push(Number(filters.supplier_id));
    }

    if (filters.circle_id) {
      where.push(`grn.circle_id = $${i++}`);
      params.push(filters.circle_id);
    }

    if (filters.cluster_id) {
      where.push(`grn.cluster_id = $${i++}`);
      params.push(filters.cluster_id);
    }

    if (filters.created_from) {
      where.push(`grn.created_at >= $${i++}`);
      params.push(new Date(filters.created_from));
    }

    if (filters.created_to) {
      where.push(`grn.created_at <= $${i++}`);
      params.push(new Date(filters.created_to));
    }

    if (filters.search) {
      where.push(`(
        grn.grn_number ILIKE $${i}
        OR po.po_number ILIKE $${i}
        OR po.title ILIKE $${i}
        OR s.name ILIKE $${i}
      )`);
      params.push(`%${filters.search}%`);
      i += 1;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = isExport
      ? undefined
      : Math.max(1, Math.min(100, Number(filters.limit) || 10));
    const offset = isExport
      ? undefined
      : Math.max(0, (Number(filters.page || 1) - 1) * limit);

    return { whereSql, params, limit, offset };
  }

  async update(grnId, payload, userId) {
    return transaction(async (client) => {
      const { rows: chk } = await client.query("SELECT id, status, purchase_order_id FROM goods_receipts WHERE id = $1 FOR UPDATE", [grnId]);
      if (chk.length === 0) throw new Error('GRN not found');
      if (chk[0].status !== 'draft') throw new Error('Only draft GRNs can be updated');
      const currentPoId = chk[0].purchase_order_id;

      // Update header
      const fields = [];
      const params = [];
      let i = 1;
      const setField = (col, val) => { fields.push(`${col} = $${i}`); params.push(val); i++; };
      if (payload.purchase_order_id != null) setField('purchase_order_id', Number(payload.purchase_order_id));
      if (payload.supplier_id != null) setField('supplier_id', Number(payload.supplier_id));
      if (payload.site_id != null) setField('site_id', Number(payload.site_id));
      if (payload.warehouse_id != null) setField('warehouse_id', Number(payload.warehouse_id));
      if (payload.bin_id != null) setField('bin_id', Number(payload.bin_id));
      if (payload.remarks != null) setField('remarks', payload.remarks);
      if (payload.circle_id != null) setField('circle_id', Number(payload.circle_id));
      if (payload.cluster_id != null) setField('cluster_id', Number(payload.cluster_id));
      setField('updated_at', new Date());
      setField('updated_by', userId);
      if (fields.length) {
        await client.query(`UPDATE goods_receipts SET ${fields.join(', ')} WHERE id = $${i}`, [...params, grnId]);
      }

      // Replace lines if provided
      if (Array.isArray(payload.lines)) {
        // Build helper map for po_line_id resolution if missing
        let poLineByItemId = new Map();
        try {
          const poIdForResolve = (payload.purchase_order_id != null) ? Number(payload.purchase_order_id) : Number(currentPoId);
          if (poIdForResolve) {
            const { rows: polRows } = await client.query('SELECT id, item_id FROM po_lines WHERE purchase_order_id = $1', [poIdForResolve]);
            poLineByItemId = new Map(polRows.filter(r => r.item_id != null).map(r => [String(r.item_id), Number(r.id)]));
          }
        } catch {}
        await client.query('DELETE FROM grn_lines WHERE goods_receipt_id = $1', [grnId]);
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const l = payload.lines[idx];
          const received = Math.max(parseFloat(l.received_qty) || 0, 0);
          const accepted = Math.max(parseFloat(l.accepted_qty) || 0, 0);
          const rejected = Math.max(parseFloat(l.rejected_qty) || 0, 0);
          const resolvedPoLineId = (l.po_line_id != null && Number(l.po_line_id))
            ? Number(l.po_line_id)
            : (l.item_id != null && poLineByItemId.has(String(l.item_id)) ? poLineByItemId.get(String(l.item_id)) : null);
          // Compute snapshot from PO as in create()
          let qtyOrdered = null;
          let alreadyPosted = null;
          let expectedSnap = null;
          if (resolvedPoLineId) {
            try {
              const qOrd = await client.query('SELECT quantity FROM po_lines WHERE id = $1', [resolvedPoLineId]);
              qtyOrdered = Number(qOrd.rows?.[0]?.quantity || 0);
              const qRec = await client.query(`
                SELECT COALESCE(SUM(gl.accepted_qty), 0)::numeric AS posted_accepted
                FROM goods_receipts grn2
                JOIN grn_lines gl ON gl.goods_receipt_id = grn2.id
                WHERE grn2.purchase_order_id = $1 AND grn2.status = 'posted' AND gl.po_line_id = $2
              `, [poIdForResolve || currentPoId, resolvedPoLineId]);
              alreadyPosted = Number(qRec.rows?.[0]?.posted_accepted || 0);
              expectedSnap = Math.max(qtyOrdered - alreadyPosted, 0);
            } catch {}
          }
          try {
            await client.query(`
              INSERT INTO grn_lines (
                goods_receipt_id, line_number, po_line_id, item_id, item_code, item_name,
                received_qty, accepted_qty, rejected_qty, unit_of_measure, unit_price, lot_number, serial_numbers,
                manufacturer, spare_type,
                qty_as_per_po_snapshot, already_received_snapshot, expected_qty_snapshot
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            `, [
              grnId, idx + 1, resolvedPoLineId, l.item_id || null, l.item_code || null, l.item_name,
              received, accepted, rejected, l.unit_of_measure || 'PCS', parseFloat(l.unit_price) || 0,
              l.lot_number || null, Array.isArray(l.serial_numbers) ? l.serial_numbers.join(',') : (l.serial_numbers || null),
              l.manufacturer || null, l.spare_type || null,
              qtyOrdered, alreadyPosted, expectedSnap
            ]);
          } catch (e) {
            if (String(e.message || '').includes('qty_as_per_po_snapshot')) {
              await client.query(`
                INSERT INTO grn_lines (
                  goods_receipt_id, line_number, po_line_id, item_id, item_code, item_name,
                  received_qty, accepted_qty, rejected_qty, unit_of_measure, unit_price, lot_number, serial_numbers,
                  manufacturer, spare_type
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
              `, [
                grnId, idx + 1, resolvedPoLineId, l.item_id || null, l.item_code || null, l.item_name,
                received, accepted, rejected, l.unit_of_measure || 'PCS', parseFloat(l.unit_price) || 0,
                l.lot_number || null, Array.isArray(l.serial_numbers) ? l.serial_numbers.join(',') : (l.serial_numbers || null),
                l.manufacturer || null, l.spare_type || null
              ]);
            } else { throw e; }
          }
        }
      }

      const { rows: out } = await client.query('SELECT * FROM goods_receipts WHERE id = $1', [grnId]);
      return out[0];
    });
  }

  async delete(grnId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status FROM goods_receipts WHERE id = $1', [grnId]);
      if (rows.length === 0) throw new Error('GRN not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft GRNs can be deleted');
      await client.query('DELETE FROM grn_lines WHERE goods_receipt_id = $1', [grnId]);
      await client.query('DELETE FROM goods_receipts WHERE id = $1', [grnId]);
      await domainEventService.publishEvent('PROCUREMENT.GRN_DELETED', grnId.toString(), 'goods_receipt', { grn_id: grnId }, { deleted_by: userId });
      return { deleted: true };
    });
  }

  async withdraw(grnId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status, workflow_instance_id FROM goods_receipts WHERE id = $1 FOR UPDATE', [grnId]);
      if (rows.length === 0) throw new Error('GRN not found');
      const grn = rows[0];
      if (!['draft', 'pending_approval'].includes(grn.status)) {
        throw new Error('Only draft or pending approval GRNs can be withdrawn');
      }

      const { rows: upd } = await client.query(
        `UPDATE goods_receipts
         SET status = 'withdrawn',
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
         RETURNING *`,
        [grnId, userId]
      );

      if (grn.workflow_instance_id) {
        try {
          const { actOnInstance } = await import('../system/workflowService.js');
          await actOnInstance({
            instanceId: grn.workflow_instance_id,
            actorId: userId,
            action: 'withdraw',
            comment: 'Withdrawn by creator'
          });
        } catch (e) {
          console.warn('Workflow withdraw failed:', e.message);
        }
      }

      await domainEventService.publishEvent('PROCUREMENT.GRN.WITHDRAWN', grnId.toString(), 'goods_receipt', { grn_id: grnId }, { withdrawn_by: userId });
      return upd[0];
    });
  }

  async submit(grnId, userId) {
    // First, update GRN status in a separate transaction
    const upd = await query(`
      UPDATE goods_receipts 
      SET status = 'pending_approval', submitted_at = NOW(), submitted_by = $1, updated_at = NOW(), updated_by = $1
      WHERE id = $2 AND status = 'draft' 
      RETURNING *
    `, [userId, grnId]);
    
    if (upd.rows.length === 0) throw new Error('GRN not found or cannot be submitted');
    const grn = upd.rows[0];

    // Gather minimal context for workflow
    const detailsRes = await query(`
      SELECT grn.id, grn.grn_number, grn.purchase_order_id, grn.supplier_id,
             grn.site_id, grn.warehouse_id, grn.circle_id, grn.cluster_id,
             s.name AS supplier_name,
             po.po_number AS po_number,
             r.department_id AS department_id
      FROM goods_receipts grn
      LEFT JOIN suppliers s ON s.id = grn.supplier_id
      LEFT JOIN purchase_orders po ON po.id = grn.purchase_order_id
      LEFT JOIN requisitions r ON r.id = po.requisition_id
      WHERE grn.id = $1
    `, [grnId]);
    const d = detailsRes.rows[0] || {};

    // Start workflow via binding if available (this happens AFTER the entity is already submitted)
    let wfInfo = null;
    try {
      const featureRes = await rawQuery(`SELECT id FROM features WHERE name = 'goods_receipt' LIMIT 1`);
      const featureId = featureRes.rows[0]?.id;
      if (!featureId) throw new Error('goods_receipt feature not found');
      const wf = await emitWorkflowEvent({
        featureId,
        event: 'onStatusChange',
        entityId: grnId,
        entityType: 'goods_receipt',
        data: {
          grnId,
          grnNumber: d.grn_number,
          purchaseOrderId: d.purchase_order_id,
          poNumber: d.po_number,
          supplierId: d.supplier_id,
          supplierName: d.supplier_name,
          siteId: d.site_id,
          warehouseId: d.warehouse_id,
          circleId: d.circle_id,
          clusterId: d.cluster_id,
          departmentId: d.department_id
        },
        actorId: userId
      });
      if (wf?.instanceId) {
        await query('UPDATE goods_receipts SET workflow_instance_id = $1 WHERE id = $2', [wf.instanceId, grnId]);
        wfInfo = { bound: true, instance_id: wf.instanceId };
      }
    } catch (e) {
      console.warn('GRN workflow creation failed:', e.message);
      wfInfo = { bound: false, message: 'No active workflow binding found for goods_receipt; submission will not create approval tasks.' };
    }

    await domainEventService.publishEvent('PROCUREMENT.GRN_SUBMITTED', String(grnId), 'goods_receipt', { grn_id: grnId }, { submitted_by: userId });
    
    // Return fresh GRN data with workflow instance ID
    const finalGrn = await query('SELECT * FROM goods_receipts WHERE id = $1', [grnId]);
    return { ...finalGrn.rows[0], _workflow: wfInfo };
  }
}

export default new GoodsReceiptService();



