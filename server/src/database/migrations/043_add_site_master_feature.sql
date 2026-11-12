-- Migration: Add site_master feature to inventory module
-- Description: Add site master management feature to inventory module
-- Date: 2025-08-16

BEGIN;

-- Add site_master feature to inventory module
INSERT INTO features (module_id, name, display_name, description, available_permissions, default_data_scope, is_active, feature_order, route_path, icon) 
SELECT 
    m.id,
    'site_master',
    'Site Master',
    'Manage company sites and locations',
    '["create", "read", "update", "delete", "approve", "export"]'::jsonb,
    'all',
    true,
    6,
    '/inventory/sites',
    'map-pin'
FROM modules m WHERE m.name = 'inventory'
ON CONFLICT (module_id, name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    available_permissions = EXCLUDED.available_permissions,
    default_data_scope = EXCLUDED.default_data_scope,
    is_active = EXCLUDED.is_active,
    feature_order = EXCLUDED.feature_order,
    route_path = EXCLUDED.route_path,
    icon = EXCLUDED.icon;

COMMIT;

