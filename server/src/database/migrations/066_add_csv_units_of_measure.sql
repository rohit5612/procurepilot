-- Migration: Add Units of Measure from CSV Import
-- Description: Add UOMs found in stock item CSV that are missing from database

BEGIN;

-- Insert new units of measure
INSERT INTO units_of_measure (uom_code, name, uom_type, is_active, is_base_unit) VALUES
  ('EACH', 'Each', 'COUNT', true, false),
  ('NOS', 'Numbers', 'COUNT', true, false),
  ('NO', 'Number', 'COUNT', true, false),
  ('BAG', 'Bags', 'PACKAGING', true, false),
  ('BUCKET', 'Buckets', 'PACKAGING', true, false),
  ('PACKET', 'Packets', 'PACKAGING', true, false),
  ('PKT', 'Packets', 'PACKAGING', true, false),
  ('SQM', 'Square Meters', 'AREA', true, false),
  ('TON', 'Tons', 'WEIGHT', true, false),
  ('MTR', 'Meters', 'LENGTH', true, false),
  ('LITER', 'Liters', 'VOLUME', true, false),
  ('LITRE', 'Litres', 'VOLUME', true, false),
  ('UNIT', 'Units', 'COUNT', true, false)
ON CONFLICT (uom_code) DO NOTHING;

-- Create mapping aliases (for import script to use)
COMMENT ON COLUMN units_of_measure.uom_code IS 'Standard UOM code - use for imports';

COMMIT;

