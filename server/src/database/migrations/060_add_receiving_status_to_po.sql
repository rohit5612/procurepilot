BEGIN;

-- Add receiving_status column to track PO receiving status
-- open: when issued and/or GRN qty < PO qty
-- closed: when GRN qty = PO qty, or when PO is rejected
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS receiving_status VARCHAR(20) DEFAULT 'not_started';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_receiving_status ON purchase_orders(receiving_status);

-- Note: We're keeping 'canceled' and 'closed' in the enum for backward compatibility
-- but the application will no longer use them. Instead:
-- - draft POs can be deleted
-- - rejected POs use 'rejected' status
-- - receiving status is tracked separately

COMMIT;

