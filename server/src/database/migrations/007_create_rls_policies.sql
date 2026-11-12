-- Migration 007: Create Row Level Security Policies and Views
-- Phase 4: Hybrid Permission System - Database Level Security

-- Enable Row Level Security on key tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- Create helper function to get current user ID from application context
-- This will be set by the application when establishing database connections
CREATE OR REPLACE FUNCTION current_app_user_id() RETURNS INTEGER AS $$
BEGIN
  -- Get user ID from application-set session variable
  RETURN COALESCE(current_setting('app.current_user_id', true)::INTEGER, 0);
EXCEPTION
  WHEN OTHERS THEN
    RETURN 0; -- Default to 0 if not set (will fail most policies)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to check if current user is superuser
CREATE OR REPLACE FUNCTION current_user_is_superuser() RETURNS BOOLEAN AS $$
DECLARE
  user_id INTEGER;
  is_super BOOLEAN;
BEGIN
  user_id := current_app_user_id();
  
  IF user_id = 0 THEN
    RETURN FALSE;
  END IF;
  
  SELECT is_superuser INTO is_super 
  FROM users 
  WHERE id = user_id AND deleted_at IS NULL;
  
  RETURN COALESCE(is_super, FALSE);
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get current user's department ID
CREATE OR REPLACE FUNCTION current_user_department_id() RETURNS INTEGER AS $$
DECLARE
  user_id INTEGER;
  dept_id INTEGER;
BEGIN
  user_id := current_app_user_id();
  
  IF user_id = 0 THEN
    RETURN 0;
  END IF;
  
  SELECT r.department_id INTO dept_id
  FROM users u
  JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
  JOIN roles r ON ur.role_id = r.id
  WHERE u.id = user_id AND u.deleted_at IS NULL
  LIMIT 1;
  
  RETURN COALESCE(dept_id, 0);
EXCEPTION
  WHEN OTHERS THEN
    RETURN 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check data access based on permission and scope
CREATE OR REPLACE FUNCTION check_data_access(
  user_id INTEGER,
  resource_type TEXT,
  resource_id INTEGER,
  action TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  module_name TEXT;
  feature_name TEXT;
  data_scope TEXT;
  resource_dept_id INTEGER;
  resource_owner_id INTEGER;
  user_dept_id INTEGER;
BEGIN
  -- Parse resource type
  module_name := split_part(resource_type, '.', 1);
  feature_name := split_part(resource_type, '.', 2);
  
  -- Check if user is superuser
  IF (SELECT is_superuser FROM users WHERE id = user_id AND deleted_at IS NULL) THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's data scope for this resource
  SELECT rp.data_scope INTO data_scope
  FROM users u
  JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
  JOIN roles r ON ur.role_id = r.id AND r.is_active = true
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN features f ON rp.feature_id = f.id AND f.name = feature_name
  JOIN modules m ON f.module_id = m.id AND m.name = module_name
  WHERE u.id = user_id AND u.deleted_at IS NULL
  LIMIT 1;
  
  -- If no permission found, deny access
  IF data_scope IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- If scope is 'all', allow access
  IF data_scope = 'all' THEN
    RETURN TRUE;
  END IF;
  
  -- Get user's department
  user_dept_id := current_user_department_id();
  
  -- Get resource information based on resource type
  CASE resource_type
    WHEN 'user_management.users' THEN
      SELECT ur2.role_id, u2.created_by INTO resource_dept_id, resource_owner_id
      FROM users u2
      LEFT JOIN user_roles ur2 ON u2.id = ur2.user_id AND ur2.is_active = true
      LEFT JOIN roles r2 ON ur2.role_id = r2.id
      WHERE u2.id = resource_id AND u2.deleted_at IS NULL;
      
    WHEN 'user_management.departments' THEN
      SELECT id, created_by INTO resource_dept_id, resource_owner_id
      FROM departments
      WHERE id = resource_id AND is_active = true;
      
    WHEN 'user_management.roles' THEN
      SELECT department_id, created_by INTO resource_dept_id, resource_owner_id
      FROM roles
      WHERE id = resource_id AND is_active = true;
      
    ELSE
      -- Default case for other resource types
      RETURN FALSE;
  END CASE;
  
  -- Apply scope rules
  CASE data_scope
    WHEN 'own' THEN
      RETURN resource_owner_id = user_id;
    WHEN 'department' THEN
      RETURN resource_dept_id = user_dept_id OR resource_owner_id = user_id;
    ELSE
      RETURN FALSE;
  END CASE;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for Users table
CREATE POLICY users_select_policy ON users FOR SELECT
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.users', id, 'read')
  );

CREATE POLICY users_insert_policy ON users FOR INSERT
  WITH CHECK (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.users', id, 'create')
  );

CREATE POLICY users_update_policy ON users FOR UPDATE
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.users', id, 'update')
  );

CREATE POLICY users_delete_policy ON users FOR DELETE
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.users', id, 'delete')
  );

-- RLS Policies for Departments table
CREATE POLICY departments_select_policy ON departments FOR SELECT
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.departments', id, 'read')
  );

CREATE POLICY departments_insert_policy ON departments FOR INSERT
  WITH CHECK (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.departments', id, 'create')
  );

CREATE POLICY departments_update_policy ON departments FOR UPDATE
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.departments', id, 'update')
  );

CREATE POLICY departments_delete_policy ON departments FOR DELETE
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.departments', id, 'delete')
  );

-- RLS Policies for Roles table
CREATE POLICY roles_select_policy ON roles FOR SELECT
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.roles', id, 'read')
  );

CREATE POLICY roles_insert_policy ON roles FOR INSERT
  WITH CHECK (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.roles', id, 'create')
  );

CREATE POLICY roles_update_policy ON roles FOR UPDATE
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.roles', id, 'update')
  );

CREATE POLICY roles_delete_policy ON roles FOR DELETE
  USING (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.roles', id, 'delete')
  );

-- Create security-aware views for common queries
-- These views automatically apply security filters

-- User Management View with Security Context
CREATE OR REPLACE VIEW secure_users_view AS
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.status,
  u.email_verified,
  u.is_superuser,
  u.last_login,
  u.created_at,
  u.updated_at,
  r.name as role_name,
  r.display_name as role_display_name,
  r.role_level,
  d.name as department_name,
  d.display_name as department_display_name,
  CASE 
    WHEN u.created_by = current_app_user_id() THEN 'own'
    WHEN r.department_id = current_user_department_id() THEN 'department'
    ELSE 'restricted'
  END as access_level
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
LEFT JOIN roles r ON ur.role_id = r.id
LEFT JOIN departments d ON r.department_id = d.id
WHERE u.deleted_at IS NULL
  AND (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.users', u.id, 'read')
  );

-- Department View with User Counts and Security Context
CREATE OR REPLACE VIEW secure_departments_view AS
SELECT 
  d.id,
  d.name,
  d.display_name,
  d.description,
  d.department_code,
  d.is_active,
  d.created_at,
  d.updated_at,
  (
    SELECT COUNT(DISTINCT u.id)
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
    JOIN roles r ON ur.role_id = r.id
    WHERE r.department_id = d.id 
      AND u.deleted_at IS NULL
      AND u.status = 'approved'
  ) as user_count,
  (
    SELECT COUNT(*)
    FROM roles r
    WHERE r.department_id = d.id AND r.is_active = true
  ) as role_count,
  (
    SELECT json_agg(
      json_build_object(
        'id', m.id,
        'name', m.name,
        'display_name', m.display_name
      )
    )
    FROM modules m
    JOIN department_modules dm ON m.id = dm.module_id
    WHERE dm.department_id = d.id 
      AND dm.is_active = true 
      AND m.is_active = true
  ) as modules
FROM departments d
WHERE d.is_active = true
  AND (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.departments', d.id, 'read')
  );

-- Role View with Permission Details and Security Context
CREATE OR REPLACE VIEW secure_roles_view AS
SELECT 
  r.id,
  r.name,
  r.display_name,
  r.description,
  r.department_id,
  r.role_type,
  r.role_level,
  r.is_active,
  r.is_default,
  r.created_at,
  r.updated_at,
  d.name as department_name,
  d.display_name as department_display_name,
  (
    SELECT COUNT(*)
    FROM user_roles ur
    WHERE ur.role_id = r.id AND ur.is_active = true
  ) as user_count,
  (
    SELECT json_agg(
      json_build_object(
        'feature_id', rp.feature_id,
        'feature_name', f.name,
        'permissions', rp.permissions,
        'data_scope', rp.data_scope,
        'can_approve', rp.can_approve,
        'can_export', rp.can_export,
        'can_bulk_action', rp.can_bulk_action
      )
    )
    FROM role_permissions rp
    JOIN features f ON rp.feature_id = f.id
    WHERE rp.role_id = r.id
  ) as permissions
FROM roles r
LEFT JOIN departments d ON r.department_id = d.id
WHERE r.is_active = true
  AND (
    current_user_is_superuser() OR
    check_data_access(current_app_user_id(), 'user_management.roles', r.id, 'read')
  );

-- Audit View with Security Context
CREATE OR REPLACE VIEW secure_audit_view AS
SELECT 
  al.id,
  al.user_id,
  al.action,
  al.resource_type,
  al.resource_id,
  al.success,
  al.description,
  al.duration_ms,
  al.ip_address,
  al.created_at,
  u.email as user_email,
  u.first_name,
  u.last_name,
  CASE 
    WHEN al.user_id = current_app_user_id() THEN 'own'
    WHEN ur.role_id IN (
      SELECT ur2.role_id 
      FROM user_roles ur2 
      JOIN roles r2 ON ur2.role_id = r2.id
      WHERE ur2.user_id = current_app_user_id() 
        AND ur2.is_active = true
        AND r2.department_id = r.department_id
    ) THEN 'department'
    ELSE 'restricted'
  END as access_level
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
LEFT JOIN roles r ON ur.role_id = r.id
WHERE (
  current_user_is_superuser() OR
  al.user_id = current_app_user_id() OR
  (
    -- Department managers can see department audit logs
    current_app_user_id() IN (
      SELECT ur2.user_id
      FROM user_roles ur2
      JOIN roles r2 ON ur2.role_id = r2.id
      WHERE r2.role_level <= 2 -- Department head level or higher
        AND r2.department_id = r.department_id
        AND ur2.is_active = true
    )
  )
);

-- Create indexes for RLS performance
CREATE INDEX IF NOT EXISTS idx_users_rls_security ON users(id, deleted_at, created_by);
CREATE INDEX IF NOT EXISTS idx_departments_rls_security ON departments(id, is_active, created_by);
CREATE INDEX IF NOT EXISTS idx_roles_rls_security ON roles(id, is_active, department_id, created_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_rls_security ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, role_id, is_active);

-- Grant usage on views to application role (if exists)
-- Note: These grants would be adjusted based on your database user setup
-- GRANT SELECT ON secure_users_view TO erp_app_user;
-- GRANT SELECT ON secure_departments_view TO erp_app_user;
-- GRANT SELECT ON secure_roles_view TO erp_app_user;
-- GRANT SELECT ON secure_audit_view TO erp_app_user;

-- Add comments for documentation
COMMENT ON FUNCTION current_app_user_id() IS 'Get current application user ID from session variable';
COMMENT ON FUNCTION current_user_is_superuser() IS 'Check if current application user is superuser';
COMMENT ON FUNCTION current_user_department_id() IS 'Get current application user department ID';
COMMENT ON FUNCTION check_data_access(INTEGER, TEXT, INTEGER, TEXT) IS 'Check if user has data access based on permissions and scope';

COMMENT ON VIEW secure_users_view IS 'Security-aware view of users with automatic access control';
COMMENT ON VIEW secure_departments_view IS 'Security-aware view of departments with user counts and modules';
COMMENT ON VIEW secure_roles_view IS 'Security-aware view of roles with permission details';
COMMENT ON VIEW secure_audit_view IS 'Security-aware view of audit logs with access control';

-- Migration completion log
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 007 completed: Row Level Security policies and views created';
  RAISE NOTICE '✅ RLS enabled on users, departments, and roles tables';
  RAISE NOTICE '✅ Security helper functions created';
  RAISE NOTICE '✅ Data access policies implemented';
  RAISE NOTICE '✅ Security-aware views created';
  RAISE NOTICE '✅ Performance indexes added';
END $$;
