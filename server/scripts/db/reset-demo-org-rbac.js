/**
 * Reset org structure for demo: one Procurement department, L1–L5 template roles only,
 * cleared user-role assignments (assign manually), enterprise policy caps.
 *
 * Usage (from server/): npm run db:demo-rbac-reset
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { query, transaction } from '../../src/database/connection.js';
import departmentService from '../../src/services/departments/departmentService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(__dirname, '../../prisma/sql/custom');

const MODULE_NAMES = ['user_management', 'procurement', 'inventory', 'procurepilot'];

function loadSql(filename) {
  return fs.readFileSync(path.join(sqlDir, filename), 'utf8');
}

async function run() {
  console.log('ProcurePilot demo RBAC reset: one department, template roles L1–L5...');

  const adminRes = await query(
    `SELECT id FROM users WHERE username = 'admin' OR is_superuser = true ORDER BY is_superuser DESC NULLS LAST LIMIT 1`
  );
  const adminId = adminRes.rows[0]?.id ?? 1;

  await query(loadSql('017_demo_org_rbac_seed.sql'));

  await transaction(async (client) => {
    const deptRes = await client.query(
      `SELECT id FROM departments WHERE department_code = 'PROC' LIMIT 1`
    );
    const departmentId = deptRes.rows[0]?.id;
    if (!departmentId) {
      throw new Error('PROC department missing after seed SQL');
    }

    await client.query('DELETE FROM department_modules WHERE department_id = $1', [departmentId]);

    const moduleRes = await client.query(
      `SELECT id, name FROM modules WHERE name = ANY($1::text[]) AND is_active = true`,
      [MODULE_NAMES]
    );

    for (const row of moduleRes.rows) {
      await client.query(
        `INSERT INTO department_modules (department_id, module_id, is_active, granted_by)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (department_id, module_id) DO UPDATE SET is_active = true`,
        [departmentId, row.id, adminId]
      );
    }

    await departmentService.createDefaultRoleTemplates(client, departmentId, adminId);
  });

  const summary = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM departments WHERE is_active) AS departments,
      (SELECT COUNT(*)::int FROM roles WHERE role_type = 'template') AS template_roles,
      (SELECT COUNT(*)::int FROM roles WHERE role_type = 'custom') AS custom_roles,
      (SELECT COUNT(*)::int FROM user_roles) AS user_role_assignments,
      (SELECT json_agg(json_build_object('level', role_level, 'max_txn', max_per_transaction)
             ORDER BY role_level)
         FROM procurement_role_policies) AS policies
  `);

  console.log('RBAC reset complete:', summary.rows[0]);
  console.log('Assign users under User Management → User Assignment (Procurement / L2–L5 templates).');
}

run()
  .catch((err) => {
    console.error('db:demo-rbac-reset failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => pool.end());
