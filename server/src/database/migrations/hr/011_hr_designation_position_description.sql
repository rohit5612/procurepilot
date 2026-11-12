-- HR Org: add description fields to designation/position
BEGIN;

ALTER TABLE hr_designation
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE hr_position
  ADD COLUMN IF NOT EXISTS description TEXT;

COMMIT;

