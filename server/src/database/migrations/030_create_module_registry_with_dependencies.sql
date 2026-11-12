-- Module Registry Foundation - With Dependencies
-- Phase 1: Core module registration and management system

BEGIN;

-- Drop dependent views first
DROP VIEW IF EXISTS secure_departments_view;

-- Drop existing tables if they exist (in correct order)
DROP TABLE IF EXISTS module_registration_logs;
DROP TABLE IF EXISTS department_modules CASCADE;
DROP TABLE IF EXISTS features;
DROP TABLE IF EXISTS modules;

-- Create modules table
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'procurement', 'inventory'
    display_name VARCHAR(200) NOT NULL, -- e.g., 'Procurement Management'
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    icon VARCHAR(50) DEFAULT 'layers', -- Material-UI icon name
    color VARCHAR(7) DEFAULT '#3b82f6', -- Hex color code
    is_core BOOLEAN DEFAULT FALSE, -- Core modules vs custom modules
    is_active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0, -- For navigation ordering
    metadata JSONB DEFAULT '{}', -- Additional module-specific data
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- Create features table
CREATE TABLE features (
    id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., 'purchase_orders', 'suppliers'
    display_name VARCHAR(200) NOT NULL, -- e.g., 'Purchase Orders', 'Supplier Management'
    description TEXT,
    route VARCHAR(200), -- Frontend route path
    available_permissions TEXT[] DEFAULT '{}', -- Array of available permissions
    available_data_scopes TEXT[] DEFAULT '{}', -- Array of available data scopes
    default_permissions TEXT[] DEFAULT '{}', -- Default permissions for role templates
    default_data_scope VARCHAR(20) DEFAULT 'department', -- Default data scope
    is_active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0, -- For feature ordering within module
    metadata JSONB DEFAULT '{}', -- Additional feature-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure unique feature names within a module
    UNIQUE(module_id, name)
);

-- Create department_modules table for module assignment to departments
CREATE TABLE department_modules (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    granted_by INTEGER REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_by INTEGER REFERENCES users(id),
    revoked_at TIMESTAMP,
    
    -- Ensure unique department-module combinations
    UNIQUE(department_id, module_id)
);

-- Create module_registration_logs table for audit trail
CREATE TABLE module_registration_logs (
    id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'register', 'update', 'activate', 'deactivate', 'rollback'
    actor_id INTEGER REFERENCES users(id),
    payload JSONB, -- Original request payload
    results JSONB, -- Results of the operation
    error_message TEXT, -- Error details if operation failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_modules_name ON modules(name);
CREATE INDEX idx_modules_is_active ON modules(is_active);
CREATE INDEX idx_modules_order ON modules(order_index);
CREATE INDEX idx_features_module_id ON features(module_id);
CREATE INDEX idx_features_name ON features(name);
CREATE INDEX idx_features_is_active ON features(is_active);
CREATE INDEX idx_department_modules_department_id ON department_modules(department_id);
CREATE INDEX idx_department_modules_module_id ON department_modules(module_id);
CREATE INDEX idx_department_modules_is_active ON department_modules(is_active);
CREATE INDEX idx_module_registration_logs_module_id ON module_registration_logs(module_id);
CREATE INDEX idx_module_registration_logs_actor_id ON module_registration_logs(actor_id);
CREATE INDEX idx_module_registration_logs_created_at ON module_registration_logs(created_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_modules_updated_at 
    BEFORE UPDATE ON modules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_features_updated_at 
    BEFORE UPDATE ON features 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to log module registration events
CREATE OR REPLACE FUNCTION log_module_registration_event(
    p_module_id INTEGER,
    p_action VARCHAR(50),
    p_actor_id INTEGER,
    p_payload JSONB DEFAULT NULL,
    p_results JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    log_id INTEGER;
BEGIN
    INSERT INTO module_registration_logs (
        module_id, action, actor_id, payload, results, error_message
    ) VALUES (
        p_module_id, p_action, p_actor_id, p_payload, p_results, p_error_message
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get module features with permissions
CREATE OR REPLACE FUNCTION get_module_features(p_module_id INTEGER)
RETURNS TABLE (
    id INTEGER,
    name VARCHAR(100),
    display_name VARCHAR(200),
    description TEXT,
    route VARCHAR(200),
    available_permissions TEXT[],
    available_data_scopes TEXT[],
    default_permissions TEXT[],
    default_data_scope VARCHAR(20),
    is_active BOOLEAN,
    order_index INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.name,
        f.display_name,
        f.description,
        f.route,
        f.available_permissions,
        f.available_data_scopes,
        f.default_permissions,
        f.default_data_scope,
        f.is_active,
        f.order_index
    FROM features f
    WHERE f.module_id = p_module_id AND f.is_active = TRUE
    ORDER BY f.order_index, f.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user's accessible modules
CREATE OR REPLACE FUNCTION get_user_modules(p_user_id INTEGER)
RETURNS TABLE (
    module_id INTEGER,
    module_name VARCHAR(100),
    module_display_name VARCHAR(200),
    module_icon VARCHAR(50),
    module_color VARCHAR(7),
    features JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id as module_id,
        m.name as module_name,
        m.display_name as module_display_name,
        m.icon as module_icon,
        m.color as module_color,
        COALESCE(
            (SELECT jsonb_agg(
                jsonb_build_object(
                    'id', f.id,
                    'name', f.name,
                    'display_name', f.display_name,
                    'route', f.route,
                    'available_permissions', f.available_permissions,
                    'available_data_scopes', f.available_data_scopes
                )
            )
            FROM features f
            WHERE f.module_id = m.id AND f.is_active = TRUE
            ORDER BY f.order_index, f.name), 
            '[]'::jsonb
        ) as features
    FROM modules m
    INNER JOIN department_modules dm ON m.id = dm.module_id
    INNER JOIN user_roles ur ON dm.department_id = ur.department_id
    WHERE ur.user_id = p_user_id 
        AND m.is_active = TRUE 
        AND dm.is_active = TRUE
        AND ur.unassigned_at IS NULL
    GROUP BY m.id, m.name, m.display_name, m.icon, m.color
    ORDER BY m.order_index, m.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate module registration
CREATE OR REPLACE FUNCTION validate_module_registration(
    p_module_name VARCHAR(100),
    p_features JSONB
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    feature_record RECORD;
    route_conflicts TEXT[];
    permission_conflicts TEXT[];
BEGIN
    result := jsonb_build_object('valid', true, 'errors', '[]'::jsonb);
    
    -- Check if module name already exists
    IF EXISTS (SELECT 1 FROM modules WHERE name = p_module_name) THEN
        result := jsonb_set(result, '{valid}', 'false');
        result := jsonb_set(result, '{errors}', 
            result->'errors' || jsonb_build_object('field', 'name', 'message', 'Module name already exists'));
    END IF;
    
    -- Check for route conflicts
    SELECT array_agg(f.route) INTO route_conflicts
    FROM features f
    WHERE f.route = ANY(
        SELECT jsonb_array_elements_text(p_features->'route')
    ) AND f.is_active = TRUE;
    
    IF route_conflicts IS NOT NULL AND array_length(route_conflicts, 1) > 0 THEN
        result := jsonb_set(result, '{valid}', 'false');
        result := jsonb_set(result, '{errors}', 
            result->'errors' || jsonb_build_object('field', 'routes', 'message', 'Route conflicts detected'));
    END IF;
    
    -- Check for permission namespace conflicts
    FOR feature_record IN 
        SELECT jsonb_array_elements(p_features) as feature
    LOOP
        -- Check if permission namespace conflicts with existing features
        SELECT array_agg(f.name) INTO permission_conflicts
        FROM features f
        WHERE f.name = feature_record.feature->>'name' AND f.is_active = TRUE;
        
        IF permission_conflicts IS NOT NULL AND array_length(permission_conflicts, 1) > 0 THEN
            result := jsonb_set(result, '{valid}', 'false');
            result := jsonb_set(result, '{errors}', 
                result->'errors' || jsonb_build_object('field', 'features', 'message', 'Feature name conflicts detected'));
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insert default core modules
INSERT INTO modules (name, display_name, description, is_core, order_index, icon, color) VALUES
('user_management', 'User Management', 'Core user and role management system', TRUE, 1, 'people', '#6366f1'),
('procurement', 'Procurement', 'Purchase order and supplier management', FALSE, 2, 'shopping_cart', '#059669'),
('inventory', 'Inventory', 'Stock and warehouse management', FALSE, 3, 'inventory_2', '#dc2626');

-- Insert default features for user_management module
INSERT INTO features (module_id, name, display_name, route, available_permissions, available_data_scopes, default_permissions, default_data_scope, order_index) VALUES
(1, 'user_directory', 'User Directory', '/user-management/directory', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 1),
(1, 'department_management', 'Department Management', '/user-management/departments', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 2),
(1, 'role_management', 'Role Management', '/user-management/roles', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 3),
(1, 'user_assignment', 'User Assignment', '/user-management/assignment', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 4),
(1, 'user_approval', 'User Approval', '/user-management/approval', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 5),
(1, 'user_appeals', 'User Appeals', '/user-management/appeals', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 6);

-- Insert default features for procurement module
INSERT INTO features (module_id, name, display_name, route, available_permissions, available_data_scopes, default_permissions, default_data_scope, order_index) VALUES
(2, 'purchase_orders', 'Purchase Orders', '/procurement/purchase-orders', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 1),
(2, 'suppliers', 'Supplier Management', '/procurement/suppliers', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 2);

-- Insert default features for inventory module
INSERT INTO features (module_id, name, display_name, route, available_permissions, available_data_scopes, default_permissions, default_data_scope, order_index) VALUES
(3, 'stock_items', 'Stock Items', '/inventory/stock-items', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 1),
(3, 'warehouses', 'Warehouse Management', '/inventory/warehouses', ARRAY['create', 'read', 'update', 'delete', 'approve', 'export', 'bulk_action'], ARRAY['own', 'department', 'all'], ARRAY['read'], 'department', 2);

-- Assign modules to all existing departments
INSERT INTO department_modules (department_id, module_id, granted_by)
SELECT d.id, m.id, 1
FROM departments d
CROSS JOIN modules m
WHERE m.is_core = TRUE OR m.name IN ('procurement', 'inventory');

-- Recreate the secure_departments_view
CREATE VIEW secure_departments_view AS
SELECT 
    d.id,
    d.name,
    d.description,
    d.created_at,
    d.updated_at,
    COUNT(DISTINCT ur.user_id) as head_count,
    COUNT(DISTINCT dm.module_id) as module_count
FROM departments d
LEFT JOIN user_roles ur ON d.id = ur.department_id AND ur.unassigned_at IS NULL
LEFT JOIN department_modules dm ON d.id = dm.department_id AND dm.is_active = TRUE
GROUP BY d.id, d.name, d.description, d.created_at, d.updated_at;

COMMIT;
