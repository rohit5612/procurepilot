-- Migration: Add withdrawn status to GRN
-- Reason: Support soft-withdraw instead of hard delete for GRNs

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'grn_status' AND e.enumlabel = 'withdrawn'
  ) THEN
    ALTER TYPE grn_status ADD VALUE 'withdrawn';
  END IF;
END$$;

COMMIT;

