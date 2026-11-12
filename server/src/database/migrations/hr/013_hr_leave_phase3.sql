-- HR Phase 3: Leave Management (categories, policies, balances, requests)
BEGIN;

-- =========================
-- Leave Categories
-- =========================
CREATE TABLE IF NOT EXISTS hr_leave_category (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT TRUE,
  is_encashable BOOLEAN NOT NULL DEFAULT FALSE,
  allow_half_day BOOLEAN NOT NULL DEFAULT FALSE,
  requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_category_active ON hr_leave_category(is_active);

-- =========================
-- Leave Policies
-- =========================
CREATE TABLE IF NOT EXISTS hr_leave_policy (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  category_id INTEGER NOT NULL REFERENCES hr_leave_category(id) ON DELETE CASCADE,

  -- Accrual rules (simple v1; can evolve into formulas later)
  accrual_frequency TEXT NOT NULL DEFAULT 'none' CHECK (accrual_frequency IN ('none','monthly','yearly')),
  accrual_rate NUMERIC(8,2) NOT NULL DEFAULT 0, -- days per period
  max_balance NUMERIC(8,2),
  carry_forward_max NUMERIC(8,2),
  allow_negative BOOLEAN NOT NULL DEFAULT FALSE,
  min_notice_days INTEGER NOT NULL DEFAULT 0,
  max_consecutive_days INTEGER,

  -- Applicability filters (nullable => applies to all)
  applicable_department_id INTEGER REFERENCES hr_department(id) ON DELETE SET NULL,
  applicable_grade_id INTEGER REFERENCES hr_grade(id) ON DELETE SET NULL,
  applicable_location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL,

  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hr_leave_policy
  DROP CONSTRAINT IF EXISTS chk_hr_leave_policy_effective_range,
  ADD CONSTRAINT chk_hr_leave_policy_effective_range
    CHECK (effective_to IS NULL OR effective_from <= effective_to);

CREATE INDEX IF NOT EXISTS idx_hr_leave_policy_category ON hr_leave_policy(category_id);
CREATE INDEX IF NOT EXISTS idx_hr_leave_policy_active ON hr_leave_policy(is_active);

-- =========================
-- Leave Balances (per employee per category)
-- =========================
CREATE TABLE IF NOT EXISTS hr_leave_balance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES hr_leave_category(id) ON DELETE CASCADE,
  balance NUMERIC(8,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_balance_employee ON hr_leave_balance(employee_id);

-- =========================
-- Leave Ledger (audit trail for balance changes)
-- =========================
CREATE TABLE IF NOT EXISTS hr_leave_ledger (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES hr_leave_category(id) ON DELETE CASCADE,
  policy_id INTEGER REFERENCES hr_leave_policy(id) ON DELETE SET NULL,

  entry_type TEXT NOT NULL CHECK (entry_type IN ('accrual','consume','adjustment','carry_forward','encashment')),
  quantity NUMERIC(8,2) NOT NULL, -- + for add, - for consume
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- For idempotency of periodic runs (e.g., accruals)
  period_key TEXT,

  reference_type TEXT,
  reference_id INTEGER,
  note TEXT,
  created_by INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hr_leave_ledger_employee_date ON hr_leave_ledger(employee_id, effective_date);

-- Prevent duplicate accrual/carry-forward/encashment entries for same period/reference
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_leave_ledger_period_ref
  ON hr_leave_ledger(employee_id, category_id, entry_type, period_key, reference_type, reference_id)
  WHERE period_key IS NOT NULL;

-- =========================
-- Leave Requests
-- =========================
CREATE TABLE IF NOT EXISTS hr_leave_request (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES hr_employee(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES hr_leave_category(id) ON DELETE RESTRICT,
  policy_id INTEGER REFERENCES hr_leave_policy(id) ON DELETE SET NULL,

  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_half_day BOOLEAN NOT NULL DEFAULT FALSE,
  half_day_part TEXT CHECK (half_day_part IN ('AM','PM')),
  total_days NUMERIC(8,2) NOT NULL,
  reason TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','manager_approved','hr_finalized','rejected','cancelled','closed')),

  submitted_by INTEGER,
  submitted_at TIMESTAMPTZ,

  manager_user_id INTEGER, -- resolved manager user (optional)
  manager_action_by INTEGER,
  manager_action_at TIMESTAMPTZ,
  manager_comment TEXT,

  hr_action_by INTEGER,
  hr_action_at TIMESTAMPTZ,
  hr_comment TEXT,

  rejected_by INTEGER,
  rejected_at TIMESTAMPTZ,

  cancelled_by INTEGER,
  cancelled_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE hr_leave_request
  DROP CONSTRAINT IF EXISTS chk_hr_leave_request_range,
  ADD CONSTRAINT chk_hr_leave_request_range
    CHECK (start_date <= end_date);

CREATE INDEX IF NOT EXISTS idx_hr_leave_request_employee_status ON hr_leave_request(employee_id, status);
CREATE INDEX IF NOT EXISTS idx_hr_leave_request_dates ON hr_leave_request(start_date, end_date);

COMMIT;

