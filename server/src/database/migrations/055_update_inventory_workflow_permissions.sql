BEGIN;

-- Ensure workflow features expose 'status_change' permission (and 'submit' as fallback)
-- This migration is idempotent and will append missing permissions.

-- Delivery Challan workflow feature
UPDATE features
SET available_permissions = (
  CASE
    WHEN available_permissions ? 'status_change' THEN available_permissions
    ELSE COALESCE(available_permissions, '[]'::jsonb) || '"status_change"'::jsonb
  END
)
WHERE name = 'delivery_challan_workflow' AND module_id IN (SELECT id FROM modules WHERE name = 'inventory');

UPDATE features
SET available_permissions = (
  CASE
    WHEN available_permissions ? 'submit' THEN available_permissions
    ELSE COALESCE(available_permissions, '[]'::jsonb) || '"submit"'::jsonb
  END
)
WHERE name = 'delivery_challan_workflow' AND module_id IN (SELECT id FROM modules WHERE name = 'inventory');

-- SRN workflow feature
UPDATE features
SET available_permissions = (
  CASE
    WHEN available_permissions ? 'status_change' THEN available_permissions
    ELSE COALESCE(available_permissions, '[]'::jsonb) || '"status_change"'::jsonb
  END
)
WHERE name = 'srn_workflow' AND module_id IN (SELECT id FROM modules WHERE name = 'inventory');

UPDATE features
SET available_permissions = (
  CASE
    WHEN available_permissions ? 'submit' THEN available_permissions
    ELSE COALESCE(available_permissions, '[]'::jsonb) || '"submit"'::jsonb
  END
)
WHERE name = 'srn_workflow' AND module_id IN (SELECT id FROM modules WHERE name = 'inventory');

COMMIT;


