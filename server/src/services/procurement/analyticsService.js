import { query } from '../../database/connection.js';

function buildFilters({ from, to, statuses = ['issued', 'closed'] } = {}) {
  const clauses = [];
  const params = [];
  let p = 1;

  // Date window on effective PO date
  if (from) {
    clauses.push(`COALESCE(po.issued_at, po.approved_at, po.created_at) >= $${p++}::timestamptz`);
    params.push(from);
  }
  if (to) {
    clauses.push(`COALESCE(po.issued_at, po.approved_at, po.created_at) <= $${p++}::timestamptz`);
    params.push(to);
  }

  // Status filter (issued/closed by default)
  if (Array.isArray(statuses) && statuses.length) {
    clauses.push(`po.status = ANY($${p++}::po_status[])`);
    params.push(statuses);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereSql, params };
}

class ProcurementAnalyticsService {
  // 1) Monthly procurement spend from po_lines.total_price
  async getMonthlySpend({ from, to, statuses = ['issued', 'closed'] } = {}) {
    const { whereSql, params } = buildFilters({ from, to, statuses });

    const sql = `
      SELECT to_char(date_trunc('month', COALESCE(po.issued_at, po.approved_at, po.created_at)), 'YYYY-MM') AS ym,
             COALESCE(SUM(pl.total_price), 0)::numeric AS total
      FROM purchase_orders po
      JOIN po_lines pl ON pl.purchase_order_id = po.id
      ${whereSql}
      GROUP BY ym
      ORDER BY ym ASC
    `;

    const { rows } = await query(sql, params);
    return rows.map(r => ({ label: r.ym, value: Number(r.total || 0) }));
  }

  // 2) Cluster-wise purchase breakdown (sum(po_lines.total_price) grouped by cluster)
  async getDepartmentBreakdown({ from, to, statuses = ['issued', 'closed'] } = {}) {
    const { whereSql, params } = buildFilters({ from, to, statuses });

    const sql = `
      SELECT COALESCE(c.name, 'Unassigned') AS cluster_name,
             COALESCE(SUM(pl.total_price), 0)::numeric AS total
      FROM purchase_orders po
      JOIN po_lines pl ON pl.purchase_order_id = po.id
      LEFT JOIN clusters c ON c.id = po.cluster_id
      ${whereSql}
      GROUP BY cluster_name
      ORDER BY total DESC
    `;

    const { rows } = await query(sql, params);
    return rows.map(r => ({ label: r.cluster_name, value: Number(r.total || 0) }));
  }

  // 3) Top suppliers by purchase volume from po_lines.total_price
  async getTopSuppliers({ from, to, limit = 5, statuses = ['issued', 'closed'] } = {}) {
    const { whereSql, params } = buildFilters({ from, to, statuses });

    const sql = `
      SELECT COALESCE(s.name, 'Unknown Supplier') AS supplier_name,
             COALESCE(SUM(pl.total_price), 0)::numeric AS total
      FROM purchase_orders po
      JOIN po_lines pl ON pl.purchase_order_id = po.id
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      ${whereSql}
      GROUP BY supplier_name
      ORDER BY total DESC
      LIMIT ${Math.max(1, Math.min(50, Number(limit) || 5))}
    `;

    const { rows } = await query(sql, params);
    return rows.map(r => ({ label: r.supplier_name, value: Number(r.total || 0) }));
  }
}

export default new ProcurementAnalyticsService();


