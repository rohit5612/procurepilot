BEGIN;

-- Add region fields to sites
ALTER TABLE IF EXISTS sites
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

-- Validate cluster belongs to circle (deferred to allow backfill)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sites_cluster_circle_match'
  ) THEN
    ALTER TABLE sites
    ADD CONSTRAINT sites_cluster_circle_match
    CHECK (
      cluster_id IS NULL OR circle_id IS NULL OR EXISTS (
        SELECT 1 FROM clusters c WHERE c.id = cluster_id AND c.circle_id = circle_id
      )
    );
  END IF;
END$$;

-- Add region fields to warehouses
ALTER TABLE IF EXISTS warehouses
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'warehouses_cluster_circle_match'
  ) THEN
    ALTER TABLE warehouses
    ADD CONSTRAINT warehouses_cluster_circle_match
    CHECK (
      cluster_id IS NULL OR circle_id IS NULL OR EXISTS (
        SELECT 1 FROM clusters c WHERE c.id = cluster_id AND c.circle_id = circle_id
      )
    );
  END IF;
END$$;

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_sites_circle_id ON sites(circle_id);
CREATE INDEX IF NOT EXISTS idx_sites_cluster_id ON sites(cluster_id);
CREATE INDEX IF NOT EXISTS idx_wh_circle_id ON warehouses(circle_id);
CREATE INDEX IF NOT EXISTS idx_wh_cluster_id ON warehouses(cluster_id);

COMMIT;


