-- One-to-many / history tables for deep HR suite
-- Banking, dependents, nominees, education, experience, transfers

BEGIN;

-- Bank accounts (recommended/essential for payroll)
CREATE TABLE IF NOT EXISTS hr_employee_bank_account (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  account_holder_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT,
  bank_name TEXT,
  branch_name TEXT,
  account_type TEXT, -- savings/current/other
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_bank_emp ON hr_employee_bank_account(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_bank_primary ON hr_employee_bank_account(employee_id, is_primary);

-- Dependents (recommended)
CREATE TABLE IF NOT EXISTS hr_employee_dependent (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- father/mother/spouse/child/other
  date_of_birth DATE,
  gender TEXT,
  is_nominee BOOLEAN NOT NULL DEFAULT FALSE,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_dependent_emp ON hr_employee_dependent(employee_id);

-- Nominees (recommended for PF/ESI/gratuity)
CREATE TABLE IF NOT EXISTS hr_employee_nominee (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  share_percent NUMERIC(5,2),
  nominee_for TEXT, -- pf | esi | gratuity | insurance | other
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_nominee_emp ON hr_employee_nominee(employee_id);

-- Education (nice-to-have)
CREATE TABLE IF NOT EXISTS hr_employee_education (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  qualification TEXT NOT NULL,
  institution TEXT,
  year_of_passing INTEGER,
  grade_or_score TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_edu_emp ON hr_employee_education(employee_id);

-- Prior experience (nice-to-have)
CREATE TABLE IF NOT EXISTS hr_employee_experience (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  designation TEXT,
  from_date DATE,
  to_date DATE,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_exp_emp ON hr_employee_experience(employee_id);

-- Transfers / movement history (recommended)
CREATE TABLE IF NOT EXISTS hr_employee_transfer (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  from_department_id INTEGER REFERENCES hr_department(id) ON DELETE SET NULL,
  to_department_id INTEGER REFERENCES hr_department(id) ON DELETE SET NULL,
  from_location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL,
  to_location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hr_emp_transfer_emp ON hr_employee_transfer(employee_id);

COMMIT;

