-- HR Employee: add inventory-compat columns (full_name/branch/notes)
-- Goal: allow HR employee master to represent inventory employee master 1:1 (minimum),
-- while keeping HR org mapping (department_id/designation_id/location_id) optional for now.

BEGIN;

ALTER TABLE hr_employee
  ADD COLUMN IF NOT EXISTS full_name TEXT;

ALTER TABLE hr_employee
  ADD COLUMN IF NOT EXISTS branch TEXT;

ALTER TABLE hr_employee
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill full_name for existing rows
UPDATE hr_employee
SET full_name = NULLIF(TRIM(BOTH FROM CONCAT_WS(' ', first_name, last_name)), '')
WHERE full_name IS NULL OR full_name = '';

COMMIT;

