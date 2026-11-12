-- HR Leave: Comp-off credits (minimal v1)
BEGIN;

CREATE TABLE IF NOT EXISTS hr_leave_comp_off_credit (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES hr_leave_category(id) ON DELETE RESTRICT,
  quantity NUMERIC(8,2) NOT NULL CHECK (quantity > 0),
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_on DATE,
  note TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_comp_off_credit_emp_date ON hr_leave_comp_off_credit(employee_id, effective_date);

COMMIT;

