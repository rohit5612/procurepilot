BEGIN;

-- Add Delivery Challan and SRN workflow features to module registry
-- Assumes 'inventory' module exists and features table supports available_permissions jsonb

INSERT INTO features (module_id, name, display_name, description, available_permissions, default_data_scope, is_active, feature_order, route_path, icon)
SELECT m.id, 'delivery_challan_workflow', 'Delivery Challan Approval', 'Workflow approvals for Delivery Challans',
       '["read","create","update","approve","reject","submit"]'::jsonb, 'all', true, 50, '/inventory/transactions/issues', 'check-square'
FROM modules m WHERE m.name = 'inventory'
ON CONFLICT DO NOTHING;

INSERT INTO features (module_id, name, display_name, description, available_permissions, default_data_scope, is_active, feature_order, route_path, icon)
SELECT m.id, 'srn_workflow', 'SRN Approval', 'Workflow approvals for Store Return Notes',
       '["read","create","update","approve","reject","submit"]'::jsonb, 'all', true, 51, '/inventory/transactions/store-returns', 'rotate-ccw'
FROM modules m WHERE m.name = 'inventory'
ON CONFLICT DO NOTHING;

COMMIT;


