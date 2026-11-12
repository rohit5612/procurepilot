/**
 * Update PR/PO generators on an existing database (no Prisma baseline required).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDatabase, query } from '../../src/database/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPaths = [
  path.resolve(__dirname, '../../../scripts/procurepilot_document_numbering.sql'),
  path.resolve(__dirname, '../../prisma/sql/custom/018_grn_document_numbering.sql')
];

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  await connectDatabase();
  for (const sqlPath of sqlPaths) {
    if (!fs.existsSync(sqlPath)) continue;
    await query(fs.readFileSync(sqlPath, 'utf8'));
  }
  console.log('Document numbering updated: PR/FY/seq, PO/FY/seq, GRN/FY/seq (no VRP).');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
