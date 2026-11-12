-- Clean up and sync features with actual implementation
-- Remove features that don't exist, add missing ones, update permissions

BEGIN;

-- ============================================================================
-- STEP 1: Remove features that are NOT implemented
-- ============================================================================

-- Delete non-existent procurement features
DELETE FROM features WHERE name IN (
  'request_quotation',  -- RFQ not implemented
  'receipts'            -- Payment receipts not implemented  
) AND module_id = (SELECT id FROM modules WHERE name = 'procurement');

-- Delete non-existent inventory features  
DELETE FROM features WHERE name IN (
  'reorder_planning',   -- Not implemented
  'demand_forecast',    -- Not implemented
  'abc_analysis'        -- Not implemented
) AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- ============================================================================
-- STEP 2: Add MISSING features that ARE implemented
-- ============================================================================

-- Add Circle Management to system module (implemented)
INSERT INTO features (module_id, name, display_name, description, feature_order, available_permissions, available_data_scopes, default_permissions, route_path, icon)
SELECT 
  m.id,
  'circle_management',
  'Circle Management',
  'Manage geographical circles for GST and operations',
  8,
  '["create", "read", "update", "delete"]'::jsonb,
  '["all"]'::jsonb,
  '["read"]'::jsonb,
  '/system/circles',
  'map-pin'
FROM modules m 
WHERE m.name = 'system'
AND NOT EXISTS (SELECT 1 FROM features WHERE name = 'circle_management');

-- Add Cluster Management to system module (implemented)
INSERT INTO features (module_id, name, display_name, description, feature_order, available_permissions, available_data_scopes, default_permissions, route_path, icon)
SELECT 
  m.id,
  'cluster_management',
  'Cluster Management',
  'Manage operational clusters and groupings',
  9,
  '["create", "read", "update", "delete"]'::jsonb,
  '["all"]'::jsonb,
  '["read"]'::jsonb,
  '/system/clusters',
  'layers'
FROM modules m 
WHERE m.name = 'system'
AND NOT EXISTS (SELECT 1 FROM features WHERE name = 'cluster_management');

-- Add Site Management to inventory module (implemented)
INSERT INTO features (module_id, name, display_name, description, feature_order, available_permissions, available_data_scopes, default_permissions, route_path, icon)
SELECT 
  m.id,
  'site_management',
  'Site Management',
  'Manage operational sites and locations',
  11,
  '["create", "read", "update", "delete"]'::jsonb,
  '["all"]'::jsonb,
  '["read"]'::jsonb,
  '/inventory/sites',
  'map'
FROM modules m 
WHERE m.name = 'inventory'
AND NOT EXISTS (SELECT 1 FROM features WHERE name = 'site_management');

-- Add Category Management to inventory module (implemented)
INSERT INTO features (module_id, name, display_name, description, feature_order, available_permissions, available_data_scopes, default_permissions, route_path, icon)
SELECT 
  m.id,
  'category_management',
  'Category Management',
  'Manage item categories and classifications',
  12,
  '["create", "read", "update", "delete"]'::jsonb,
  '["department", "all"]'::jsonb,
  '["read"]'::jsonb,
  '/inventory/categories',
  'folder'
FROM modules m 
WHERE m.name = 'inventory'
AND NOT EXISTS (SELECT 1 FROM features WHERE name = 'category_management');

-- ============================================================================
-- STEP 3: Update existing features with correct permissions including SUBMIT
-- ============================================================================

-- Update Purchase Requisition to include submit
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "submit", "approve", "export"]'::jsonb
WHERE name = 'purchase_requisition'
AND module_id = (SELECT id FROM modules WHERE name = 'procurement');

-- Update Purchase Order to include submit
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "submit", "approve", "export"]'::jsonb
WHERE name = 'purchase_order'
AND module_id = (SELECT id FROM modules WHERE name = 'procurement');

-- Update Goods Receipt (GRN)
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "export"]'::jsonb
WHERE name = 'goods_receipt'
AND module_id = (SELECT id FROM modules WHERE name = 'procurement');

-- Update Supplier Management
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "export"]'::jsonb
WHERE name = 'supplier_management'
AND module_id = (SELECT id FROM modules WHERE name = 'procurement');

-- Update Price List
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "export"]'::jsonb
WHERE name = 'price_list'
AND module_id = (SELECT id FROM modules WHERE name = 'procurement');

-- Update Item Master
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "export", "bulk_action"]'::jsonb
WHERE name = 'item_master'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Stock Movement
UPDATE features 
SET available_permissions = '["create", "read", "export"]'::jsonb
WHERE name = 'stock_movement'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Transfer
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "submit", "approve", "export"]'::jsonb
WHERE name = 'transfer'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Adjustment
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "submit", "approve", "export"]'::jsonb
WHERE name = 'adjustment'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Issue
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "submit", "approve", "export"]'::jsonb
WHERE name = 'issue'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Stock Count
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete", "submit", "approve", "export"]'::jsonb
WHERE name = 'stock_count'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Warehouse Management
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'warehouse_management'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Bin Management  
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'bin_management'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Stock Control
UPDATE features 
SET available_permissions = '["read", "export"]'::jsonb
WHERE name = 'stock_control'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update Stock Valuation
UPDATE features 
SET available_permissions = '["read", "export"]'::jsonb
WHERE name = 'stock_valuation'
AND module_id = (SELECT id FROM modules WHERE name = 'inventory');

-- Update User Approval
UPDATE features 
SET available_permissions = '["read", "update", "approve"]'::jsonb
WHERE name = 'user_approval'
AND module_id = (SELECT id FROM modules WHERE name = 'user_management');

-- Update User Directory
UPDATE features 
SET available_permissions = '["read", "update", "export"]'::jsonb
WHERE name = 'user_directory'
AND module_id = (SELECT id FROM modules WHERE name = 'user_management');

-- Update User Assignment
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'user_assignment'
AND module_id = (SELECT id FROM modules WHERE name = 'user_management');

-- Update Archived Users
UPDATE features 
SET available_permissions = '["read", "update"]'::jsonb
WHERE name = 'archived_users'
AND module_id = (SELECT id FROM modules WHERE name = 'user_management');

-- Update Appeals
UPDATE features 
SET available_permissions = '["read", "update", "approve"]'::jsonb
WHERE name = 'appeals'
AND module_id = (SELECT id FROM modules WHERE name = 'user_management');

-- Update Role Management
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'role_management'
AND module_id = (SELECT id FROM modules WHERE name = 'user_management');

-- Update Department Management
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'department_management'
AND module_id = (SELECT id FROM modules WHERE name = 'user_management');

-- Update Module Registry
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'module_registry'
AND module_id = (SELECT id FROM modules WHERE name = 'system');

-- Update Audit Logs
UPDATE features 
SET available_permissions = '["read", "export"]'::jsonb
WHERE name = 'audit_logs'
AND module_id = (SELECT id FROM modules WHERE name = 'system');

-- Update Activity Logs
UPDATE features 
SET available_permissions = '["read", "export"]'::jsonb
WHERE name = 'activity_logs'
AND module_id = (SELECT id FROM modules WHERE name = 'system');

-- Update Error Logs
UPDATE features 
SET available_permissions = '["read", "export"]'::jsonb
WHERE name = 'error_logs'
AND module_id = (SELECT id FROM modules WHERE name = 'system');

-- Update Workflow Engine
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'workflow_engine'
AND module_id = (SELECT id FROM modules WHERE name = 'system');

-- Update Workflow Designer
UPDATE features 
SET available_permissions = '["create", "read", "update", "delete"]'::jsonb
WHERE name = 'workflow_designer'
AND module_id = (SELECT id FROM modules WHERE name = 'system');

-- Update Workflow Instances
UPDATE features 
SET available_permissions = '["read", "update", "export"]'::jsonb
WHERE name = 'workflow_instances'
AND module_id = (SELECT id FROM modules WHERE name = 'system');

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Show all features by module
SELECT 
  m.name as module,
  f.name as feature_name,
  f.display_name,
  f.available_permissions,
  f.route_path
FROM features f
JOIN modules m ON m.id = f.module_id
ORDER BY m.module_order, f.feature_order;

