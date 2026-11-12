BEGIN;

-- Add Stock Count Approval Workflow feature under inventory module
INSERT INTO features (module_id, name, display_name, description, is_active)
SELECT m.id, 'stock_count_approval_workflow', 'Stock Count Approval Workflow', 'Approval workflow for stock counts before posting', true
FROM modules m
WHERE m.name = 'inventory'
AND NOT EXISTS (
  SELECT 1 FROM features f WHERE f.module_id = m.id AND f.name = 'stock_count_approval_workflow'
);

COMMIT;


