-- PR geo columns (ProcurePilot — no GRN/inventory transaction tables)
ALTER TABLE IF EXISTS requisitions
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

CREATE INDEX IF NOT EXISTS idx_pr_circle_id ON requisitions(circle_id);
CREATE INDEX IF NOT EXISTS idx_pr_cluster_id ON requisitions(cluster_id);
