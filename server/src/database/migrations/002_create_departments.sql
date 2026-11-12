-- Migration: Create departments table
-- Description: Department management for organizing users and module access

BEGIN;

-- Create departments table
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Department configuration
    is_active BOOLEAN DEFAULT TRUE,
    department_code VARCHAR(20) UNIQUE, -- Optional short code (e.g., 'PROC', 'INV')
    
    -- Hierarchy support (for future use)
    parent_department_id INTEGER REFERENCES departments(id),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_departments_name ON departments(name);
CREATE INDEX idx_departments_is_active ON departments(is_active);
CREATE INDEX idx_departments_parent ON departments(parent_department_id);
CREATE INDEX idx_departments_created_at ON departments(created_at);

-- Create trigger for automatic updated_at updates
CREATE TRIGGER update_departments_updated_at 
    BEFORE UPDATE ON departments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add constraints
ALTER TABLE departments ADD CONSTRAINT departments_name_check 
    CHECK (LENGTH(TRIM(name)) > 0);

ALTER TABLE departments ADD CONSTRAINT departments_display_name_check 
    CHECK (LENGTH(TRIM(display_name)) > 0);

-- Prevent circular references in hierarchy
ALTER TABLE departments ADD CONSTRAINT departments_no_self_parent 
    CHECK (id != parent_department_id);

COMMIT;
