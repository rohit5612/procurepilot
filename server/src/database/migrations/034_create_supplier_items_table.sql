-- Migration: Create supplier_items table
-- Description: Phase 1 - Vendor-Item Map - Supplier Items table for mapping suppliers to items they can supply

BEGIN;

-- Create supplier_items table
CREATE TABLE IF NOT EXISTS supplier_items (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    supplier_item_code VARCHAR(50),
    supplier_item_name VARCHAR(200),
    is_preferred BOOLEAN NOT NULL DEFAULT false,
    lead_time_days INTEGER DEFAULT 0,
    minimum_order_qty DECIMAL(15,2) DEFAULT 1,
    unit_price DECIMAL(15,4) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'INR',
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(supplier_id, item_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplier_items_supplier ON supplier_items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_item ON supplier_items(item_id);
CREATE INDEX IF NOT EXISTS idx_supplier_items_preferred ON supplier_items(is_preferred);
CREATE INDEX IF NOT EXISTS idx_supplier_items_code ON supplier_items(supplier_item_code);
CREATE INDEX IF NOT EXISTS idx_supplier_items_valid_from ON supplier_items(valid_from);
CREATE INDEX IF NOT EXISTS idx_supplier_items_valid_to ON supplier_items(valid_to);

-- Create function for updated_at trigger
CREATE OR REPLACE FUNCTION update_supplier_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_supplier_items_updated_at
    BEFORE UPDATE ON supplier_items
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_item_updated_at();

COMMIT;
