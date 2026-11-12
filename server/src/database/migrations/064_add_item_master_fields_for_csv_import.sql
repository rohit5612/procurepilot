-- Migration: Add fields for Stock Item CSV import
-- Description: Add company_code, hsn_code, sac_code, manufacturer, spare_type, sub_category, rating, gst_rate

BEGIN;

-- Add company internal SKU code
ALTER TABLE items ADD COLUMN IF NOT EXISTS company_code VARCHAR(50) UNIQUE;

-- Add GST classification codes
ALTER TABLE items ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(20);
ALTER TABLE items ADD COLUMN IF NOT EXISTS sac_code VARCHAR(20);

-- Add manufacturer (separate from brand - MAKE field in CSV)
ALTER TABLE items ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(200);

-- Add spare type and sub category
ALTER TABLE items ADD COLUMN IF NOT EXISTS spare_type VARCHAR(100);
ALTER TABLE items ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100);

-- Add rating (quality/importance rating)
ALTER TABLE items ADD COLUMN IF NOT EXISTS rating VARCHAR(50);

-- Add GST rate (standard GST percentage for this item)
ALTER TABLE items ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0;

-- Add basic rate and discount (for reference pricing)
ALTER TABLE items ADD COLUMN IF NOT EXISTS basic_rate DECIMAL(15,2) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_items_company_code ON items(company_code);
CREATE INDEX IF NOT EXISTS idx_items_hsn_code ON items(hsn_code);
CREATE INDEX IF NOT EXISTS idx_items_sac_code ON items(sac_code);
CREATE INDEX IF NOT EXISTS idx_items_manufacturer ON items(manufacturer);
CREATE INDEX IF NOT EXISTS idx_items_spare_type ON items(spare_type);
CREATE INDEX IF NOT EXISTS idx_items_sub_category ON items(sub_category);

-- Add comments for documentation
COMMENT ON COLUMN items.company_code IS 'Internal company SKU/product code (e.g., VRPEPLM00001)';
COMMENT ON COLUMN items.hsn_code IS 'Harmonized System Nomenclature code for goods GST classification';
COMMENT ON COLUMN items.sac_code IS 'Service Accounting Code for services GST classification';
COMMENT ON COLUMN items.manufacturer IS 'Manufacturer/Make of the item (e.g., KOEL, ACME, Mahindra)';
COMMENT ON COLUMN items.spare_type IS 'Type of spare part (e.g., Valve, Gasket, Motor)';
COMMENT ON COLUMN items.sub_category IS 'Sub-category within main category (e.g., capillary, Safety)';
COMMENT ON COLUMN items.rating IS 'Item rating or classification (e.g., COMMON, CRITICAL)';
COMMENT ON COLUMN items.gst_rate IS 'Standard GST rate percentage (e.g., 18.00, 28.00, 5.00, 12.00)';
COMMENT ON COLUMN items.basic_rate IS 'Base rate before discounts and GST';
COMMENT ON COLUMN items.discount_percentage IS 'Standard discount percentage';

COMMIT;

