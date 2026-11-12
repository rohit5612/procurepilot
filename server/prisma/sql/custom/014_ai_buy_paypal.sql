-- AI Buy sessions + PayPal payment audit (also ensured at runtime)
BEGIN;

CREATE TABLE IF NOT EXISTS purchase_requests (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(40) NOT NULL DEFAULT 'draft',
  raw_text TEXT,
  extracted_json JSONB,
  confirmed_json JSONB,
  policy_result_json JSONB,
  ai_explanation TEXT,
  selected_offer_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_requests_user ON purchase_requests(user_id);

ALTER TABLE purchase_requests
  ADD COLUMN IF NOT EXISTS offers_json JSONB,
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS checkout_currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS checkout_amount NUMERIC(14,2);

CREATE TABLE IF NOT EXISTS payment_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_request_id INTEGER REFERENCES purchase_requests(id) ON DELETE SET NULL,
  paypal_order_id VARCHAR(80),
  paypal_capture_id VARCHAR(80),
  amount NUMERIC(14,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  amount_inr NUMERIC(14,2),
  status VARCHAR(32) NOT NULL DEFAULT 'created',
  raw_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_user ON payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_pr ON payment_events(purchase_request_id);

COMMIT;
