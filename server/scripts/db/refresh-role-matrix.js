/**
 * Re-apply ProcurePilot template permissions L1–L5 (after roleService matrix changes).
 *
 * Usage: npm run db:refresh-role-matrix
 */
import pool, { query, transaction } from '../../src/database/connection.js';
import roleService from '../../src/services/roles/roleService.js';

const TEMPLATE_NAMES = [
  'department_admin',
  'department_head',
  'manager',
  'senior_user',
  'basic_user'
];

async function run() {
  console.log('Refreshing role permission matrix for PROCUREMENT template roles...');

  const dept = await query(`SELECT id FROM departments WHERE department_code = 'PROC' LIMIT 1`);
  const departmentId = dept.rows[0]?.id;
  if (!departmentId) {
    throw new Error('PROC department missing — run npm run db:demo-rbac-reset first');
  }

  await transaction(async (client) => {
    for (const name of TEMPLATE_NAMES) {
      const roleRes = await client.query(
        `SELECT id, role_level FROM roles WHERE name = $1 AND department_id = $2`,
        [name, departmentId]
      );
      const role = roleRes.rows[0];
      if (!role) {
        console.warn(`  skip missing template: ${name}`);
        continue;
      }
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id]);
      await roleService.assignRolePermissionsByLevel(client, role.id, departmentId, role.role_level);
      console.log(`  L${role.role_level} ${name}`);
    }
  });

  const counts = await query(`
    SELECT r.role_level, r.name, COUNT(rp.id)::int AS perms
    FROM roles r
    LEFT JOIN role_permissions rp ON rp.role_id = r.id
    WHERE r.department_id = $1 AND r.role_type = 'template'
    GROUP BY r.role_level, r.name
    ORDER BY r.role_level
  `, [departmentId]);

  console.table(counts.rows);
}

run()
  .catch((e) => {
    console.error('db:refresh-role-matrix failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => pool.end());
