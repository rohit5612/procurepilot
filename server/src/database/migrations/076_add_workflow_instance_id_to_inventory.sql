-- Add workflow_instance_id and workflow-related columns to inventory_issues
ALTER TABLE inventory_issues
ADD COLUMN IF NOT EXISTS workflow_instance_id INTEGER REFERENCES workflow_instances(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_issues_workflow_instance ON inventory_issues(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_inventory_issues_status ON inventory_issues(status);

-- Add workflow_instance_id and workflow-related columns to store_return_notes
ALTER TABLE store_return_notes
ADD COLUMN IF NOT EXISTS workflow_instance_id INTEGER REFERENCES workflow_instances(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_store_return_notes_workflow_instance ON store_return_notes(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_store_return_notes_status ON store_return_notes(status);

-- Comment
COMMENT ON COLUMN inventory_issues.workflow_instance_id IS 'Reference to the workflow instance for approval process';
COMMENT ON COLUMN store_return_notes.workflow_instance_id IS 'Reference to the workflow instance for approval process';

