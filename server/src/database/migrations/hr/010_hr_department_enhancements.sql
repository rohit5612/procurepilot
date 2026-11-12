-- HR Org: enhance departments (metadata + uniqueness)
BEGIN;

-- Extra metadata columns for richer department setup
ALTER TABLE hr_department
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS head_employee_id INTEGER REFERENCES hr_employee(id) ON DELETE SET NULL;

-- Enforce case-insensitive uniqueness
-- (existing constraint on code is case-sensitive; this prevents OPS vs ops duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_department_code_ci ON hr_department (LOWER(code));
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_department_name_ci ON hr_department (LOWER(name));

COMMIT;

