BEGIN;

CREATE TABLE IF NOT EXISTS supplier_circles (
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  circle_id INTEGER NOT NULL REFERENCES telecom_circles(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, circle_id)
);

CREATE TABLE IF NOT EXISTS supplier_clusters (
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
  PRIMARY KEY (supplier_id, cluster_id)
);

CREATE INDEX IF NOT EXISTS idx_supplier_circles_supplier ON supplier_circles(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_circles_circle ON supplier_circles(circle_id);
CREATE INDEX IF NOT EXISTS idx_supplier_clusters_supplier ON supplier_clusters(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_clusters_cluster ON supplier_clusters(cluster_id);

COMMIT;


