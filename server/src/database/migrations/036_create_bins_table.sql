-- Migration: Create bins table
-- Description: Bins table for warehouse location management
-- Date: 2025-08-16

BEGIN;

CREATE TABLE IF NOT EXISTS bins (
    id SERIAL PRIMARY KEY,
    bin_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    parent_bin_id INTEGER REFERENCES bins(id) ON DELETE CASCADE,
    bin_type VARCHAR(50) DEFAULT 'STORAGE',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    capacity_volume DECIMAL(10,2),
    capacity_weight DECIMAL(10,2),
    temperature_zone VARCHAR(50) DEFAULT 'AMBIENT',
    is_default_receiving BOOLEAN DEFAULT false,
    is_default_shipping BOOLEAN DEFAULT false,
    is_restricted BOOLEAN DEFAULT false,
    restriction_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    UNIQUE(warehouse_id, bin_code)
);

-- Create indexes
CREATE INDEX idx_bins_warehouse_id ON bins(warehouse_id);
CREATE INDEX idx_bins_parent_bin_id ON bins(parent_bin_id);
CREATE INDEX idx_bins_bin_code ON bins(bin_code);
CREATE INDEX idx_bins_status ON bins(status);
CREATE INDEX idx_bins_bin_type ON bins(bin_type);

-- Add audit trigger
CREATE TRIGGER bins_audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bins
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- Insert default bins for existing warehouses
INSERT INTO bins (bin_code, name, description, warehouse_id, bin_type, status, is_default_receiving, is_default_shipping)
SELECT 
    'DEFAULT-RCV',
    'Default Receiving',
    'Default receiving bin for ' || w.name,
    w.id,
    'RECEIVING',
    'ACTIVE',
    true,
    false
FROM warehouses w
WHERE w.is_default_receiving = true;

INSERT INTO bins (bin_code, name, description, warehouse_id, bin_type, status, is_default_receiving, is_default_shipping)
SELECT 
    'DEFAULT-SHP',
    'Default Shipping',
    'Default shipping bin for ' || w.name,
    w.id,
    'SHIPPING',
    'ACTIVE',
    false,
    true
FROM warehouses w
WHERE w.is_default_shipping = true;

COMMIT;
