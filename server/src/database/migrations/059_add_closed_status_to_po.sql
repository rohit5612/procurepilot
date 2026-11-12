BEGIN;

-- Add 'closed' status to po_status enum
-- First, add it to the enum type
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'closed';

-- Add is_closed boolean column for additional tracking
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS is_closed BOOLEAN DEFAULT FALSE;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_purchase_orders_is_closed ON purchase_orders(is_closed);

COMMIT;


