BEGIN;

-- 1) Add adjustment approval workflow feature to inventory module if missing
INSERT INTO features (module_id, name, display_name, description, is_active)
SELECT m.id, 'adjustment_approval_workflow', 'Adjustment Approval Workflow', 'Approval workflow for stock adjustments before posting', true
FROM modules m
WHERE m.name = 'inventory'
AND NOT EXISTS (
  SELECT 1 FROM features f WHERE f.module_id = m.id AND f.name = 'adjustment_approval_workflow'
);

-- 2) Add 'submit' to adjustments feature available permissions
UPDATE features f
SET available_permissions = (
  CASE 
    WHEN f.available_permissions IS NULL THEN '["create","read","update","delete","submit"]'::jsonb
    WHEN NOT (f.available_permissions ? 'submit') THEN f.available_permissions || '"submit"'
    ELSE f.available_permissions
  END
)
FROM modules m
WHERE f.module_id = m.id
  AND m.name = 'inventory'
  AND f.name = 'adjustment';

COMMIT;


