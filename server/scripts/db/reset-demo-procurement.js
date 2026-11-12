/**
 * Reset procurement transactional data + masters, then seed ProcurePilot E2E demo catalog.
 *
 * Usage (from server/): npm run db:demo-reset
 * Keeps: users, roles, telecom circles, UOM, policies, workflows definitions.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { query } from '../../src/database/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlDir = path.resolve(__dirname, '../../prisma/sql/custom');

function loadSql(filename) {
  return fs.readFileSync(path.join(sqlDir, filename), 'utf8');
}

/** Tables cleared in FK-safe order; missing tables are skipped (trimmed schemas). */
const OPTIONAL_TRUNCATES = [
  'quotation_lines',
  'supplier_quotations',
  'rfq_invitations',
  'rfq_lines',
  'rfqs',
  'supplier_invoice_lines',
  'supplier_invoices',
  'srn_lines',
  'store_return_notes',
  'po_amendments',
  'grn_lines',
  'goods_receipts',
  'po_lines',
  'purchase_orders',
  'requisition_lines',
  'requisitions',
  'budget_commitments',
  'budget_ledger',
  'inventory_transactions',
  'inventory_layers',
  'price_list_import_item_logs',
  'price_list_import_logs',
  'item_prices',
  'supplier_items',
  'supplier_contacts',
  'supplier_circles',
  'supplier_clusters',
  'price_lists',
  'suppliers',
  'items',
  'item_categories',
  'warehouse_bins',
  'warehouse_zones',
  'warehouses',
  'payment_events',
  'purchase_requests'
];

async function tableExists(name) {
  const res = await query('SELECT to_regclass($1) AS reg', [`public.${name}`]);
  return Boolean(res.rows[0]?.reg);
}

async function truncateOptionalTables() {
  const existing = [];
  for (const name of OPTIONAL_TRUNCATES) {
    if (await tableExists(name)) existing.push(name);
  }
  if (existing.length === 0) return;

  await query(`TRUNCATE TABLE ${existing.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

async function run() {
  console.log('ProcurePilot demo reset: clearing procurement data and masters...');

  if (await tableExists('workflow_tasks') && await tableExists('workflow_instances')) {
    await query(`
      DELETE FROM workflow_tasks
      WHERE instance_id IN (
        SELECT id FROM workflow_instances
        WHERE entity_type IN ('requisition', 'purchase_order', 'goods_receipt')
      )
    `);
    await query(`
      DELETE FROM workflow_instances
      WHERE entity_type IN ('requisition', 'purchase_order', 'goods_receipt')
    `);
  }

  if (await tableExists('suppliers') && await tableExists('price_lists')) {
    await query('UPDATE suppliers SET applied_price_list_id = NULL WHERE applied_price_list_id IS NOT NULL');
  }

  await truncateOptionalTables();

  if (await tableExists('sites')) {
    await query('DELETE FROM sites');
  }

  if (await tableExists('clusters') && await tableExists('telecom_circles')) {
    await query(`
      DELETE FROM clusters c
      USING telecom_circles tc
      WHERE c.circle_id = tc.id
        AND tc.code IN ('RJ', 'DL')
        AND c.code IN ('JAI', 'UDR', 'NCR')
    `);
  }

  const seedSql = loadSql('016_demo_procurement_seed.sql');
  console.log('Seeding demo sites, items, suppliers, and price lists...');
  await query(seedSql);

  const summary = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM items) AS items,
      (SELECT COUNT(*)::int FROM suppliers) AS suppliers,
      (SELECT COUNT(*)::int FROM price_lists) AS price_lists,
      (SELECT COUNT(*)::int FROM item_prices) AS item_prices,
      (SELECT COUNT(*)::int FROM sites) AS sites,
      (SELECT COUNT(*)::int FROM warehouses) AS warehouses,
      (SELECT COUNT(*)::int FROM requisitions) AS requisitions,
      (SELECT COUNT(*)::int FROM purchase_orders) AS purchase_orders
  `);

  console.log('Demo seed complete:', summary.rows[0]);
  console.log('E2E: PR at PP-JAI-01 → approve → generate PO (prices from list) → issue → GRN.');
}

run()
  .catch((err) => {
    console.error('db:demo-reset failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => pool.end());
