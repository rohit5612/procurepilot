-- Migration: Add withdrawn status to PO
-- Reason: Support soft-withdraw instead of hard delete for POs

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'po_status' AND e.enumlabel = 'withdrawn'
  ) THEN
    ALTER TYPE po_status ADD VALUE 'withdrawn';
  END IF;
END$$;

COMMIT;

