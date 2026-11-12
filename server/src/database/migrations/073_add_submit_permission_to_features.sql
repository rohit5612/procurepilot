-- Add 'submit' permission to relevant features that have approval workflows
-- Features like requisitions, purchase_orders need submit before approve

BEGIN;

-- Update requisition feature to include 'submit'
UPDATE features 
SET available_permissions = 
  CASE 
    WHEN available_permissions @> '["submit"]'::jsonb 
    THEN available_permissions
    ELSE available_permissions || '["submit"]'::jsonb
  END
WHERE name IN ('requisition', 'requisitions', 'purchase_order', 'purchase_orders')
  AND NOT (available_permissions @> '["submit"]'::jsonb);

-- Add comment
COMMENT ON COLUMN features.available_permissions IS 
  'Available permission actions: create, read, update, delete, submit, approve, export, bulk_action';

COMMIT;

-- Verify
SELECT name, display_name, available_permissions 
FROM features 
WHERE name IN ('requisition', 'requisitions', 'purchase_order', 'purchase_orders');

