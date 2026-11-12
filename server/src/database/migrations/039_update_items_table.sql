-- Migration: Update items table with category and UoM references
-- Description: Add category_id and uom_id foreign keys to items table
-- Date: 2025-08-16

BEGIN;

-- Add new columns to items table
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES item_categories(id),
ADD COLUMN IF NOT EXISTS uom_id INTEGER REFERENCES units_of_measure(id),
ADD COLUMN IF NOT EXISTS base_uom_id INTEGER REFERENCES units_of_measure(id),
ADD COLUMN IF NOT EXISTS uom_conversion_factor DECIMAL(10,6) DEFAULT 1.0;

-- Create indexes for new foreign keys
CREATE INDEX IF NOT EXISTS idx_items_category_id ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_uom_id ON items(uom_id);
CREATE INDEX IF NOT EXISTS idx_items_base_uom_id ON items(base_uom_id);

-- Update existing items to have default category and UoM
UPDATE items 
SET 
    category_id = (SELECT id FROM item_categories WHERE category_code = 'RAW-MAT' LIMIT 1),
    uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'PCS' LIMIT 1),
    base_uom_id = (SELECT id FROM units_of_measure WHERE uom_code = 'PCS' LIMIT 1),
    uom_conversion_factor = 1.0
WHERE category_id IS NULL OR uom_id IS NULL;

-- Make category_id and uom_id NOT NULL after setting defaults
ALTER TABLE items 
ALTER COLUMN category_id SET NOT NULL,
ALTER COLUMN uom_id SET NOT NULL,
ALTER COLUMN base_uom_id SET NOT NULL;

COMMIT;
