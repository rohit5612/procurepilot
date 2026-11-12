-- HR Employee: flag to indicate payroll structure source (assignment vs custom)
BEGIN;

ALTER TABLE hr_employee
  ADD COLUMN IF NOT EXISTS payroll_structure_source TEXT
  CHECK (payroll_structure_source IN ('assignment', 'custom'));

COMMIT;

