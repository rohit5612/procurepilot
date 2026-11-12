-- Add TT number to inventory_issues for Delivery Challans (DC)
-- Safe to run multiple times due to IF NOT EXISTS guards

BEGIN;

-- Add column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'inventory_issues' 
      AND column_name = 'tt_number'
  ) THEN
    ALTER TABLE inventory_issues
      ADD COLUMN tt_number VARCHAR(100);
  END IF;
END$$;

-- Create index for searching/filtering by tt_number
CREATE INDEX IF NOT EXISTS idx_inventory_issues_tt_number ON inventory_issues(tt_number);

COMMENT ON COLUMN inventory_issues.tt_number IS 'External tracking number provided by client (TT Number)';

COMMIT;


