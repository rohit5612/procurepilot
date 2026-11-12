-- Add supplier_id to price_lists table
ALTER TABLE price_lists ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_price_lists_supplier ON price_lists(supplier_id);
