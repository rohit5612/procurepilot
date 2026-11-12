-- Add GRN workflow statuses/columns and permissions
BEGIN;

-- 1) Extend grn_status enum with approval states
DO $$
BEGIN
  -- Add values if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'grn_status' AND e.enumlabel = 'pending_approval'
  ) THEN
    ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'pending_approval';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'grn_status' AND e.enumlabel = 'approved'
  ) THEN
    ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'approved';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'grn_status' AND e.enumlabel = 'rejected'
  ) THEN
    ALTER TYPE grn_status ADD VALUE IF NOT EXISTS 'rejected';
  END IF;
END$$;

-- 2) Add workflow columns to goods_receipts
ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS workflow_instance_id INTEGER,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3) Ensure goods_receipt feature has submit and approve permissions
UPDATE features f
SET available_permissions = (
  CASE
    WHEN f.available_permissions IS NULL THEN '[]'::jsonb
    ELSE f.available_permissions
  END
  || (CASE WHEN NOT (f.available_permissions ? 'submit') THEN '"submit"'::jsonb ELSE '[]'::jsonb END)
  || (CASE WHEN NOT (f.available_permissions ? 'approve') THEN '"approve"'::jsonb ELSE '[]'::jsonb END)
)
WHERE f.name = 'goods_receipt' AND f.module_id = (SELECT id FROM modules WHERE name = 'procurement');

COMMIT;


