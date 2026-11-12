import express from 'express';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { query } from '../../database/connection.js';

const router = express.Router();

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

// Aggregated search across key modules
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.json({
        success: true,
        data: { users: [], requisitions: [], purchase_orders: [], audit_logs: [], items: [] }
      });
    }

    const like = `%${q}%`;

    const auditTableExists = await tableExists('audit_logs');

    const promises = [
      query(
        `SELECT id, email, username, first_name, last_name
         FROM users
         WHERE email ILIKE $1 OR username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1
         LIMIT 5`,
        [like]
      ),
      query(
        `SELECT id, requisition_number, status
         FROM requisitions
         WHERE requisition_number ILIKE $1
         LIMIT 5`,
        [like]
      ),
      query(
        `SELECT id, po_number, status
         FROM purchase_orders
         WHERE po_number ILIKE $1
         LIMIT 5`,
        [like]
      ),
      auditTableExists
        ? query(
            `SELECT 
               a.id,
               a.action::text AS action,
               COALESCE(u.full_name, u.email, a.user_id::text) AS actor,
               a.created_at
             FROM audit_logs a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.action::text ILIKE $1
                OR COALESCE(u.full_name, '') ILIKE $1
                OR COALESCE(u.email, '') ILIKE $1
             ORDER BY a.created_at DESC
             LIMIT 5`,
            [like]
          )
        : Promise.resolve({ rows: [] }),
      query(
        `SELECT id, name
         FROM items
         WHERE name ILIKE $1
         LIMIT 5`,
        [like]
      )
    ];

    const [usersRes, prRes, poRes, auditRes, itemRes] = await Promise.all(promises);

    res.json({
      success: true,
      data: {
        users: usersRes.rows,
        requisitions: prRes.rows,
        purchase_orders: poRes.rows,
        audit_logs: auditRes.rows,
        items: itemRes.rows
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;


