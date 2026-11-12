-- Add optional bin capture to goods receipts
ALTER TABLE goods_receipts
  ADD COLUMN IF NOT EXISTS bin_id integer NULL;

ALTER TABLE goods_receipts
  ADD CONSTRAINT goods_receipts_bin_id_fkey
  FOREIGN KEY (bin_id) REFERENCES bins(id);

-- No backfill needed; null means warehouse-level only

