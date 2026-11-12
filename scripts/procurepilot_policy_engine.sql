-- Run: psql -U postgres -d procurepilot -f scripts/procurepilot_policy_engine.sql

CREATE TABLE IF NOT EXISTS procurement_role_policies (
  id SERIAL PRIMARY KEY,
  role_level SMALLINT NOT NULL UNIQUE CHECK (role_level BETWEEN 1 AND 5),
  max_per_transaction NUMERIC(18, 2) NOT NULL,
  max_monthly_budget NUMERIC(18, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  allowed_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_approve_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  auto_approve_max_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  approval_required_above NUMERIC(18, 2),
  notes TEXT,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_procurement_policies (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  max_per_transaction NUMERIC(18, 2),
  max_monthly_budget NUMERIC(18, 2),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  allowed_categories JSONB,
  auto_approve_categories JSONB,
  auto_approve_max_amount NUMERIC(18, 2),
  approval_required_above NUMERIC(18, 2),
  notes TEXT,
  updated_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budget_ledger (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_year SMALLINT NOT NULL,
  period_month SMALLINT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  spent_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  reserved_amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, period_year, period_month, currency)
);

CREATE TABLE IF NOT EXISTS policy_audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id),
  event_type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_budget_ledger_user_period
  ON budget_ledger (user_id, period_year, period_month);

CREATE INDEX IF NOT EXISTS idx_policy_audit_created
  ON policy_audit_events (created_at DESC);

INSERT INTO procurement_role_policies (
  role_level, max_per_transaction, max_monthly_budget, currency,
  allowed_categories, auto_approve_categories, auto_approve_max_amount, approval_required_above, notes
) VALUES
  (1, 10000000, 50000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 100000, NULL, 'L1 org admin'),
  (2, 5000000, 20000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 50000, 500000, 'L2 department head'),
  (3, 500000, 2000000, 'INR', '["office","mro","ppe","other"]', '["office"]', 25000, 100000, 'L3 manager'),
  (4, 200000, 800000, 'INR', '["office","mro","ppe","other"]', '[]', 0, 50000, 'L4 requester'),
  (5, 50000, 200000, 'INR', '["office","mro","other"]', '[]', 0, 25000, 'L5 basic')
ON CONFLICT (role_level) DO NOTHING;
