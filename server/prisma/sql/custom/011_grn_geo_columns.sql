-- Circle / cluster on GRN (ProcurePilot — avoid legacy 053 multi-table alter)
BEGIN;

ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS circle_id INTEGER REFERENCES telecom_circles(id);

ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS cluster_id INTEGER REFERENCES clusters(id);

CREATE INDEX IF NOT EXISTS idx_grn_circle_id ON goods_receipts(circle_id);
CREATE INDEX IF NOT EXISTS idx_grn_cluster_id ON goods_receipts(cluster_id);

COMMIT;
