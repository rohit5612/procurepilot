-- Migration: Create Purchase Order Tables
-- Description: Phase 3 - Purchase Orders (PO) implementation

BEGIN;

-- Create po_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_status') THEN
    CREATE TYPE po_status AS ENUM (
      'draft',
      'pending_approval',
      'approved',
      'issued',
      'rejected',
      'canceled'
    );
  END IF;
END$$;

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,

  -- Core
  po_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Links
  requisition_id INTEGER REFERENCES requisitions(id),
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE RESTRICT,

  -- Delivery defaults
  site_id INTEGER REFERENCES sites(id),
  warehouse_id INTEGER REFERENCES warehouses(id),

  -- Commercials
  currency VARCHAR(10) DEFAULT 'INR',
  price_tolerance_percent DECIMAL(6,2) DEFAULT 0,
  promised_date DATE,

  -- Status & workflow
  status po_status DEFAULT 'draft',
  workflow_instance_id INTEGER,
  submitted_at TIMESTAMP,
  submitted_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  approved_by INTEGER REFERENCES users(id),
  issued_at TIMESTAMP,
  issued_by INTEGER REFERENCES users(id),
  rejected_at TIMESTAMP,
  rejected_by INTEGER REFERENCES users(id),
  rejection_reason TEXT,

  -- Totals
  total_amount DECIMAL(15,2) DEFAULT 0,
  total_quantity DECIMAL(15,3) DEFAULT 0,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

-- Create po_lines table
CREATE TABLE IF NOT EXISTS po_lines (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  requisition_line_id INTEGER REFERENCES requisition_lines(id),
  item_id INTEGER REFERENCES items(id),
  item_code VARCHAR(100),
  item_name VARCHAR(255) NOT NULL,
  item_description TEXT,
  quantity DECIMAL(15,3) NOT NULL,
  unit_of_measure VARCHAR(20) DEFAULT 'PCS',
  unit_price DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) DEFAULT 0,
  brand VARCHAR(100),
  model VARCHAR(100),
  promised_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(purchase_order_id, line_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_supplier_id ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_created_at ON purchase_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_po_po_number ON purchase_orders(po_number);
CREATE INDEX IF NOT EXISTS idx_po_workflow_instance_id ON purchase_orders(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_po_requisition_id ON purchase_orders(requisition_id);

CREATE INDEX IF NOT EXISTS idx_po_lines_po_id ON po_lines(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_po_lines_item_id ON po_lines(item_id);

-- updated_at triggers
CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_po_lines_updated_at
  BEFORE UPDATE ON po_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- PO number generator
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  po_number VARCHAR(50);
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM purchase_orders
  WHERE po_number LIKE 'PO-%';

  po_number := 'PO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 4, '0');

  RETURN po_number;
END;
$$ LANGUAGE plpgsql;

-- Totals calculator
CREATE OR REPLACE FUNCTION calculate_po_totals(p_po_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE purchase_orders
  SET
    total_amount = (
      SELECT COALESCE(SUM(total_price), 0)
      FROM po_lines
      WHERE purchase_order_id = p_po_id
    ),
    total_quantity = (
      SELECT COALESCE(SUM(quantity), 0)
      FROM po_lines
      WHERE purchase_order_id = p_po_id
    )
  WHERE id = p_po_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update totals on line changes
CREATE OR REPLACE FUNCTION update_po_totals_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM calculate_po_totals(OLD.purchase_order_id);
    RETURN OLD;
  ELSE
    PERFORM calculate_po_totals(NEW.purchase_order_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_po_totals
  AFTER INSERT OR UPDATE OR DELETE ON po_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_po_totals_trigger();

-- Comments
COMMENT ON TABLE purchase_orders IS 'Purchase orders for procurement';
COMMENT ON TABLE po_lines IS 'Line items within purchase orders';

COMMIT;


