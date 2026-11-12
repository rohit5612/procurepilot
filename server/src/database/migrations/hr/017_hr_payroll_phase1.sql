-- HR Payroll Phase 1: components, structures, assignments, pay runs
BEGIN;

-- Salary components (earnings/deductions)
CREATE TABLE IF NOT EXISTS hr_payroll_component (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earning','deduction')),
  description TEXT,
  is_taxable BOOLEAN NOT NULL DEFAULT FALSE,
  is_statutory BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_component_active ON hr_payroll_component(is_active);

-- Salary structure template
CREATE TABLE IF NOT EXISTS hr_payroll_structure (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_structure_active ON hr_payroll_structure(is_active);

-- Structure lines (Phase 1: fixed amounts only)
CREATE TABLE IF NOT EXISTS hr_payroll_structure_line (
  id SERIAL PRIMARY KEY,
  structure_id INTEGER NOT NULL REFERENCES hr_payroll_structure(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES hr_payroll_component(id) ON DELETE RESTRICT,
  calc_type TEXT NOT NULL DEFAULT 'fixed' CHECK (calc_type IN ('fixed')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (structure_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_structure_line_structure ON hr_payroll_structure_line(structure_id);

-- Employee assignment to structure
CREATE TABLE IF NOT EXISTS hr_payroll_employee_assignment (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  structure_id INTEGER NOT NULL REFERENCES hr_payroll_structure(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_assignment_employee ON hr_payroll_employee_assignment(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_assignment_structure ON hr_payroll_employee_assignment(structure_id);

-- Prevent overlapping active assignments per employee (soft via application; DB partial unique for exact from-date)
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_assignment_employee_from
  ON hr_payroll_employee_assignment(employee_id, effective_from)
  WHERE is_active = TRUE;

-- Payroll run header
CREATE TABLE IF NOT EXISTS hr_payroll_run (
  id SERIAL PRIMARY KEY,
  period_key TEXT NOT NULL, -- YYYY-MM
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','cancelled')),
  notes TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_run_period ON hr_payroll_run(period_key) WHERE status <> 'cancelled';

-- Payroll run items (per employee per component)
CREATE TABLE IF NOT EXISTS hr_payroll_run_item (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES hr_payroll_run(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES hr_payroll_component(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'structure' CHECK (source IN ('structure','manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, employee_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_run_item_run_emp ON hr_payroll_run_item(run_id, employee_id);

-- Payslip summary (Phase 1)
CREATE TABLE IF NOT EXISTS hr_payroll_payslip (
  id SERIAL PRIMARY KEY,
  run_id INTEGER NOT NULL REFERENCES hr_payroll_run(id) ON DELETE CASCADE,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  gross_earnings NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (run_id, employee_id)
);

COMMIT;

