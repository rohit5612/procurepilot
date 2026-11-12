-- Migration: Create item categories table
-- Description: Item categories table for item classification
-- Date: 2025-08-16

BEGIN;

CREATE TABLE IF NOT EXISTS item_categories (
    id SERIAL PRIMARY KEY,
    category_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_category_id INTEGER REFERENCES item_categories(id) ON DELETE CASCADE,
    category_type VARCHAR(50) DEFAULT 'PRODUCT',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create indexes
CREATE INDEX idx_item_categories_category_code ON item_categories(category_code);
CREATE INDEX idx_item_categories_parent_category_id ON item_categories(parent_category_id);
CREATE INDEX idx_item_categories_status ON item_categories(status);
CREATE INDEX idx_item_categories_category_type ON item_categories(category_type);
CREATE INDEX idx_item_categories_sort_order ON item_categories(sort_order);

-- Add audit trigger
CREATE TRIGGER item_categories_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON item_categories
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Insert default categories
INSERT INTO item_categories (category_code, name, description, category_type, status, sort_order, is_default) VALUES
('RAW-MAT', 'Raw Materials', 'Raw materials and components', 'PRODUCT', 'ACTIVE', 1, true),
('FINISHED', 'Finished Goods', 'Finished products ready for sale', 'PRODUCT', 'ACTIVE', 2, false),
('CONSUMABLES', 'Consumables', 'Consumable supplies and materials', 'PRODUCT', 'ACTIVE', 3, false),
('EQUIPMENT', 'Equipment', 'Machinery and equipment', 'PRODUCT', 'ACTIVE', 4, false),
('SERVICES', 'Services', 'Service items and labor', 'SERVICE', 'ACTIVE', 5, false);

COMMIT;
