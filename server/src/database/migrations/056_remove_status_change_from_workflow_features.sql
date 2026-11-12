BEGIN;

-- Remove 'status_change' from available_permissions for inventory workflow features

UPDATE features
SET available_permissions = (
  SELECT COALESCE(jsonb_agg(value) FILTER (WHERE value <> 'status_change'), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(available_permissions, '[]'::jsonb))
)
WHERE name IN ('delivery_challan_workflow','srn_workflow')
  AND module_id IN (SELECT id FROM modules WHERE name = 'inventory');

COMMIT;



