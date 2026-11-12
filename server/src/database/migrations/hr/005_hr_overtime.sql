-- HR Phase 2: Overtime capture
BEGIN;

CREATE TABLE IF NOT EXISTS hr_overtime_entry (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  minutes INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | approved | rejected
  submitted_by INTEGER,
  approved_by INTEGER,
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_overtime_employee_date ON hr_overtime_entry(employee_id, work_date, status) WHERE status <> 'rejected';

COMMIT;

