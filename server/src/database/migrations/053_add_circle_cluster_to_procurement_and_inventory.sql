BEGIN;

-- Requisitions (PR)
ALTER TABLE IF EXISTS requisitions
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

CREATE INDEX IF NOT EXISTS idx_pr_circle_id ON requisitions(circle_id);
CREATE INDEX IF NOT EXISTS idx_pr_cluster_id ON requisitions(cluster_id);

-- Purchase Orders (PO)
ALTER TABLE IF NOT EXISTS purchase_orders
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

CREATE INDEX IF NOT EXISTS idx_po_circle_id ON purchase_orders(circle_id);
CREATE INDEX IF NOT EXISTS idx_po_cluster_id ON purchase_orders(cluster_id);

-- Goods Receipts (GRN)
ALTER TABLE IF NOT EXISTS goods_receipts
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

CREATE INDEX IF NOT EXISTS idx_grn_circle_id ON goods_receipts(circle_id);
CREATE INDEX IF NOT EXISTS idx_grn_cluster_id ON goods_receipts(cluster_id);

-- Inventory structures
ALTER TABLE IF NOT EXISTS inventory_layers
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

ALTER TABLE IF NOT EXISTS inventory_transactions
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

CREATE INDEX IF NOT EXISTS idx_il_circle_id ON inventory_layers(circle_id);
CREATE INDEX IF NOT EXISTS idx_il_cluster_id ON inventory_layers(cluster_id);
CREATE INDEX IF NOT EXISTS idx_it_circle_id ON inventory_transactions(circle_id);
CREATE INDEX IF NOT EXISTS idx_it_cluster_id ON inventory_transactions(cluster_id);

-- Consistency checks (soft via CHECK; ensure cluster belongs to circle when both set)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'requisitions_cluster_circle_match') THEN
    ALTER TABLE requisitions ADD CONSTRAINT requisitions_cluster_circle_match
      CHECK (cluster_id IS NULL OR circle_id IS NULL OR EXISTS (
        SELECT 1 FROM clusters c WHERE c.id = cluster_id AND c.circle_id = circle_id
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchase_orders_cluster_circle_match') THEN
    ALTER TABLE purchase_orders ADD CONSTRAINT purchase_orders_cluster_circle_match
      CHECK (cluster_id IS NULL OR circle_id IS NULL OR EXISTS (
        SELECT 1 FROM clusters c WHERE c.id = cluster_id AND c.circle_id = circle_id
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goods_receipts_cluster_circle_match') THEN
    ALTER TABLE goods_receipts ADD CONSTRAINT goods_receipts_cluster_circle_match
      CHECK (cluster_id IS NULL OR circle_id IS NULL OR EXISTS (
        SELECT 1 FROM clusters c WHERE c.id = cluster_id AND c.circle_id = circle_id
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_layers_cluster_circle_match') THEN
    ALTER TABLE inventory_layers ADD CONSTRAINT inventory_layers_cluster_circle_match
      CHECK (cluster_id IS NULL OR circle_id IS NULL OR EXISTS (
        SELECT 1 FROM clusters c WHERE c.id = cluster_id AND c.circle_id = circle_id
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_transactions_cluster_circle_match') THEN
    ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transactions_cluster_circle_match
      CHECK (cluster_id IS NULL OR circle_id IS NULL OR EXISTS (
        SELECT 1 FROM clusters c WHERE c.id = cluster_id AND c.circle_id = circle_id
      ));
  END IF;
END$$;

COMMIT;


