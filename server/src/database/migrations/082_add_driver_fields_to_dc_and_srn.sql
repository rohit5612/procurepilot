-- Add driver fields to inventory_issues (DC) and store_return_notes (SRN)
BEGIN;

-- Add driver fields to inventory_issues for Delivery Challans
ALTER TABLE inventory_issues
ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20);

COMMENT ON COLUMN inventory_issues.vehicle_number IS 'Vehicle registration number for DC transport';
COMMENT ON COLUMN inventory_issues.driver_name IS 'Driver name for DC transport';
COMMENT ON COLUMN inventory_issues.driver_phone IS 'Driver contact number for DC transport';

-- Add driver fields to store_return_notes for SRN
ALTER TABLE store_return_notes
ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20);

COMMENT ON COLUMN store_return_notes.vehicle_number IS 'Vehicle registration number for SRN transport';
COMMENT ON COLUMN store_return_notes.driver_name IS 'Driver name for SRN transport';
COMMENT ON COLUMN store_return_notes.driver_phone IS 'Driver contact number for SRN transport';

COMMIT;

