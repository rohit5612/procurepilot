-- Temporary Employee Master for Inventory module
-- This will eventually be replaced by full HR employee schema.

BEGIN;

CREATE TABLE IF NOT EXISTS inventory_employee_master (
  id SERIAL PRIMARY KEY,
  employee_code TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  designation   TEXT,
  department    TEXT,
  branch        TEXT,
  location      TEXT,
  phone         TEXT,
  email         TEXT,
  status        TEXT NOT NULL DEFAULT 'ACTIVE',
  notes         TEXT,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_employee_master_code
  ON inventory_employee_master(employee_code);

CREATE INDEX IF NOT EXISTS idx_inventory_employee_master_status
  ON inventory_employee_master(status);

COMMIT;

