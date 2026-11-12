import { query, transaction } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IssueService {
  async generateNumber(client = null) {
    const run = client ? client.query.bind(client) : query;
    const { rows } = await run('SELECT generate_issue_number() AS issue_number');
    return rows[0].issue_number;
  }

  async generateChallanNumber(client = null, circleId = null, clusterId = null) {
    const run = client ? client.query.bind(client) : query;
    let sql;
    let params;
    if (circleId !== null || clusterId !== null) {
      sql = 'SELECT generate_challan_number($1,$2) AS challan_number';
      params = [circleId, clusterId];
    } else {
      sql = `SELECT generate_challan_number(
               (SELECT circle_id FROM inventory_issues WHERE circle_id IS NOT NULL ORDER BY id DESC LIMIT 1),
               (SELECT cluster_id FROM inventory_issues WHERE cluster_id IS NOT NULL ORDER BY id DESC LIMIT 1)
             ) AS challan_number`;
      params = [];
    }
    const { rows } = await run(sql, params);
    return rows[0]?.challan_number;
  }

  async create(payload, userId) {
    return transaction(async (client) => {
      if (!Number.isInteger(Number(payload.transaction_category_id))) {
        throw new Error('transaction_category_id is required');
      }
      const cat = await client.query('SELECT id FROM transaction_categories WHERE id = $1 AND is_active = TRUE', [Number(payload.transaction_category_id)]);
      if (cat.rows.length === 0) throw new Error('Invalid or inactive transaction category');
      const issueNumber = await this.generateNumber(client);
      // Generate challan number at creation using circle/cluster context
      const challanNumber = await this.generateChallanNumber(client, payload.circle_id || null, payload.cluster_id || null);
      const ins = await client.query(`
        INSERT INTO inventory_issues (
          issue_number, challan_number, challan_date,
          warehouse_id, bin_id, project_id,
          destination_type, destination_id, site_id, vendor_id, technician_id,
          site_name, circle_id, cluster_id, material_request_type, destination_address,
          eway_bill_number, eway_bill_date, origin_gst_number, destination_gst_number,
          vehicle_number, driver_name, driver_phone,
          remarks, warehouse_address, note,
          tt_number,
          requested_by, approved_by, issued_by,
          requested_at, approved_at, issued_at,
          created_by, updated_by,
          transaction_category_id
        )
        VALUES (
          $1,$2,$3,
          $4,$5,$6,
          $7,$8,$9,$10,$11,
          $12,$13,$14,$15,$16,
          $17,$18,$19,$20,
          $21,$22,$23,
          $24,$25,$26,
          $27,
          $28,$29,$30,
          $31,$32,$33,
          $34,$34,
          $35
        ) RETURNING *
      `, [
        issueNumber, challanNumber, payload.challan_date || null,
        payload.warehouse_id || null, payload.bin_id || null, payload.project_id || null,
        payload.destination_type || (payload.project_id ? 'PROJECT' : null),
        (Number.isInteger(payload?.destination_id) ? payload.destination_id : (Number.isInteger(payload?.project_id) ? payload.project_id : null)),
        (Number.isInteger(payload?.site_id) ? payload.site_id : null), (Number.isInteger(payload?.vendor_id) ? payload.vendor_id : null), (Number.isInteger(payload?.technician_id) ? payload.technician_id : null),
        payload.site_name || null, (Number.isInteger(payload?.circle_id) ? payload.circle_id : null), (Number.isInteger(payload?.cluster_id) ? payload.cluster_id : null), payload.material_request_type || 'Internal Transfer', payload.destination_address || null,
        payload.eway_bill_number || null, payload.eway_bill_date || null, payload.origin_gst_number || null, payload.destination_gst_number || null,
        payload.vehicle_number || null, payload.driver_name || null, payload.driver_phone || null,
        payload.remarks || null, payload.warehouse_address || null, payload.note || null,
        payload.tt_number || null,
        userId, payload.approved_by || null, payload.issued_by || null,
        payload.requested_at || null, payload.approved_at || null, payload.issued_at || null,
        userId,
        Number(payload.transaction_category_id)
      ]);
      let iss = ins.rows[0];
      // Set challan_number immediately
      const { rows: updCh } = await client.query(`UPDATE inventory_issues SET challan_number = $1 WHERE id = $2 RETURNING *`, [challanNumber, iss.id]);
      iss = updCh[0] || iss;
      if (Array.isArray(payload.lines)) {
        for (let i = 0; i < payload.lines.length; i++) {
          const l = payload.lines[i];
          const qty = Number(l.quantity || 0);
          await client.query(`
            INSERT INTO inventory_issue_lines (
              issue_id, line_number, item_id, quantity, unit_of_measure,
              company_code, item_code, item_description, requested_qty, approved_qty, issued_qty, is_returnable
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          `, [
            iss.id, i + 1, l.item_id || null, qty, l.unit_of_measure || 'PCS',
            l.company_code || null, l.item_code || null, l.item_description || null,
            l.requested_qty != null ? Number(l.requested_qty) : qty,
            l.approved_qty != null ? Number(l.approved_qty) : qty,
            l.issued_qty != null ? Number(l.issued_qty) : qty,
            !!l.is_returnable
          ]);
        }
      }
      await domainEventService.publishEvent('INVENTORY.ISSUE.CREATED', iss.id.toString(), 'inventory_issue', { issue_id: iss.id });
      return iss;
    });
  }

  async post(issueId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM inventory_issues WHERE id = $1 AND status IN (\'draft\', \'approved\') FOR UPDATE', [issueId]);
      if (rows.length === 0) throw new Error('Issue not found or cannot be posted (must be draft or approved)');
      const iss = rows[0];
      // Challan number already assigned at creation; do not regenerate
      const { rows: lines } = await client.query('SELECT * FROM inventory_issue_lines WHERE issue_id = $1 ORDER BY line_number', [issueId]);
      if (lines.length === 0) throw new Error('No lines to issue');

      let consignmentTotalValue = 0;
      for (const l of lines) {
        const qty = Number(l.quantity || 0);
        if (qty <= 0) continue;
        // Compute current moving average cost for this item at the source warehouse
        const avgRes = await client.query(`
          SELECT CASE WHEN COALESCE(SUM(il.quantity),0) = 0 THEN 0::numeric
                      ELSE COALESCE(SUM(il.total_cost),0)::numeric / NULLIF(COALESCE(SUM(il.quantity),0)::numeric,0) END AS avg_cost
          FROM inventory_layers il
          WHERE il.item_id = $1 AND il.warehouse_id = $2
        `, [l.item_id, iss.warehouse_id]);
        const unitCost = Number(avgRes.rows[0]?.avg_cost || 0);
        const totalCost = unitCost * qty;
        consignmentTotalValue += totalCost;

        await client.query(`
          INSERT INTO inventory_transactions (item_id, warehouse_id, bin_id, transaction_type, quantity, unit_cost, total_cost, reference_type, reference_id)
          VALUES ($1,$2,$3,'ISSUE',$4,$5,$6,'ISSUE',$7)
        `, [l.item_id, iss.warehouse_id, iss.bin_id, qty, unitCost, totalCost, iss.id]);
        await client.query(`
          INSERT INTO inventory_layers (item_id, warehouse_id, bin_id, quantity, unit_cost, total_cost, source_type, source_id)
          VALUES ($1,$2,$3,$4,$5,$6,'ISSUE',$7)
        `, [l.item_id, iss.warehouse_id, iss.bin_id, -qty, unitCost, -totalCost, l.id]);
      }

      // Enforce E-Way Bill for consignments >= 50000
      if (consignmentTotalValue >= 50000) {
        const ewbNumber = (iss.eway_bill_number || '').toString().trim();
        const ewbDate = iss.eway_bill_date;
        if (!ewbNumber || !ewbDate) {
          throw new Error('E-Way Bill number and date are required for issues with consignment value >= 50,000');
        }
      }

      const { rows: upd } = await client.query(`
        UPDATE inventory_issues SET status = 'posted', posted_at = NOW(), posted_by = $1, updated_at = NOW(), updated_by = $1
        WHERE id = $2 RETURNING *
      `, [userId, issueId]);
      const posted = upd[0];
      await domainEventService.publishEvent('INVENTORY.ISSUE.POSTED', issueId.toString(), 'inventory_issue', { issue_id: issueId }, { posted_by: userId });
      return posted;
    });
  }

  async getById(id) {
    const sql = `
      SELECT i.*, 
             tc.name as circle_name,
             cl.name as cluster_name,
             cat.name as transaction_category_name,
             u_req.first_name || ' ' || u_req.last_name AS requested_by_name,
             u_app.first_name  || ' ' || u_app.last_name  AS approved_by_name,
             u_iss.first_name  || ' ' || u_iss.last_name  AS issued_by_name,
             s.name as vendor_name,
             s.supplier_code as vendor_code,
             s.contact_person as vendor_contact_person,
             s.phone as vendor_phone,
             sc.name as vendor_circle_name,
             scl.name as vendor_cluster_name,
             si.site_code as site_code,
             -- Return aggregates
             COALESCE(SUM(COALESCE(il.issued_qty, il.quantity)), 0)::int AS total_issued_qty,
             COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0)::int AS total_returned_qty,
             CASE 
               WHEN COALESCE(SUM(COALESCE(il.issued_qty, il.quantity)), 0) <= COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0) THEN 'fully_returned'
               WHEN COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0) > 0 THEN 'partially_returned'
               ELSE 'not_returned'
             END AS return_status,
             json_agg(json_build_object(
               'id', il.id,
               'line_number', il.line_number,
               'item_id', il.item_id,
               'item_name', itm.name,
               'item_code', COALESCE(il.item_code, itm.item_code),
               'item_description', COALESCE(il.item_description, itm.description),
               'manufacturer', itm.manufacturer,
               'quantity', il.quantity,
               'unit_of_measure', il.unit_of_measure,
               'company_code', COALESCE(itm.company_code, il.company_code),
               'requested_qty', il.requested_qty,
               'approved_qty', il.approved_qty,
               'issued_qty', il.issued_qty,
               'is_returnable', il.is_returnable,
               'quantity_returned', il.quantity_returned
             ) ORDER BY il.line_number)
             FILTER (WHERE il.id IS NOT NULL) AS lines
      FROM inventory_issues i
      LEFT JOIN inventory_issue_lines il ON il.issue_id = i.id
      LEFT JOIN items itm ON itm.id = il.item_id
      LEFT JOIN transaction_categories cat ON cat.id = i.transaction_category_id
      LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
      LEFT JOIN clusters cl ON cl.id = i.cluster_id
      LEFT JOIN suppliers s ON s.id = i.vendor_id
      LEFT JOIN supplier_circles scc ON scc.supplier_id = s.id
      LEFT JOIN telecom_circles sc ON sc.id = scc.circle_id
      LEFT JOIN supplier_clusters scls ON scls.supplier_id = s.id
      LEFT JOIN clusters scl ON scl.id = scls.cluster_id
      LEFT JOIN sites si ON si.id = i.site_id
      LEFT JOIN users u_req ON u_req.id = i.requested_by
      LEFT JOIN users u_app ON u_app.id = i.approved_by
      LEFT JOIN users u_iss ON u_iss.id = i.issued_by
      WHERE i.id = $1
      GROUP BY 
        i.id, tc.name, cl.name, s.name, s.supplier_code, s.contact_person, s.phone, 
        sc.name, scl.name, si.site_code, cat.name,
        u_req.first_name, u_req.last_name,
        u_app.first_name, u_app.last_name,
        u_iss.first_name, u_iss.last_name
    `;
    const { rows } = await query(sql, [id]);
    if (rows.length === 0) throw new Error('Issue not found');
    return rows[0];
  }

  /**
   * Generate a single Delivery Challan Excel file based on the Delivery Challan_Format.xlsx template.
   */
  async generateChallanXlsx(issueId) {
    const issue = await this.getById(issueId);

    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve(
      __dirname,
      '../../templates/Delivery Challan_Format.xlsx'
    );
    await workbook.xlsx.readFile(templatePath);
    const sheet = workbook.worksheets[0] || workbook.getWorksheet(1);
    if (!sheet) throw new Error('Delivery Challan template worksheet not found');

    const fmtDate = (d) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

    const lines = Array.isArray(issue.lines) ? issue.lines : [];

    // Header mapping
    // Left header
    sheet.getCell('C6').value = issue.challan_number || issue.issue_number || ''; // Challan no.
    sheet.getCell('C7').value = issue.site_code || issue.site_id || '';          // SITE ID
    sheet.getCell('C8').value = issue.site_name || '';                           // SITE NAME
    sheet.getCell('C9').value = issue.cluster_name || '';                        // CLUSTER
    sheet.getCell('C10').value = issue.material_request_type || '';              // MATERIAL REQUEST TYPE
    sheet.getCell('C11').value = issue.destination_address || issue.warehouse_address || ''; // SITE ADDRESS

    // Right header
    sheet.getCell('H6').value = fmtDate(issue.challan_date);            // CHALLAN DATE
    sheet.getCell('H7').value = issue.eway_bill_number || '';           // EWAY BILL NO.
    sheet.getCell('H8').value = fmtDate(issue.eway_bill_date);          // EWAY BILL DATE
    sheet.getCell('H9').value = issue.origin_gst_number || '';          // ORIGIN GST
    sheet.getCell('H10').value = issue.destination_gst_number || '';    // DESTINATION GST

    // Line items: rows 14–16
    const baseRow = 14;
    const maxLines = 3;

    for (let i = 0; i < maxLines; i++) {
      const row = sheet.getRow(baseRow + i);
      const l = lines[i];

      if (!l) {
        ['A', 'B', 'C', 'D', 'G', 'H', 'I', 'J', 'K'].forEach((col) => {
          row.getCell(col).value = '';
        });
        row.commit();
        continue;
      }

      const requested = Number(l.requested_qty ?? l.quantity ?? 0) || 0;
      const approved = Number(l.approved_qty ?? l.quantity ?? 0) || 0;
      const issued = Number(l.issued_qty ?? l.quantity ?? 0) || 0;

      row.getCell('A').value = i + 1;                // SNO
      row.getCell('B').value = l.company_code || ''; // COMPANY CODE (from item master via getById)
      row.getCell('C').value = l.item_code || '';    // ITEM CODE
      row.getCell('D').value = l.item_description || l.item_name || ''; // ITEM DESCRIPTION
      row.getCell('G').value = l.unit_of_measure || ''; // UOM
      row.getCell('H').value = requested;            // REQUESTED
      row.getCell('I').value = approved;             // APPROVED
      row.getCell('J').value = issued;               // ISSUED
      row.getCell('K').value = l.is_returnable ? 'Yes' : 'No'; // RETURNABLE

      row.commit();
    }

    // Remarks
    sheet.getCell('A18').value = issue.remarks ? `REMARKS: ${issue.remarks}` : 'REMARKS:';

    // Requested/Approved/Issued – plain names (no prefixes)
    sheet.getCell('A23').value = issue.requested_by_name || '';
    sheet.getCell('D23').value = issue.approved_by_name || '';
    // For now, keep Issued By = Approved By as requested
    sheet.getCell('H23').value = issue.approved_by_name || '';

    // Warehouse address
    sheet.getCell('A29').value = issue.warehouse_address || '';

    const fileName = `DC_${issue.challan_number || issueId}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const nodeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

    return { buffer: nodeBuffer, fileName };
  }

  async list({ page = 1, limit = 10, status, search, circle_id, cluster_id } = {}) {
    const offset = (Number(page) - 1) * Number(limit);
    const { whereClause, params, limitParam, offsetParam } = this.#buildListFilterClauses({ status, search, circle_id, cluster_id, limit, offset });
    const sql = `
      SELECT i.id, i.issue_number, i.challan_number, i.status, i.created_at,
             i.site_name, i.destination_type, i.site_id,
             s.name as vendor_name,
             s.supplier_code as vendor_code,
             tc.name as circle_name,
             cl.name as cluster_name,
             COUNT(il.id)::int as line_count,
             -- Return aggregates for gating SRN creation
             COALESCE(SUM(COALESCE(il.issued_qty, il.quantity)), 0)::int AS total_issued_qty,
             COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0)::int AS total_returned_qty,
             CASE 
               WHEN COALESCE(SUM(COALESCE(il.issued_qty, il.quantity)), 0) <= COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0) THEN 'fully_returned'
               WHEN COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0) > 0 THEN 'partially_returned'
               ELSE 'not_returned'
             END AS return_status,
             -- SRN references concatenated (ordered by latest)
             (
               SELECT COALESCE(STRING_AGG(t.srn_number, ', ' ORDER BY t.created_at DESC), '')
               FROM (
                 SELECT srn_number, MAX(created_at) AS created_at
                 FROM store_return_notes
                 WHERE reference_challan_id = i.id AND status = 'posted'
                 GROUP BY srn_number
               ) t
             ) AS srn_refs,
             -- SRN count against this challan
             (
               SELECT COUNT(*)::int FROM store_return_notes srnc
               WHERE srnc.reference_challan_id = i.id AND srnc.status = 'posted'
             ) AS srn_count
      FROM inventory_issues i
      LEFT JOIN inventory_issue_lines il ON il.issue_id = i.id
      LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
      LEFT JOIN clusters cl ON cl.id = i.cluster_id
      LEFT JOIN suppliers s ON s.id = i.vendor_id
      ${whereClause}
      GROUP BY i.id, tc.name, cl.name, s.name, s.supplier_code
      ORDER BY i.created_at DESC 
      LIMIT ${limitParam} OFFSET ${offsetParam}
    `;
    
    const { rows } = await query(sql, params);

    // Count query with same filters
    const countSql = `
      SELECT COUNT(DISTINCT i.id)::int AS total 
      FROM inventory_issues i
      ${whereClause}
    `;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const { rows: c } = await query(countSql, countParams);

    return {
      items: rows.map(r => ({
        ...r,
        lines: Array(r.line_count).fill({}) // Mock lines array for count
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
      SELECT i.id, i.issue_number, i.challan_number, i.status, i.created_at,
             i.site_name, i.destination_type, i.site_id,
             s.name as vendor_name,
             s.supplier_code as vendor_code,
             tc.name as circle_name,
             cl.name as cluster_name,
             COUNT(il.id)::int as line_count,
             COALESCE(SUM(COALESCE(il.issued_qty, il.quantity)), 0)::int AS total_issued_qty,
             COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0)::int AS total_returned_qty,
             CASE 
               WHEN COALESCE(SUM(COALESCE(il.issued_qty, il.quantity)), 0) <= COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0) THEN 'fully_returned'
               WHEN COALESCE(SUM(COALESCE(il.quantity_returned, 0)), 0) > 0 THEN 'partially_returned'
               ELSE 'not_returned'
             END AS return_status
      FROM inventory_issues i
      LEFT JOIN inventory_issue_lines il ON il.issue_id = i.id
      LEFT JOIN telecom_circles tc ON tc.id = i.circle_id
      LEFT JOIN clusters cl ON cl.id = i.cluster_id
      LEFT JOIN suppliers s ON s.id = i.vendor_id
      ${whereClause}
      GROUP BY i.id, tc.name, cl.name, s.name, s.supplier_code
      ORDER BY i.created_at DESC 
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
      conditions.push(`i.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(i.issue_number ILIKE $${paramIndex} OR i.challan_number ILIKE $${paramIndex} OR i.site_name ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (circle_id) {
      conditions.push(`i.circle_id = $${paramIndex}`);
      params.push(Number(circle_id));
      paramIndex++;
    }

    if (cluster_id) {
      conditions.push(`i.cluster_id = $${paramIndex}`);
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

  async update(issueId, payload, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query("SELECT status FROM inventory_issues WHERE id = $1 FOR UPDATE", [issueId]);
      if (rows.length === 0) throw new Error('Issue not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft issues can be updated');

      const fields = [];
      const params = [];
      let i = 1;
      const setField = (col, val) => { fields.push(`${col} = $${i}`); params.push(val); i++; };
      const allow = ['challan_date','warehouse_id','bin_id','project_id','destination_type','destination_id','site_id','vendor_id','technician_id','site_name','circle_id','cluster_id','material_request_type','destination_address','eway_bill_number','eway_bill_date','origin_gst_number','destination_gst_number','vehicle_number','driver_name','driver_phone','remarks','warehouse_address','note','tt_number'];
      for (const key of allow) {
        if (Object.prototype.hasOwnProperty.call(payload, key)) setField(key, payload[key]);
      }
      setField('updated_at', new Date());
      setField('updated_by', userId);
      if (fields.length) await client.query(`UPDATE inventory_issues SET ${fields.join(', ')} WHERE id = $${i}`, [...params, issueId]);

      if (Array.isArray(payload.lines)) {
        await client.query('DELETE FROM inventory_issue_lines WHERE issue_id = $1', [issueId]);
        for (let idx = 0; idx < payload.lines.length; idx++) {
          const l = payload.lines[idx];
          await client.query(`
            INSERT INTO inventory_issue_lines (
              issue_id, line_number, item_id, quantity, unit_of_measure,
              company_code, item_code, item_description, requested_qty, approved_qty, issued_qty, is_returnable
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          `, [
            issueId, idx + 1, l.item_id || null, Number(l.quantity || 0), l.unit_of_measure || 'PCS',
            l.company_code || null, l.item_code || null, l.item_description || null,
            l.requested_qty != null ? Number(l.requested_qty) : Number(l.quantity || 0),
            l.approved_qty != null ? Number(l.approved_qty) : Number(l.quantity || 0),
            l.issued_qty != null ? Number(l.issued_qty) : 0,
            !!l.is_returnable
          ]);
        }
      }

      const { rows: out } = await client.query('SELECT * FROM inventory_issues WHERE id = $1', [issueId]);
      return out[0];
    });
  }

  async delete(issueId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status FROM inventory_issues WHERE id = $1', [issueId]);
      if (rows.length === 0) throw new Error('Issue not found');
      if (rows[0].status !== 'draft') throw new Error('Only draft issues can be deleted');
      await client.query('DELETE FROM inventory_issue_lines WHERE issue_id = $1', [issueId]);
      await client.query('DELETE FROM inventory_issues WHERE id = $1', [issueId]);
      await domainEventService.publishEvent('INVENTORY.ISSUE.DELETED', issueId.toString(), 'inventory_issue', { issue_id: issueId }, { deleted_by: userId });
      return { deleted: true };
    });
  }

  async withdraw(issueId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query('SELECT status, workflow_instance_id FROM inventory_issues WHERE id = $1 FOR UPDATE', [issueId]);
      if (rows.length === 0) throw new Error('Issue not found');
      const iss = rows[0];
      if (!['draft', 'submitted', 'pending_approval'].includes(iss.status)) {
        throw new Error('Only draft or submitted issues can be withdrawn');
      }

      const { rows: upd } = await client.query(
        `UPDATE inventory_issues
         SET status = 'withdrawn',
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
         RETURNING *`,
        [issueId, userId]
      );

      if (iss.workflow_instance_id) {
        try {
          const { actOnInstance } = await import('../system/workflowService.js');
          await actOnInstance({
            instanceId: iss.workflow_instance_id,
            actorId: userId,
            action: 'withdraw',
            comment: 'Withdrawn by creator'
          });
        } catch (e) {
          console.warn('Workflow withdraw failed:', e.message);
        }
      }

      await domainEventService.publishEvent('INVENTORY.ISSUE.WITHDRAWN', issueId.toString(), 'inventory_issue', { issue_id: issueId }, { withdrawn_by: userId });
      return upd[0];
    });
  }
}

export default new IssueService();



