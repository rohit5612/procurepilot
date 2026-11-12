-- Migration: Add withdrawn status to requisitions
-- Reason: Support soft-withdraw action instead of hard delete

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'requisition_status' AND e.enumlabel = 'withdrawn'
  ) THEN
    ALTER TYPE requisition_status ADD VALUE 'withdrawn';
  END IF;
END$$;

COMMIT;

