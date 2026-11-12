-- RFQ, supplier invoice, store return features for procurement module
BEGIN;

INSERT INTO features (
  module_id, name, display_name, description, feature_order,
  available_permissions, available_data_scopes, default_permissions, default_data_scope, is_active
)
SELECT
  m.id,
  v.name,
  v.display_name,
  v.description,
  v.feature_order,
  v.available_permissions::jsonb,
  '["own", "department", "all"]'::jsonb,
  '["read"]'::jsonb,
  'department',
  true
FROM modules m
CROSS JOIN (VALUES
  ('request_quotation', 'Request for quotation', 'RFQ sourcing and quote comparison', 7, '["read", "create", "update", "delete", "submit", "approve"]'),
  ('supplier_invoice', 'Supplier invoices', 'Invoice capture and PO/GRN matching', 8, '["read", "create", "update", "delete", "approve"]'),
  ('store_return_note', 'Store returns (SRN)', 'Returns against GRN lines', 9, '["read", "create", "update", "delete", "approve"]')
) AS v(name, display_name, description, feature_order, available_permissions)
WHERE m.name = 'procurement'
  AND NOT EXISTS (
    SELECT 1 FROM features f WHERE f.module_id = m.id AND f.name = v.name
  );

UPDATE features f
SET is_active = true, updated_at = NOW()
FROM modules m
WHERE f.module_id = m.id
  AND m.name = 'procurement'
  AND f.name IN ('request_quotation', 'supplier_invoice', 'store_return_note', 'goods_receipt');

COMMIT;
