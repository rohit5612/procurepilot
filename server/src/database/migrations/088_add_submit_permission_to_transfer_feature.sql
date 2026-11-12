-- Add 'submit' to transfer feature available_permissions
BEGIN;

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
  AND f.name = 'transfer';

COMMIT;


