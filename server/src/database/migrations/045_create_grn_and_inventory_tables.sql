-- Phase 4: GRN and Inventory tables
BEGIN;

-- Goods Receipts
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'grn_status') THEN
    CREATE TYPE grn_status AS ENUM ('draft','posted','canceled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS goods_receipts (
  id SERIAL PRIMARY KEY,
  grn_number VARCHAR(50) UNIQUE NOT NULL,
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE RESTRICT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,
  site_id INTEGER REFERENCES sites(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  status grn_status DEFAULT 'draft',
  remarks TEXT,
  posted_at TIMESTAMP,
  posted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS grn_lines (
  id SERIAL PRIMARY KEY,
  goods_receipt_id INTEGER NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  po_line_id INTEGER REFERENCES po_lines(id),
  item_id INTEGER REFERENCES items(id),
  item_code VARCHAR(100),
  item_name VARCHAR(255) NOT NULL,
  received_qty DECIMAL(15,3) NOT NULL,
  accepted_qty DECIMAL(15,3) NOT NULL,
  rejected_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_of_measure VARCHAR(20) DEFAULT 'PCS',
  unit_price DECIMAL(15,2) DEFAULT 0,
  lot_number VARCHAR(100),
  serial_numbers TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(goods_receipt_id, line_number)
);

-- Inventory
CREATE TABLE IF NOT EXISTS inventory_layers (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
  bin_id INTEGER REFERENCES bins(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit_cost DECIMAL(15,4) NOT NULL,
  total_cost DECIMAL(15,2) NOT NULL,
  source_type VARCHAR(30) NOT NULL, -- e.g., 'RECEIPT', 'ADJUSTMENT'
  source_id INTEGER NOT NULL,       -- e.g., grn_line_id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES items(id) ON DELETE RESTRICT,
  warehouse_id INTEGER REFERENCES warehouses(id) ON DELETE RESTRICT,
  bin_id INTEGER REFERENCES bins(id),
  transaction_type VARCHAR(20) NOT NULL, -- RECEIPT/ISSUE/TRANSFER/ADJUST
  quantity DECIMAL(15,3) NOT NULL,       -- positive for IN, negative for OUT
  unit_cost DECIMAL(15,4) NOT NULL,
  total_cost DECIMAL(15,2) NOT NULL,
  reference_type VARCHAR(30) NOT NULL,   -- e.g., 'GRN'
  reference_id INTEGER NOT NULL,         -- e.g., grn_line_id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Helper: update_updated_at_column() assumed existing
CREATE TRIGGER update_goods_receipts_updated_at
  BEFORE UPDATE ON goods_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grn_lines_updated_at
  BEFORE UPDATE ON grn_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- GRN number generator
-- Deprecated by 098_update_grn_number_generator.sql

COMMIT;



