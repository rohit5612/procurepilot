/**
 * Apply Prisma migrations using DATABASE_URL derived from server .env (DB_*).
 */
import { spawnSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
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

const user = encodeURIComponent(DB_USER);
const password = encodeURIComponent(String(DB_PASSWORD ?? ''));
const databaseUrl = `postgresql://${user}:${password}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public`;

const env = { ...process.env, DATABASE_URL: databaseUrl };

console.log(`Applying Prisma migrations to ${DB_HOST}:${DB_PORT}/${DB_NAME} ...`);

const compose = spawnSync('node', ['scripts/db/compose-prisma-migrations.js'], {
  cwd: serverRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

if (compose.status !== 0) {
  process.exit(compose.status ?? 1);
}

const deploy = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  cwd: serverRoot,
  env,
  stdio: 'inherit',
  shell: true
});

process.exit(deploy.status ?? 1);
