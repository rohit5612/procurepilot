-- Add applied price list reference to suppliers
ALTER TABLE suppliers
ADD COLUMN IF NOT EXISTS applied_price_list_id INTEGER
  REFERENCES price_lists(id) ON DELETE SET NULL;

-- Helpful index
CREATE INDEX IF NOT EXISTS idx_suppliers_applied_price_list
  ON suppliers(applied_price_list_id);

