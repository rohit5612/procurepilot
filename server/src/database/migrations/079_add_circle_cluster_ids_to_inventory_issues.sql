-- Add circle_id and cluster_id foreign keys to inventory_issues (proper normalization)
ALTER TABLE inventory_issues
ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_issues_circle_id ON inventory_issues(circle_id);
CREATE INDEX IF NOT EXISTS idx_inventory_issues_cluster_id ON inventory_issues(cluster_id);

-- Comments
COMMENT ON COLUMN inventory_issues.circle_id IS 'Foreign key reference to telecom_circles table';
COMMENT ON COLUMN inventory_issues.cluster_id IS 'Foreign key reference to clusters table';

-- Note: We keep circle_name and cluster_name for backward compatibility and print views
-- but circle_id and cluster_id are the source of truth

