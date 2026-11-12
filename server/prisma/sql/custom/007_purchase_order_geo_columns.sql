ALTER TABLE IF EXISTS purchase_orders
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

CREATE INDEX IF NOT EXISTS idx_po_circle_id ON purchase_orders(circle_id);
CREATE INDEX IF NOT EXISTS idx_po_cluster_id ON purchase_orders(cluster_id);
