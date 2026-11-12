/**
 * Mark all composed Prisma migrations as applied without executing SQL.
 * Use once when the database already matches the legacy schema.
 */
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
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

const migrationsDir = path.join(serverRoot, 'prisma', 'migrations');
const folders = fs
  .readdirSync(migrationsDir)
  .filter((f) => fs.statSync(path.join(migrationsDir, f)).isDirectory())
  .sort();

for (const folder of folders) {
  console.log(`Resolving ${folder} ...`);
  const result = spawnSync('npx', ['prisma', 'migrate', 'resolve', '--applied', folder], {
    cwd: serverRoot,
    env,
    stdio: 'inherit',
    shell: true
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Baseline complete. Future schema changes: add migration 11+ via prisma migrate dev.');
