-- HR Payroll: employee-level salary structure override (header + lines)
BEGIN;

CREATE TABLE IF NOT EXISTS hr_payroll_employee_structure (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  base_structure_id INTEGER REFERENCES hr_payroll_structure(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_emp_struct_emp ON hr_payroll_employee_structure(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_payroll_emp_struct_active ON hr_payroll_employee_structure(is_active);

-- Keep at most one active record per employee per effective_from (similar to assignments)
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_payroll_emp_struct_emp_from
  ON hr_payroll_employee_structure(employee_id, effective_from)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS hr_payroll_employee_structure_line (
  id SERIAL PRIMARY KEY,
  employee_structure_id INTEGER NOT NULL REFERENCES hr_payroll_employee_structure(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES hr_payroll_component(id) ON DELETE RESTRICT,
  calc_type TEXT NOT NULL DEFAULT 'fixed' CHECK (calc_type IN ('fixed')),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (employee_structure_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_emp_struct_line_hdr ON hr_payroll_employee_structure_line(employee_structure_id);

COMMIT;

