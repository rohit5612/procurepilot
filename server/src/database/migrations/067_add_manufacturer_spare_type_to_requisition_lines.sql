-- Migration: Add manufacturer and spare_type to requisition_lines table
-- Description: Add manufacturer and spare_type columns to requisition_lines for better item tracking
-- Date: 2025-01-16

BEGIN;

-- Add manufacturer and spare_type columns to requisition_lines table
ALTER TABLE requisition_lines 
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(200),
ADD COLUMN IF NOT EXISTS spare_type VARCHAR(100);

-- Create indexes for better search performance
CREATE INDEX IF NOT EXISTS idx_requisition_lines_manufacturer ON requisition_lines(manufacturer);
CREATE INDEX IF NOT EXISTS idx_requisition_lines_spare_type ON requisition_lines(spare_type);

-- Add comments for documentation
COMMENT ON COLUMN requisition_lines.manufacturer IS 'Manufacturer/Make of the item (e.g., KOEL, ACME, Mahindra)';
COMMENT ON COLUMN requisition_lines.spare_type IS 'Type of spare part (e.g., Valve, Gasket, Motor)';

COMMIT;
