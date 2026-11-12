-- Add quantity_returned column to inventory_issue_lines to track returns
ALTER TABLE inventory_issue_lines
ADD COLUMN IF NOT EXISTS quantity_returned NUMERIC(15, 4) DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_inventory_issue_lines_returnable 
ON inventory_issue_lines(is_returnable) 
WHERE is_returnable = true;

-- Comment
COMMENT ON COLUMN inventory_issue_lines.quantity_returned IS 'Quantity returned via Store Return Notes';

