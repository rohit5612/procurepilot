import { query } from '../../database/connection.js';

const controller = {
  async list(req, res) {
    try {
      const { include_inactive } = req.query || {};
      const rows = await query(
        `SELECT id, category_code, name, description, sort_order, is_active, created_at, updated_at
         FROM transaction_categories
         ${include_inactive ? '' : 'WHERE is_active = TRUE'}
         ORDER BY sort_order, name`
      );
      res.json({ success: true, data: rows.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const rows = await query(`SELECT id, category_code, name, description, sort_order, is_active, created_at, updated_at FROM transaction_categories WHERE id = $1`, [Number(id)]);
      if (rows.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: rows.rows[0] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  },

  async create(req, res) {
    try {
      const { category_code, name, description, sort_order, is_active = true } = req.body || {};
      if (!category_code || !name) return res.status(400).json({ success: false, message: 'category_code and name are required' });
      const rows = await query(
        `INSERT INTO transaction_categories (category_code, name, description, sort_order, is_active)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [String(category_code), String(name), description || null, Number(sort_order || 0), Boolean(is_active)]
      );
      res.status(201).json({ success: true, data: rows.rows[0] });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  },

  async update(req, res) {
    try {
      const { id } = req.params;
      const { category_code, name, description, sort_order, is_active } = req.body || {};
      const fields = []; const params = []; let i = 1;
      const set = (col, val) => { fields.push(`${col} = $${i++}`); params.push(val); };
      if (category_code != null) set('category_code', String(category_code));
      if (name != null) set('name', String(name));
      if (description !== undefined) set('description', description || null);
      if (sort_order !== undefined) set('sort_order', Number(sort_order || 0));
      if (is_active !== undefined) set('is_active', Boolean(is_active));
      set('updated_at', new Date());
      params.push(Number(id));
      if (!fields.length) return res.json({ success: true, message: 'No changes' });
      const rows = await query(`UPDATE transaction_categories SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, params);
      if (rows.rows.length === 0) return res.status(404).json({ success: false, message: 'Not found' });
      res.json({ success: true, data: rows.rows[0] });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  },

  async remove(req, res) {
    try {
      const { id } = req.params;
      // Prevent delete if referenced
      const refPo = await query('SELECT 1 FROM purchase_orders WHERE transaction_category_id = $1 LIMIT 1', [Number(id)]);
      const refIss = await query('SELECT 1 FROM inventory_issues WHERE transaction_category_id = $1 LIMIT 1', [Number(id)]);
      if (refPo.rows.length || refIss.rows.length) {
        return res.status(409).json({ success: false, message: 'Category is in use; deactivate instead' });
      }
      await query('DELETE FROM transaction_categories WHERE id = $1', [Number(id)]);
      res.json({ success: true, deleted: true });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
};

export default controller;


