-- GRN line snapshots (ordered / already received at time of entry)
BEGIN;

ALTER TABLE grn_lines
  ADD COLUMN IF NOT EXISTS qty_as_per_po_snapshot DECIMAL(15, 3),
  ADD COLUMN IF NOT EXISTS already_received_snapshot DECIMAL(15, 3),
  ADD COLUMN IF NOT EXISTS expected_qty_snapshot DECIMAL(15, 3);

COMMIT;
