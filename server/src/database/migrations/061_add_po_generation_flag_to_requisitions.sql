BEGIN;

-- Add flag to track if a PR is closed for PO generation
-- This is a system-level flag that doesn't affect PR visibility
ALTER TABLE requisitions 
ADD COLUMN IF NOT EXISTS is_po_generated BOOLEAN DEFAULT FALSE;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_requisitions_po_generated ON requisitions(is_po_generated);

-- Update existing requisitions that have POs submitted
UPDATE requisitions r
SET is_po_generated = TRUE
WHERE EXISTS (
  SELECT 1 FROM purchase_orders po
  WHERE po.requisition_id = r.id
  AND po.status IN ('pending_approval', 'approved', 'issued')
);

COMMIT;

