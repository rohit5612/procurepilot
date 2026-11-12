-- Re-enable goods_receipt for ProcurePilot (deactivated in procurepilot_rbac_seed)
BEGIN;

UPDATE features f
SET
  is_active = true,
  display_name = COALESCE(NULLIF(f.display_name, ''), 'Goods receipt'),
  available_permissions = COALESCE(f.available_permissions, '[]'::jsonb)
    || CASE WHEN NOT (COALESCE(f.available_permissions, '[]'::jsonb) ? 'read') THEN '["read"]'::jsonb ELSE '[]'::jsonb END
    || CASE WHEN NOT (COALESCE(f.available_permissions, '[]'::jsonb) ? 'create') THEN '["create"]'::jsonb ELSE '[]'::jsonb END
    || CASE WHEN NOT (COALESCE(f.available_permissions, '[]'::jsonb) ? 'update') THEN '["update"]'::jsonb ELSE '[]'::jsonb END
    || CASE WHEN NOT (COALESCE(f.available_permissions, '[]'::jsonb) ? 'delete') THEN '["delete"]'::jsonb ELSE '[]'::jsonb END
    || CASE WHEN NOT (COALESCE(f.available_permissions, '[]'::jsonb) ? 'submit') THEN '["submit"]'::jsonb ELSE '[]'::jsonb END
    || CASE WHEN NOT (COALESCE(f.available_permissions, '[]'::jsonb) ? 'approve') THEN '["approve"]'::jsonb ELSE '[]'::jsonb END,
  updated_at = NOW()
FROM modules m
WHERE f.module_id = m.id
  AND m.name = 'procurement'
  AND f.name = 'goods_receipt';

INSERT INTO features (
  module_id, name, display_name, description, feature_order,
  available_permissions, available_data_scopes, default_permissions, default_data_scope, is_active
)
SELECT
  m.id,
  'goods_receipt',
  'Goods receipt (GRN)',
  'Receive goods against purchase orders',
  6,
  '["read", "create", "update", "delete", "submit", "approve"]'::jsonb,
  '["own", "department", "all"]'::jsonb,
  '["read"]'::jsonb,
  'department',
  true
FROM modules m
WHERE m.name = 'procurement'
  AND NOT EXISTS (
    SELECT 1 FROM features f WHERE f.module_id = m.id AND f.name = 'goods_receipt'
  );

COMMIT;
