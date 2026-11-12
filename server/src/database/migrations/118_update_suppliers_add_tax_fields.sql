-- Migration: Update suppliers table to use explicit GST/VAT/PAN/Service Tax fields
-- - Rename generic tax_id to gst_number (GSTIN)
-- - Add vat_number, service_tax_number, pan_number columns

BEGIN;

-- Safely rename tax_id -> gst_number if the old column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'suppliers'
      AND column_name = 'tax_id'
  ) THEN
    EXECUTE 'ALTER TABLE suppliers RENAME COLUMN tax_id TO gst_number';
  END IF;
END
$$;

-- Ensure gst_number column exists (for fresh databases where 033 may already define it differently)
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50);

-- Add separate legacy tax identifier columns
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS vat_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS service_tax_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pan_number VARCHAR(50);

COMMIT;

