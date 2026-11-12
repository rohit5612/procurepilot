import { query } from '../../database/connection.js';

async function tableExists(tableName) {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return !!rows?.[0]?.exists;
}

function buildRangeWhere(range) {
  if (!range) return { sql: '', params: [] };
  const r = String(range).toLowerCase();
  if (r.endsWith('h')) {
    const hours = Number(r.slice(0, -1)) || 24;
    return { sql: 'created_at >= NOW() - $1::interval', params: [`${hours} hours`] };
  }
  if (r.endsWith('d')) {
    const days = Number(r.slice(0, -1)) || 1;
    return { sql: 'created_at >= NOW() - $1::interval', params: [`${days} days`] };
  }
  return { sql: '', params: [] };
}

export async function getAuditLogs(req, res) {
  try {
    const { q = '', range = '', page = 1, limit = 50 } = req.query || {};
    const exists = await tableExists('audit_logs');
    if (!exists) return res.json({ success: true, data: [], pagination: { page: 1, limit: Number(limit), total: 0, totalPages: 0 } });

    const conditions = [];
    const params = [];
    let i = 1;
    if (q) { conditions.push(`(action::text ILIKE $${i} OR resource_type ILIKE $${i} OR error_message ILIKE $${i})`); params.push(`%${q}%`); i++; }
    const rangeWhere = buildRangeWhere(range);
    if (rangeWhere.sql) { conditions.push(rangeWhere.sql.replace('$1', `$${i}`)); params.push(rangeWhere.params[0]); i++; }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const off = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT id, user_id, action::text AS action, resource_type, resource_id, success, error_message, duration_ms, description, metadata, created_at
      FROM audit_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${Number(limit)} OFFSET ${off}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM audit_logs ${whereSql}`;
    const [rowsRes, cntRes] = await Promise.all([query(sql, params), query(countSql, params)]);
    const total = cntRes.rows?.[0]?.total || 0;
    return res.json({ success: true, data: rowsRes.rows, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

export async function getActivityLogs(req, res) {
  try {
    const { q = '', range = '', page = 1, limit = 50 } = req.query || {};
    const exists = await tableExists('module_registration_logs');
    if (!exists) return res.json({ success: true, data: [], pagination: { page: 1, limit: Number(limit), total: 0, totalPages: 0 } });

    const conditions = [];
    const params = [];
    let i = 1;
    if (q) { conditions.push(`(action ILIKE $${i} OR error_message ILIKE $${i})`); params.push(`%${q}%`); i++; }
    const rangeWhere = buildRangeWhere(range);
    if (rangeWhere.sql) { conditions.push(rangeWhere.sql.replace('$1', `$${i}`)); params.push(rangeWhere.params[0]); i++; }
    const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const off = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT id, module_id, action, actor_id, payload, results, error_message, created_at
      FROM module_registration_logs
      ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${Number(limit)} OFFSET ${off}
    `;
    const countSql = `SELECT COUNT(*)::int AS total FROM module_registration_logs ${whereSql}`;
    const [rowsRes, cntRes] = await Promise.all([query(sql, params), query(countSql, params)]);
    const total = cntRes.rows?.[0]?.total || 0;
    return res.json({ success: true, data: rowsRes.rows, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}

export async function getErrorLogs(req, res) {
  try {
    const { range = '', page = 1, limit = 50 } = req.query || {};
    const auditExists = await tableExists('audit_logs');
    const modExists = await tableExists('module_registration_logs');

    const off = (Number(page) - 1) * Number(limit);
    const rangeWhere = buildRangeWhere(range);
    let auditRows = [];
    let modRows = [];
    if (auditExists) {
      const whereAudit = `WHERE (success = false OR error_message IS NOT NULL)` + (rangeWhere.sql ? ` AND ${rangeWhere.sql.replace('$1', '$1')}` : '');
      const auditSql = `SELECT 'audit' AS source, id, user_id AS actor_id, action::text AS action, error_message AS message, metadata, created_at FROM audit_logs ${whereAudit} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${off}`;
      const auditParams = rangeWhere.params.length ? [rangeWhere.params[0]] : [];
      const aRes = await query(auditSql, auditParams);
      auditRows = aRes.rows;
    }
    if (modExists) {
      const whereMod = `WHERE (error_message IS NOT NULL)` + (rangeWhere.sql ? ` AND ${rangeWhere.sql.replace('$1', '$1')}` : '');
      const modSql = `SELECT 'module_registry' AS source, id, actor_id, action, error_message AS message, payload AS metadata, created_at FROM module_registration_logs ${whereMod} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${off}`;
      const modParams = rangeWhere.params.length ? [rangeWhere.params[0]] : [];
      const mRes = await query(modSql, modParams);
      modRows = mRes.rows;
    }
    const combined = [...auditRows, ...modRows].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return res.json({ success: true, data: combined.slice(0, Number(limit)), pagination: { page: Number(page), limit: Number(limit), total: combined.length, totalPages: Math.ceil(combined.length / Number(limit)) } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
}


