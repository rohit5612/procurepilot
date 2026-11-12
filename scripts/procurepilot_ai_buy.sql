-- AI Buy session persistence (optional; also auto-created on first use)
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
