-- Add attachment metadata columns to inventory operations
BEGIN;

-- Transfers
ALTER TABLE IF EXISTS inventory_transfers
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- Adjustments
ALTER TABLE IF EXISTS inventory_adjustments
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- Store Return Notes (SRN)
ALTER TABLE IF EXISTS store_return_notes
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

COMMIT;



