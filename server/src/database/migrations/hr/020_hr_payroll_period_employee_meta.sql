-- HR Payroll: per-employee per-period meta (paid days / LOP etc)
BEGIN;

CREATE TABLE IF NOT EXISTS hr_payroll_employee_period (
  id SERIAL PRIMARY KEY,
  period_key TEXT NOT NULL, -- YYYY-MM
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,

  paid_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  lop_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  leave_days NUMERIC(6,2) NOT NULL DEFAULT 0,
  remarks TEXT,

  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (period_key, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_employee_period_pk_emp ON hr_payroll_employee_period(period_key, employee_id);

COMMIT;

