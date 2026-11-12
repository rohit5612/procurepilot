-- Migration: Create modules and features tables
-- Description: Module registry system for scalable ERP architecture

BEGIN;

-- Create modules table
CREATE TABLE modules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- 'procurement', 'inventory', 'user_management'
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    version VARCHAR(20) DEFAULT '1.0.0',
    
    -- Module configuration
    is_active BOOLEAN DEFAULT TRUE,
    is_core BOOLEAN DEFAULT FALSE, -- Core modules cannot be disabled
    module_order INTEGER DEFAULT 0, -- For UI ordering
    
    -- Module metadata
    icon VARCHAR(100), -- Icon name/path for UI
    color VARCHAR(50), -- Theme color for UI
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create features table (sub-components within modules)
CREATE TABLE features (
    id SERIAL PRIMARY KEY,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'purchase_orders', 'suppliers', 'items'
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Feature configuration
    is_active BOOLEAN DEFAULT TRUE,
    feature_order INTEGER DEFAULT 0, -- For UI ordering within module
    
    -- Permission and scope definitions
    available_permissions JSONB DEFAULT '["create", "read", "update", "delete"]'::jsonb,
    available_data_scopes JSONB DEFAULT '["own", "department", "all"]'::jsonb,
    default_permissions JSONB DEFAULT '["read"]'::jsonb,
    default_data_scope VARCHAR(50) DEFAULT 'department',
    
    -- Feature metadata
    icon VARCHAR(100), -- Icon for UI
    route_path VARCHAR(200), -- Frontend route path
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(module_id, name)
);

-- Create department_modules mapping table
CREATE TABLE department_modules (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    module_id INTEGER REFERENCES modules(id) ON DELETE CASCADE,
    
    -- Access configuration
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Audit fields
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    
    UNIQUE(department_id, module_id)
);

-- Create indexes for performance
CREATE INDEX idx_modules_name ON modules(name);
CREATE INDEX idx_modules_is_active ON modules(is_active);
CREATE INDEX idx_modules_is_core ON modules(is_core);
CREATE INDEX idx_modules_order ON modules(module_order);

CREATE INDEX idx_features_module_id ON features(module_id);
CREATE INDEX idx_features_name ON features(name);
CREATE INDEX idx_features_is_active ON features(is_active);
CREATE INDEX idx_features_order ON features(feature_order);

CREATE INDEX idx_department_modules_dept ON department_modules(department_id);
CREATE INDEX idx_department_modules_module ON department_modules(module_id);
CREATE INDEX idx_department_modules_active ON department_modules(is_active);

-- Create triggers for automatic updated_at updates
CREATE TRIGGER update_modules_updated_at 
    BEFORE UPDATE ON modules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_features_updated_at 
    BEFORE UPDATE ON features 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE modules ADD CONSTRAINT modules_name_check 
    CHECK (LENGTH(TRIM(name)) > 0 AND name ~ '^[a-z_]+$');

ALTER TABLE modules ADD CONSTRAINT modules_display_name_check 
    CHECK (LENGTH(TRIM(display_name)) > 0);

ALTER TABLE features ADD CONSTRAINT features_name_check 
    CHECK (LENGTH(TRIM(name)) > 0 AND name ~ '^[a-z_]+$');

ALTER TABLE features ADD CONSTRAINT features_display_name_check 
    CHECK (LENGTH(TRIM(display_name)) > 0);

-- Validate JSONB structure for permissions
ALTER TABLE features ADD CONSTRAINT features_permissions_format 
    CHECK (jsonb_typeof(available_permissions) = 'array');

ALTER TABLE features ADD CONSTRAINT features_data_scopes_format 
    CHECK (jsonb_typeof(available_data_scopes) = 'array');

ALTER TABLE features ADD CONSTRAINT features_default_permissions_format 
    CHECK (jsonb_typeof(default_permissions) = 'array');

COMMIT;
