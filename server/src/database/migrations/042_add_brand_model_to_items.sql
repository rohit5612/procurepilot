-- Migration: Add brand, model, and estimated price to items table
-- Description: Support for brand/model selection and estimated pricing in requisitions

BEGIN;

-- Add brand, model, and estimated price columns to items table
ALTER TABLE items ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE items ADD COLUMN IF NOT EXISTS model VARCHAR(100);
ALTER TABLE items ADD COLUMN IF NOT EXISTS estimated_price DECIMAL(15,2) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS price_currency VARCHAR(3) DEFAULT 'INR';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_items_brand ON items(brand);
CREATE INDEX IF NOT EXISTS idx_items_model ON items(model);
CREATE INDEX IF NOT EXISTS idx_items_brand_model ON items(brand, model);

-- Update existing items to have some sample data for testing
UPDATE items 
SET 
    brand = CASE 
        WHEN name ILIKE '%laptop%' THEN 'Dell'
        WHEN name ILIKE '%printer%' THEN 'HP'
        WHEN name ILIKE '%monitor%' THEN 'Samsung'
        ELSE 'Generic'
    END,
    model = CASE 
        WHEN name ILIKE '%laptop%' THEN 'Latitude 5520'
        WHEN name ILIKE '%printer%' THEN 'LaserJet Pro'
        WHEN name ILIKE '%monitor%' THEN '24" LED'
        ELSE 'Standard'
    END,
    estimated_price = CASE 
        WHEN name ILIKE '%laptop%' THEN 75000
        WHEN name ILIKE '%printer%' THEN 25000
        WHEN name ILIKE '%monitor%' THEN 15000
        ELSE standard_cost
    END
WHERE brand IS NULL OR model IS NULL OR estimated_price = 0;

COMMIT;
