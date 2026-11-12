/**
 * Update PR/PO generators on an existing database (no Prisma baseline required).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDatabase, query } from '../../src/database/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../../scripts/procurepilot_document_numbering.sql');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await connectDatabase();
  await query(sql);
  console.log('PR/PO document numbering updated to ProcurePilot standard (PR/FY/seq, PO/FY/seq).');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
