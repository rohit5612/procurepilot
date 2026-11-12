BEGIN;

-- Add circle and cluster references to sites
ALTER TABLE IF EXISTS sites
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

-- Indexes for faster filtering
CREATE INDEX IF NOT EXISTS idx_sites_circle_id ON sites(circle_id);
CREATE INDEX IF NOT EXISTS idx_sites_cluster_id ON sites(cluster_id);

COMMIT;


