-- Migration: Add transaction categories and references in POs and Issues

BEGIN;

-- Create transaction_categories table
CREATE TABLE IF NOT EXISTS transaction_categories (
  id SERIAL PRIMARY KEY,
  category_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial categories
INSERT INTO transaction_categories (category_code, name, description, sort_order)
VALUES
  ('CORR_MAINT', 'Corrective Maintenance', 'Corrective maintenance related purchases', 10),
  ('PREV_MAINT', 'Preventive Maintenance', 'Preventive maintenance related purchases', 20),
  ('MIN_STOCK', 'Minimum Stock Level', 'Replenishment to minimum stock levels', 30),
  ('PPE', 'PPE', 'Personal protective equipment', 40),
  ('AGAINST_PO', 'Against PO', 'Transactions against existing PO or contract', 50)
ON CONFLICT (category_code) DO NOTHING;

-- Add reference on purchase_orders (nullable for compatibility; app will enforce required)
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS transaction_category_id INTEGER REFERENCES transaction_categories(id);

-- Add reference on inventory_issues (nullable for compatibility; app will enforce required)
ALTER TABLE inventory_issues
  ADD COLUMN IF NOT EXISTS transaction_category_id INTEGER REFERENCES transaction_categories(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_po_transaction_category ON purchase_orders(transaction_category_id);
CREATE INDEX IF NOT EXISTS idx_issue_transaction_category ON inventory_issues(transaction_category_id);

COMMIT;


