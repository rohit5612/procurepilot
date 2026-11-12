import { query } from '../../database/connection.js';

class StockService {
  async getTransactions({ itemId, warehouseId, binId, type, dateFrom, dateTo, page = 1, limit = 10 } = {}) {
    const where = [];
    const params = [];
    let i = 1;
    if (itemId) { where.push(`t.item_id = $${i++}`); params.push(Number(itemId)); }
    if (warehouseId) { where.push(`t.warehouse_id = $${i++}`); params.push(Number(warehouseId)); }
    if (binId) { where.push(`t.bin_id = $${i++}`); params.push(Number(binId)); }
    if (type) { where.push(`t.transaction_type = $${i++}`); params.push(String(type).toUpperCase()); }
    if (dateFrom) { where.push(`t.created_at >= $${i++}`); params.push(new Date(dateFrom)); }
    if (dateTo) { where.push(`t.created_at <= $${i++}`); params.push(new Date(dateTo)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const off = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT t.id, t.created_at, t.item_id, it.name AS item_name, it.item_code, t.warehouse_id, w.name AS warehouse_name,
             t.bin_id, b.bin_code, t.transaction_type, t.quantity, t.unit_cost, t.total_cost,
             t.reference_type, t.reference_id,
             CASE 
               WHEN t.reference_type = 'GRN' THEN gr.grn_number
               WHEN t.reference_type = 'SRN' THEN srn.srn_number
               WHEN t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') THEN iss.challan_number
               WHEN t.reference_type = 'TRANSFER' THEN tr.challan_number
               WHEN t.reference_type = 'ADJUSTMENT' THEN adj.adjustment_number
               WHEN t.reference_type = 'STOCK_COUNT' THEN sc.count_number
               ELSE NULL
             END AS reference_number,
             CASE 
               WHEN t.reference_type = 'GRN' THEN gr.id
               WHEN t.reference_type = 'SRN' THEN srn.id
               WHEN t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') THEN iss.id
               WHEN t.reference_type = 'TRANSFER' THEN tr.id
               WHEN t.reference_type = 'ADJUSTMENT' THEN adj.id
               WHEN t.reference_type = 'STOCK_COUNT' THEN sc.id
               ELSE t.reference_id
             END AS reference_entity_id
      FROM inventory_transactions t
      LEFT JOIN items it ON it.id = t.item_id
      LEFT JOIN warehouses w ON w.id = t.warehouse_id
      LEFT JOIN bins b ON b.id = t.bin_id
      LEFT JOIN goods_receipts gr ON t.reference_type = 'GRN' AND t.reference_id = gr.id
      LEFT JOIN store_return_items sri ON t.reference_type = 'SRN' AND t.reference_id = sri.id
      LEFT JOIN store_return_notes srn ON sri.srn_id = srn.id
      LEFT JOIN inventory_issue_lines ill ON t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') AND t.reference_id = ill.id
      LEFT JOIN inventory_issues iss ON t.reference_type IN ('ISSUE', 'DC', 'DELIVERY_CHALLAN') AND (t.reference_id = iss.id OR iss.id = ill.issue_id)
      LEFT JOIN inventory_adjustment_lines al ON t.reference_type = 'ADJUSTMENT' AND t.reference_id = al.id
      LEFT JOIN inventory_adjustments adj ON t.reference_type = 'ADJUSTMENT' AND (t.reference_id = adj.id OR adj.id = al.adjustment_id)
      LEFT JOIN inventory_transfers tr ON t.reference_type = 'TRANSFER' AND t.reference_id = tr.id
      LEFT JOIN stock_counts sc ON t.reference_type = 'STOCK_COUNT' AND t.reference_id = sc.id
      ${whereSql}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ${Number(limit)} OFFSET ${off}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM inventory_transactions t ${whereSql}`;
    const [rowsRes, cntRes] = await Promise.all([query(sql, params), query(countSql, params)]);
    return { items: rowsRes.rows, pagination: { page: Number(page), limit: Number(limit), total: cntRes.rows[0].total, totalPages: Math.ceil(cntRes.rows[0].total / Number(limit)) } };
  }
  async getOnHand({ itemId, warehouseId, binId } = {}) {
    const where = [];
    const params = [];
    let i = 1;
    if (itemId) { where.push(`il.item_id = $${i++}`); params.push(Number(itemId)); }
    if (warehouseId) { where.push(`il.warehouse_id = $${i++}`); params.push(Number(warehouseId)); }
    if (binId) { where.push(`il.bin_id = $${i++}`); params.push(Number(binId)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT 
        il.item_id,
        it.item_code,
        it.company_code,
        it.name AS item_name,
        it.is_returnable,
        it.manufacturer,
        it.spare_type,
        ic.name AS category_name,
        it.reorder_point,
        il.warehouse_id,
        wh.name AS warehouse_name,
        il.bin_id,
        b.bin_code AS bin_code,
        b.bin_type AS bin_type,
        -- Totals
        COALESCE(SUM(il.quantity), 0)::numeric AS on_hand_qty,
        -- Faulty/usable breakdown using QUARANTINE as FAULTY bucket
        COALESCE(SUM(CASE WHEN b.bin_type = 'QUARANTINE' THEN il.quantity ELSE 0 END), 0)::numeric AS faulty_on_hand_qty,
        (COALESCE(SUM(il.quantity), 0) - COALESCE(SUM(CASE WHEN b.bin_type = 'QUARANTINE' THEN il.quantity ELSE 0 END), 0))::numeric AS usable_on_hand_qty
      FROM inventory_layers il
      LEFT JOIN items it ON it.id = il.item_id
      LEFT JOIN item_categories ic ON ic.id = it.category_id
      LEFT JOIN warehouses wh ON wh.id = il.warehouse_id
      LEFT JOIN bins b ON b.id = il.bin_id
      ${whereSql}
      GROUP BY il.item_id, it.item_code, it.company_code, it.name, it.is_returnable, it.manufacturer, it.spare_type, ic.name, it.reorder_point, il.warehouse_id, wh.name, il.bin_id, b.bin_code, b.bin_type
      ORDER BY it.name NULLS LAST, wh.name NULLS LAST, b.bin_code NULLS LAST
    `;
    const { rows } = await query(sql, params);
    return rows;
  }

  async getValuation({ itemId, warehouseId } = {}) {
    const where = [];
    const params = [];
    let i = 1;
    if (itemId) { where.push(`il.item_id = $${i++}`); params.push(Number(itemId)); }
    if (warehouseId) { where.push(`il.warehouse_id = $${i++}`); params.push(Number(warehouseId)); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT 
        il.item_id,
        it.item_code,
        it.company_code,
        it.name AS item_name,
        it.manufacturer,
        it.spare_type,
        ic.name AS category_name,
        COALESCE(SUM(il.quantity), 0)::numeric AS on_hand_qty,
        CASE WHEN COALESCE(SUM(il.quantity), 0) = 0 THEN 0::numeric
             ELSE (COALESCE(SUM(il.total_cost), 0)::numeric / NULLIF(COALESCE(SUM(il.quantity), 0)::numeric, 0)) END AS avg_cost,
        COALESCE(SUM(il.total_cost), 0)::numeric AS total_value,
        -- Faulty/usable breakdown via bin_type
        COALESCE(SUM(CASE WHEN b.bin_type = 'QUARANTINE' THEN il.quantity ELSE 0 END), 0)::numeric AS faulty_qty,
        COALESCE(SUM(CASE WHEN b.bin_type = 'QUARANTINE' THEN il.total_cost ELSE 0 END), 0)::numeric AS faulty_value,
        (COALESCE(SUM(il.quantity), 0) - COALESCE(SUM(CASE WHEN b.bin_type = 'QUARANTINE' THEN il.quantity ELSE 0 END), 0))::numeric AS usable_qty,
        (COALESCE(SUM(il.total_cost), 0) - COALESCE(SUM(CASE WHEN b.bin_type = 'QUARANTINE' THEN il.total_cost ELSE 0 END), 0))::numeric AS usable_value
      FROM inventory_layers il
      LEFT JOIN items it ON it.id = il.item_id
      LEFT JOIN item_categories ic ON ic.id = it.category_id
      LEFT JOIN bins b ON b.id = il.bin_id
      ${whereSql}
      GROUP BY il.item_id, it.item_code, it.company_code, it.name, it.manufacturer, it.spare_type, ic.name
      ORDER BY it.name NULLS LAST
    `;
    const { rows } = await query(sql, params);
    return rows;
  }
}

export default new StockService();


