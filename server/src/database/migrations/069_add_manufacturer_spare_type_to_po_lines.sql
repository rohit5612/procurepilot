-- Migration: Add manufacturer and spare_type to po_lines table
-- Description: Add manufacturer and spare_type columns to po_lines for better item tracking
-- Date: 2025-01-16

BEGIN;

-- Add manufacturer and spare_type columns to po_lines table
ALTER TABLE po_lines 
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(200),
ADD COLUMN IF NOT EXISTS spare_type VARCHAR(100);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_po_lines_manufacturer ON po_lines(manufacturer);
CREATE INDEX IF NOT EXISTS idx_po_lines_spare_type ON po_lines(spare_type);

-- Add comments for documentation
COMMENT ON COLUMN po_lines.manufacturer IS 'Manufacturer/Make of the item (e.g., KOEL, ACME, Mahindra)';
COMMENT ON COLUMN po_lines.spare_type IS 'Type of spare part (e.g., Valve, Gasket, Motor)';

COMMIT;
