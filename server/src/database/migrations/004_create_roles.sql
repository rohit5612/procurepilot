-- Migration: Create roles and permissions tables
-- Description: Role-based access control system with templates and custom roles

BEGIN;

-- Create role types enum
CREATE TYPE role_type AS ENUM ('template', 'custom');

-- Create roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Role configuration
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    role_type role_type DEFAULT 'template',
    role_level INTEGER CHECK (role_level BETWEEN 1 AND 5), -- 1=superuser, 2=dept_head, 5=view_only
    
    -- Role status
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Template role configuration
    is_default BOOLEAN DEFAULT FALSE, -- Default role for new users in department
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    
    UNIQUE(name, department_id)
);

-- Create role_permissions table
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    feature_id INTEGER REFERENCES features(id) ON DELETE CASCADE,
    
    -- Permission configuration
    permissions JSONB DEFAULT '[]'::jsonb, -- ['create', 'read', 'update'] subset of feature.available_permissions
    data_scope VARCHAR(50) DEFAULT 'department', -- 'own', 'department', 'all'
    
    -- Permission constraints
    can_approve BOOLEAN DEFAULT FALSE, -- Special approval permission
    can_export BOOLEAN DEFAULT FALSE, -- Export permission
    can_bulk_action BOOLEAN DEFAULT FALSE, -- Bulk operations permission
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(role_id, feature_id)
);

-- Create user_roles table (user role assignment)
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    
    -- Assignment configuration
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Temporary assignment support
    expires_at TIMESTAMP NULL, -- NULL = permanent, otherwise temporary
    
    -- Audit fields
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id),
    
    UNIQUE(user_id) -- One role per user (can be changed to support multiple roles if needed)
);

-- Create indexes for performance
CREATE INDEX idx_roles_department ON roles(department_id);
CREATE INDEX idx_roles_type ON roles(role_type);
CREATE INDEX idx_roles_level ON roles(role_level);
CREATE INDEX idx_roles_is_active ON roles(is_active);
CREATE INDEX idx_roles_is_default ON roles(is_default);

CREATE INDEX idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_feature ON role_permissions(feature_id);
CREATE INDEX idx_role_permissions_scope ON role_permissions(data_scope);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_active ON user_roles(is_active);
CREATE INDEX idx_user_roles_expires ON user_roles(expires_at);

-- Create triggers for automatic updated_at updates
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_role_permissions_updated_at 
    BEFORE UPDATE ON role_permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at 
    BEFORE UPDATE ON user_roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE roles ADD CONSTRAINT roles_name_check 
    CHECK (LENGTH(TRIM(name)) > 0);

ALTER TABLE roles ADD CONSTRAINT roles_display_name_check 
    CHECK (LENGTH(TRIM(display_name)) > 0);

-- Template roles must have role_level
ALTER TABLE roles ADD CONSTRAINT roles_template_level_check 
    CHECK (role_type = 'custom' OR (role_type = 'template' AND role_level IS NOT NULL));

-- Superuser role constraints
ALTER TABLE roles ADD CONSTRAINT roles_superuser_check 
    CHECK (role_level != 1 OR (role_level = 1 AND department_id IS NULL));

-- Validate JSONB structure for permissions
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_format 
    CHECK (jsonb_typeof(permissions) = 'array');

-- Data scope validation
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_scope_check 
    CHECK (data_scope IN ('own', 'department', 'all'));

-- Temporary assignment validation
ALTER TABLE user_roles ADD CONSTRAINT user_roles_expires_check 
    CHECK (expires_at IS NULL OR expires_at > assigned_at);

COMMIT;
