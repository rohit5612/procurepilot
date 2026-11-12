/**
 * Apply Prisma migrations using DATABASE_URL or DB_* from server .env.
 * Clears failed _prisma_migrations rows (rolled back) so deploy can retry — common after a partial Render build.
 */
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(serverRoot, '.env') });

const {
  DB_USER = 'postgres',
  DB_PASSWORD = '',
  DB_HOST = 'localhost',
  DB_PORT = '5432',
  DB_NAME = 'procurepilot'
} = process.env;

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = encodeURIComponent(DB_USER);
  const password = encodeURIComponent(String(DB_PASSWORD ?? ''));
  return `postgresql://${user}:${password}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public`;
}

const databaseUrl = buildDatabaseUrl();
const env = { ...process.env, DATABASE_URL: databaseUrl };

function runPrisma(args) {
  return spawnSync('npx', ['prisma', ...args], {
    cwd: serverRoot,
    env,
    stdio: 'inherit',
    shell: true
  });
}

async function listFailedMigrationNames() {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL
      ORDER BY started_at ASC
    `);
    return rows.map((r) => r.migration_name);
  } finally {
    await client.end();
  }
}

async function resetPublicSchemaIfRequested() {
  const flag = String(process.env.PRISMA_MIGRATE_RESET_PUBLIC ?? '').toLowerCase();
  if (!flag || flag === '0' || flag === 'false' || flag === 'no') {
    return;
  }

  console.warn(
    'PRISMA_MIGRATE_RESET_PUBLIC is set — dropping public schema (hackathon / empty DB only).'
  );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO public');
    const { rows } = await client.query('SELECT current_user AS u');
    const role = rows[0]?.u;
    if (role && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(role)) {
      await client.query(`GRANT ALL ON SCHEMA public TO ${role}`);
    }
  } finally {
    await client.end();
  }
}

async function resolveFailedMigrations() {
  let failed;
  try {
    failed = await listFailedMigrationNames();
  } catch (err) {
    if (err.code === '42P01') {
      return;
    }
    throw err;
  }

  for (const name of failed) {
    console.warn(`Marking failed migration as rolled back: ${name}`);
    const result = runPrisma(['migrate', 'resolve', '--rolled-back', name]);
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

function migrationTargetLabel() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL.replace(/^postgresql:/, 'http:'));
      const db = u.pathname.replace(/^\//, '') || DB_NAME;
      return `${u.hostname}:${u.port || DB_PORT}/${db}`;
    } catch {
      return '(DATABASE_URL)';
    }
  }
  return `${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

async function main() {
  console.log(`Applying Prisma migrations to ${migrationTargetLabel()} ...`);

  await resetPublicSchemaIfRequested();

  const compose = spawnSync('node', ['scripts/db/compose-prisma-migrations.js'], {
    cwd: serverRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  if (compose.status !== 0) {
    process.exit(compose.status ?? 1);
  }

  await resolveFailedMigrations();

  const deploy = runPrisma(['migrate', 'deploy']);
  process.exit(deploy.status ?? 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
