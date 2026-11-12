/**
 * Remove real/demo clutter: drop named accounts, purge archives/appeals/approvals
 * except @test.com demo users. Keeps superuser + protected system accounts.
 *
 * Usage (from server/): npm run db:demo-user-hygiene
 */
import pool, { query, transaction } from '../../src/database/connection.js';

const REMOVED_USERNAMES = new Set(['rohit56', 'qa_tester12', 'chicha00', 'rohit_qa']);
const REMOVED_EMAILS = new Set([
  'rishida1raegetsu@gmail.com',
  'rohit506n@gmail.com',
  'sspedmz@gmail.com'
]);

const PRESERVE_EMAIL_SQL = `
  email ILIKE '%@test.com'
  OR email IN ('admin@erp.com', 'admin@procurepilot.dev', 'backup@erp.com')
`;

async function purgeUser(client, userId) {
  await client.query('DELETE FROM user_appeals WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

  const tokenExists = await client.query(
    `SELECT to_regclass('public.email_verification_tokens') AS reg`
  );
  if (tokenExists.rows[0]?.reg) {
    await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [userId]);
  }

  await client.query('DELETE FROM users WHERE id = $1', [userId]);
}

async function run() {
  console.log('Demo user hygiene: removing real accounts and non-@test.com approval noise...');

  const archiveRes = await query(`
    DELETE FROM archived_user_roles
    WHERE archived_user_id IN (
      SELECT id FROM archived_users WHERE email NOT ILIKE '%@test.com'
    )
  `);
  const archivedRes = await query(`DELETE FROM archived_users WHERE email NOT ILIKE '%@test.com'`);

  const appealsRes = await query(`
    DELETE FROM user_appeals ua
    USING users u
    WHERE ua.user_id = u.id AND u.email NOT ILIKE '%@test.com'
  `);

  const targets = await query(`
    SELECT id, username, email, is_superuser, is_protected
    FROM users
    WHERE (
      username = ANY($1::text[])
      OR LOWER(email) = ANY($2::text[])
      OR (email IS NOT NULL AND email NOT ILIKE '%@test.com' AND NOT (${PRESERVE_EMAIL_SQL}))
    )
      AND COALESCE(is_superuser, false) = false
      AND COALESCE(is_protected, false) = false
    ORDER BY id
  `, [[...REMOVED_USERNAMES], [...REMOVED_EMAILS].map((e) => e.toLowerCase())]);

  let purged = 0;
  await transaction(async (client) => {
    for (const row of targets.rows) {
      await purgeUser(client, row.id);
      purged += 1;
      console.log(`  removed user #${row.id} ${row.username || '(no username)'} <${row.email}>`);
    }
  });

  const summary = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS users,
      (SELECT COUNT(*)::int FROM users WHERE approval_status = 'pending') AS pending_approvals,
      (SELECT COUNT(*)::int FROM users WHERE approval_status = 'rejected') AS rejected_approvals,
      (SELECT COUNT(*)::int FROM archived_users) AS archived_rows,
      (SELECT COUNT(*)::int FROM user_appeals) AS appeal_rows
  `);

  console.log('Hygiene complete:', {
    purged_users: purged,
    archived_deleted: archivedRes.rowCount,
    archive_roles_deleted: archiveRes.rowCount,
    appeals_deleted: appealsRes.rowCount,
    ...summary.rows[0]
  });
}

run()
  .catch((err) => {
    console.error('db:demo-user-hygiene failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => pool.end());
