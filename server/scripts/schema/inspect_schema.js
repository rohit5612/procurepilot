import { query, closeDatabase } from '../../src/database/connection.js';

async function getTables() {
  const res = await query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return res.rows.map(r => r.table_name);
}

async function getColumns(table) {
  const res = await query(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return res.rows;
}

async function getPrimaryKeys(table) {
  const res = await query(
    `SELECT kcu.column_name
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
     WHERE tc.table_schema = 'public'
       AND tc.table_name = $1
       AND tc.constraint_type = 'PRIMARY KEY'
     ORDER BY kcu.ordinal_position`,
    [table]
  );
  return res.rows.map(r => r.column_name);
}

async function getForeignKeys(table) {
  const res = await query(
    `SELECT c.conname AS constraint_name, pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON c.conrelid = t.oid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = $1
       AND c.contype = 'f'
     ORDER BY c.conname`,
    [table]
  );
  return res.rows;
}

async function getIndexes(table) {
  const res = await query(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1
     ORDER BY indexname`,
    [table]
  );
  return res.rows;
}

async function getViews() {
  const res = await query(
    `SELECT table_name AS view_name, view_definition
     FROM information_schema.views
     WHERE table_schema = 'public'
     ORDER BY table_name`
  );
  return res.rows;
}

async function getFunctions() {
  const res = await query(
    `SELECT p.proname AS function_name,
            pg_get_function_identity_arguments(p.oid) AS arguments,
            n.nspname AS schema
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
     ORDER BY p.proname`
  );
  return res.rows;
}

async function getAuditLogPartitions() {
  const res = await query(
    `SELECT child.relname AS partition, parent.relname AS parent
     FROM pg_inherits
     JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
     JOIN pg_class child ON pg_inherits.inhrelid = child.oid
     JOIN pg_namespace nsp_p ON nsp_p.oid = parent.relnamespace
     JOIN pg_namespace nsp_c ON nsp_c.oid = child.relnamespace
     WHERE nsp_p.nspname = 'public' AND nsp_c.nspname = 'public' AND parent.relname = 'audit_logs'
     ORDER BY child.relname`
  );
  return res.rows;
}

async function run() {
  try {
    console.log('=== Database Schema (public) ===');
    const tables = await getTables();
    for (const table of tables) {
      console.log(`\nTable: ${table}`);

      const columns = await getColumns(table);
      console.log('  Columns:');
      for (const col of columns) {
        console.log(`   - ${col.column_name} ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? 'DEFAULT ' + col.column_default : ''}`);
      }

      const pks = await getPrimaryKeys(table);
      if (pks.length) console.log(`  Primary Key: (${pks.join(', ')})`);

      const fks = await getForeignKeys(table);
      if (fks.length) {
        console.log('  Foreign Keys:');
        for (const fk of fks) console.log(`   - ${fk.constraint_name}: ${fk.definition}`);
      }

      const idx = await getIndexes(table);
      if (idx.length) {
        console.log('  Indexes:');
        for (const i of idx) console.log(`   - ${i.indexname}: ${i.indexdef}`);
      }
    }

    console.log('\n=== Views (public) ===');
    const views = await getViews();
    for (const v of views) {
      console.log(`- ${v.view_name}`);
    }

    console.log('\n=== Functions (public) ===');
    const funcs = await getFunctions();
    for (const f of funcs) {
      console.log(`- ${f.function_name}(${f.arguments})`);
    }

    console.log('\n=== Audit Log Partitions ===');
    const parts = await getAuditLogPartitions();
    if (parts.length === 0) {
      console.log('(none)');
    } else {
      for (const p of parts) console.log(`- ${p.partition} (parent: ${p.parent})`);
    }
  } catch (err) {
    console.error('Schema inspection failed:', err);
  } finally {
    await closeDatabase();
  }
}

run();
