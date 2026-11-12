CREATE TABLE IF NOT EXISTS transaction_categories (
  id SERIAL PRIMARY KEY,
  category_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO transaction_categories (category_code, name, description, sort_order)
VALUES
  ('CORR_MAINT', 'Corrective Maintenance', 'Corrective maintenance related purchases', 10),
  ('PREV_MAINT', 'Preventive Maintenance', 'Preventive maintenance related purchases', 20),
  ('MIN_STOCK', 'Minimum Stock Level', 'Replenishment to minimum stock levels', 30),
  ('PPE', 'PPE', 'Personal protective equipment', 40),
  ('AGAINST_PO', 'Against PO', 'Transactions against existing PO or contract', 50)
ON CONFLICT (category_code) DO NOTHING;

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS transaction_category_id INTEGER REFERENCES transaction_categories(id);

CREATE INDEX IF NOT EXISTS idx_po_transaction_category ON purchase_orders(transaction_category_id);
