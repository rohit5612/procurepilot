-- Migration: Add 'closed' status to po_status enum and align existing POs

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'po_status' AND e.enumlabel = 'closed'
  ) THEN
    ALTER TYPE po_status ADD VALUE 'closed';
  END IF;
END$$;

-- Optionally mark fully received issued POs as closed
UPDATE purchase_orders po
SET status = 'closed'
WHERE status = 'issued' AND (
  SELECT COALESCE(SUM(gl.accepted_qty), 0)
  FROM goods_receipts grn
  JOIN grn_lines gl ON gl.goods_receipt_id = grn.id
  WHERE grn.purchase_order_id = po.id AND grn.status = 'posted'
) >= COALESCE(po.total_quantity, 0);

COMMIT;


