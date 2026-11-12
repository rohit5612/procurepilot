/**
 * Two @test.com demo users: L3 manager (procurement + budgets) and L5 basic (no module access).
 *
 * Usage: npm run db:seed-demo-users
 */
import bcrypt from 'bcryptjs';
import pool, { query, transaction } from '../../src/database/connection.js';
import roleService from '../../src/services/roles/roleService.js';

const DEMO_PASSWORD = 'Test@2025!';

const KEEP = [
  { email: 'demo.manager@test.com', username: 'demo_manager', first: 'Demo', last: 'Manager', level: 3, roleName: 'manager' },
  { email: 'demo.viewer@test.com', username: 'demo_viewer', first: 'Demo', last: 'Viewer', level: 5, roleName: 'basic_user' }
];

async function reassignUserFk(client, userId, adminId) {
  const tables = [
    ['requisitions', 'requester_id'],
    ['requisitions', 'created_by'],
    ['requisitions', 'updated_by'],
    ['requisitions', 'submitted_by'],
    ['requisitions', 'approved_by'],
    ['requisitions', 'rejected_by']
  ];
  for (const [table, col] of tables) {
    const reg = await client.query(`SELECT to_regclass($1) AS r`, [`public.${table}`]);
    if (!reg.rows[0]?.r) continue;
    await client.query(
      `UPDATE ${table} SET ${col} = $1 WHERE ${col} = $2`,
      [adminId, userId]
    );
  }
}

async function purgeExtraTestUsers(client, adminId) {
  const keepEmails = KEEP.map((u) => u.email.toLowerCase());
  const victims = await client.query(
    `SELECT id, email FROM users
     WHERE email ILIKE '%@test.com' AND LOWER(email) <> ALL($1::text[])`,
    [keepEmails]
  );
  for (const row of victims.rows) {
    await reassignUserFk(client, row.id, adminId);
    await client.query('DELETE FROM user_appeals WHERE user_id = $1', [row.id]);
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [row.id]);
    await client.query('DELETE FROM users WHERE id = $1', [row.id]);
    console.log(`  removed ${row.email}`);
  }
}

async function upsertDemoUser(client, spec, passwordHash, adminId) {
  const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [spec.email]);
  let userId;
  if (existing.rows.length) {
    userId = existing.rows[0].id;
    await client.query(
      `UPDATE users SET
         username = $2,
         first_name = $3,
         last_name = $4,
         full_name = $5,
         password_hash = $6,
         status = 'active',
         approval_status = 'approved',
         email_verified = true,
         updated_at = NOW()
       WHERE id = $1`,
      [userId, spec.username, spec.first, spec.last, `${spec.first} ${spec.last}`, passwordHash]
    );
  } else {
    const ins = await client.query(
      `INSERT INTO users (
         email, username, password_hash, first_name, last_name, full_name,
         status, approval_status, email_verified, approved_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,'active','approved',true,NOW(),NOW(),NOW())
       RETURNING id`,
      [spec.email, spec.username, passwordHash, spec.first, spec.last, `${spec.first} ${spec.last}`]
    );
    userId = ins.rows[0].id;
  }

  const deptRes = await client.query(`SELECT id FROM departments WHERE department_code = 'PROC' LIMIT 1`);
  const roleRes = await client.query(
    `SELECT id, department_id FROM roles WHERE name = $1 AND department_id = $2 LIMIT 1`,
    [spec.roleName, deptRes.rows[0]?.id]
  );
  if (!roleRes.rows.length) {
    throw new Error(`Template role ${spec.roleName} not found — run db:demo-rbac-reset first`);
  }
  const roleId = roleRes.rows[0].id;
  const departmentId = roleRes.rows[0].department_id;

  await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
  await client.query(
    `INSERT INTO user_roles (user_id, department_id, role_id, assigned_by, is_active, assigned_at, updated_at, updated_by)
     VALUES ($1, $2, $3, $4, true, NOW(), NOW(), $4)`,
    [userId, departmentId, roleId, adminId]
  );
  return { userId, roleId, departmentId, email: spec.email, level: spec.level };
}

async function refreshRolePermissions(client, roleNames) {
  const deptRes = await client.query(`SELECT id FROM departments WHERE department_code = 'PROC' LIMIT 1`);
  const departmentId = deptRes.rows[0].id;
  for (const name of roleNames) {
    const roleRes = await client.query(
      `SELECT id, role_level FROM roles WHERE name = $1 AND department_id = $2`,
      [name, departmentId]
    );
    const role = roleRes.rows[0];
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id]);
    await roleService.assignRolePermissionsByLevel(client, role.id, departmentId, role.role_level);
    console.log(`  refreshed permissions: ${name} (L${role.role_level})`);
  }
}

async function run() {
  console.log('Seeding two demo @test.com users (L3 manager + L5 viewer)...');

  const adminRes = await query(
    `SELECT id FROM users WHERE is_superuser = true OR username = 'admin' ORDER BY is_superuser DESC LIMIT 1`
  );
  const adminId = adminRes.rows[0]?.id ?? 1;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const assigned = await transaction(async (client) => {
    await purgeExtraTestUsers(client, adminId);
    await refreshRolePermissions(client, ['manager', 'basic_user']);

    const results = [];
    for (const spec of KEEP) {
      results.push(await upsertDemoUser(client, spec, passwordHash, adminId));
    }
    return results;
  });

  console.log('\nDemo logins (password for both: Test@2025!):');
  for (const row of assigned) {
    console.log(`  ${row.email} — L${row.level}`);
  }
}

run()
  .catch((err) => {
    console.error('db:seed-demo-users failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => pool.end());
