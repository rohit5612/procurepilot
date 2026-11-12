BEGIN;

ALTER TABLE inventory_adjustments
  ADD COLUMN IF NOT EXISTS workflow_instance_id INTEGER REFERENCES workflow_instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id);

COMMIT;


