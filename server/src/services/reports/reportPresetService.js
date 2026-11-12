import { query } from '../../database/connection.js';

async function ensureTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS report_presets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      report_type VARCHAR(200) NOT NULL,
      name VARCHAR(200) NOT NULL,
      columns JSONB NOT NULL DEFAULT '[]'::jsonb,
      filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_global BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_report_presets_user_type ON report_presets(user_id, report_type)`);
}

class ReportPresetService {
  async listForUser({ userId, reportType }) {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    await ensureTable();

    const params = [userId];
    let sql = `
      SELECT id, report_type, name, columns, filters, is_global, created_at, updated_at
      FROM report_presets
      WHERE user_id = $1
    `;
    if (reportType) {
      sql += ' AND report_type = $2';
      params.push(reportType);
    }
    sql += ' ORDER BY LOWER(name)';

    const { rows } = await query(sql, params);
    return rows;
  }

  async createForUser({ userId, reportType, name, columns, filters }) {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    if (!reportType) {
      throw new Error('report_type is required');
    }
    if (!name || !String(name).trim()) {
      throw new Error('Preset name is required');
    }

    await ensureTable();

    const cols = Array.isArray(columns) ? columns.map((c) => String(c)) : [];
    const filts = filters && typeof filters === 'object' ? filters : {};

    const res = await query(
      `
        INSERT INTO report_presets (user_id, report_type, name, columns, filters)
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
        RETURNING id, report_type, name, columns, filters, is_global, created_at, updated_at
      `,
      [userId, reportType, String(name).trim(), JSON.stringify(cols), JSON.stringify(filts)]
    );

    return res.rows[0];
  }

  async updateForUser({ userId, presetId, name, columns, filters }) {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    await ensureTable();

    const fields = [];
    const params = [];
    let i = 1;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        throw new Error('Preset name is required');
      }
      fields.push(`name = $${i++}`);
      params.push(trimmed);
    }

    if (columns !== undefined) {
      const cols = Array.isArray(columns) ? columns.map((c) => String(c)) : [];
      fields.push(`columns = $${i++}::jsonb`);
      params.push(JSON.stringify(cols));
    }

    if (filters !== undefined) {
      const filts = filters && typeof filters === 'object' ? filters : {};
      fields.push(`filters = $${i++}::jsonb`);
      params.push(JSON.stringify(filts));
    }

    if (fields.length === 0) {
      throw new Error('Nothing to update');
    }

    // updated_at
    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    params.push(Number(presetId));
    params.push(userId);

    const sql = `
      UPDATE report_presets
      SET ${fields.join(', ')}
      WHERE id = $${i++} AND user_id = $${i}
      RETURNING id, report_type, name, columns, filters, is_global, created_at, updated_at
    `;

    const res = await query(sql, params);
    if (res.rowCount === 0) {
      throw new Error('Preset not found');
    }

    return res.rows[0];
  }

  async deleteForUser({ userId, presetId }) {
    if (!userId) {
      throw new Error('User not authenticated');
    }
    await ensureTable();

    const res = await query(
      'DELETE FROM report_presets WHERE id = $1 AND user_id = $2',
      [Number(presetId), userId]
    );

    return { deleted: res.rowCount > 0 };
  }
}

export default new ReportPresetService();


