-- HR Payroll Phase 2: inputs + statutory settings + run item source extension
BEGIN;

-- Extend run item source to support statutory/system generated items
ALTER TABLE hr_payroll_run_item
  DROP CONSTRAINT IF EXISTS hr_payroll_run_item_source_check;

ALTER TABLE hr_payroll_run_item
  ADD CONSTRAINT hr_payroll_run_item_source_check
  CHECK (source IN ('structure','manual','statutory','system'));

-- Manual/derived inputs per period (Phase 2)
CREATE TABLE IF NOT EXISTS hr_payroll_input (
  id SERIAL PRIMARY KEY,
  period_key TEXT NOT NULL, -- YYYY-MM
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES hr_payroll_component(id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','attendance','leave','bonus','adjustment')),
  note TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_key, employee_id, component_id, source)
);

CREATE INDEX IF NOT EXISTS idx_hr_payroll_input_period_emp ON hr_payroll_input(period_key, employee_id);

-- Company statutory settings (single row; update in-place)
CREATE TABLE IF NOT EXISTS hr_payroll_statutory_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,

  pf_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pf_employee_rate NUMERIC(6,3) NOT NULL DEFAULT 12.000,
  pf_employer_rate NUMERIC(6,3) NOT NULL DEFAULT 12.000,
  pf_wage_ceiling NUMERIC(12,2) NOT NULL DEFAULT 15000,
  pf_wage_component_codes JSONB NOT NULL DEFAULT '["BASIC"]'::jsonb,

  esi_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  esi_employee_rate NUMERIC(6,3) NOT NULL DEFAULT 0.750,
  esi_employer_rate NUMERIC(6,3) NOT NULL DEFAULT 3.250,
  esi_wage_ceiling NUMERIC(12,2) NOT NULL DEFAULT 21000,

  pt_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  pt_mode TEXT NOT NULL DEFAULT 'maharashtra_simple' CHECK (pt_mode IN ('maharashtra_simple','flat','none')),
  pt_flat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  pt_slabs JSONB NOT NULL DEFAULT '[{"min":0,"max":7500,"amount":0},{"min":7501,"max":10000,"amount":175},{"min":10001,"max":99999999,"amount":200}]'::jsonb,

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO hr_payroll_statutory_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;

