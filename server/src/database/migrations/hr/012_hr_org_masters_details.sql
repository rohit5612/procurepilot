-- HR Org Masters Details (Grades, Locations, Cost Centers)
-- Adds additional descriptive/operational fields to HR organization master tables.

BEGIN;

-- =========================
-- Grades
-- =========================
ALTER TABLE hr_grade
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS grade_rank INTEGER,
  ADD COLUMN IF NOT EXISTS min_salary NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS max_salary NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS salary_currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS probation_months INTEGER,
  ADD COLUMN IF NOT EXISTS notice_days INTEGER,
  ADD COLUMN IF NOT EXISTS overtime_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pay_band TEXT;

-- Optional sanity checks (only enforced when values are present)
ALTER TABLE hr_grade
  DROP CONSTRAINT IF EXISTS chk_hr_grade_salary_range,
  ADD CONSTRAINT chk_hr_grade_salary_range
    CHECK (min_salary IS NULL OR max_salary IS NULL OR min_salary <= max_salary);

CREATE INDEX IF NOT EXISTS idx_hr_grade_rank ON hr_grade(grade_rank);

-- =========================
-- Locations
-- =========================
ALTER TABLE hr_location
  ADD COLUMN IF NOT EXISTS location_type TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS contact_person TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS gstin TEXT;

CREATE INDEX IF NOT EXISTS idx_hr_location_city ON hr_location(city);
CREATE INDEX IF NOT EXISTS idx_hr_location_state ON hr_location(state);

-- =========================
-- Cost Centers
-- =========================
ALTER TABLE hr_cost_center
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS gl_code TEXT,
  ADD COLUMN IF NOT EXISTS manager_employee_id INTEGER,
  ADD COLUMN IF NOT EXISTS location_id INTEGER,
  ADD COLUMN IF NOT EXISTS department_id INTEGER,
  ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS budget_currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE;

-- Foreign keys (added separately to keep ALTER TABLE readable)
ALTER TABLE hr_cost_center
  DROP CONSTRAINT IF EXISTS fk_hr_cost_center_manager_employee,
  ADD CONSTRAINT fk_hr_cost_center_manager_employee
    FOREIGN KEY (manager_employee_id) REFERENCES hr_employee(id) ON DELETE SET NULL;

ALTER TABLE hr_cost_center
  DROP CONSTRAINT IF EXISTS fk_hr_cost_center_location,
  ADD CONSTRAINT fk_hr_cost_center_location
    FOREIGN KEY (location_id) REFERENCES hr_location(id) ON DELETE SET NULL;

ALTER TABLE hr_cost_center
  DROP CONSTRAINT IF EXISTS fk_hr_cost_center_department,
  ADD CONSTRAINT fk_hr_cost_center_department
    FOREIGN KEY (department_id) REFERENCES hr_department(id) ON DELETE SET NULL;

ALTER TABLE hr_cost_center
  DROP CONSTRAINT IF EXISTS chk_hr_cost_center_valid_range,
  ADD CONSTRAINT chk_hr_cost_center_valid_range
    CHECK (valid_from IS NULL OR valid_to IS NULL OR valid_from <= valid_to);

CREATE INDEX IF NOT EXISTS idx_hr_cost_center_department ON hr_cost_center(department_id);
CREATE INDEX IF NOT EXISTS idx_hr_cost_center_location ON hr_cost_center(location_id);
CREATE INDEX IF NOT EXISTS idx_hr_cost_center_manager_employee ON hr_cost_center(manager_employee_id);

COMMIT;

