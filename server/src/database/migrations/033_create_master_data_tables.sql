-- Migration: Create master data tables
-- Description: Phase 1 - Masters - Items, Suppliers, Warehouses/Bins

BEGIN;

-- Create item_categories table
CREATE TABLE IF NOT EXISTS item_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES item_categories(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create items table
CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES item_categories(id) ON DELETE RESTRICT,
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'PCS',
    item_type VARCHAR(20) NOT NULL DEFAULT 'STOCK' CHECK (item_type IN ('STOCK', 'NON_STOCK', 'SERVICE')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    min_stock_level DECIMAL(15,2) DEFAULT 0,
    max_stock_level DECIMAL(15,2),
    reorder_point DECIMAL(15,2) DEFAULT 0,
    standard_cost DECIMAL(15,4) DEFAULT 0,
    last_purchase_price DECIMAL(15,4) DEFAULT 0,
    supplier_id INTEGER, -- Will reference suppliers table
    lead_time_days INTEGER DEFAULT 0,
    shelf_life_days INTEGER,
    weight_kg DECIMAL(10,3),
    dimensions_cm JSONB, -- {length, width, height}
    specifications JSONB,
    attachments JSONB, -- URLs to item images/documents
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    supplier_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    legal_name VARCHAR(200),
    tax_id VARCHAR(50),
    registration_number VARCHAR(50),
    supplier_type VARCHAR(20) NOT NULL DEFAULT 'VENDOR' CHECK (supplier_type IN ('VENDOR', 'MANUFACTURER', 'DISTRIBUTOR', 'SERVICE_PROVIDER')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PENDING_APPROVAL')),
    contact_person VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    website VARCHAR(200),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    payment_terms INTEGER DEFAULT 30, -- days
    credit_limit DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'INR',
    bank_details JSONB,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    attachments JSONB, -- URLs to supplier documents
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create supplier_contacts table
CREATE TABLE IF NOT EXISTS supplier_contacts (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    mobile VARCHAR(20),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create warehouses table
CREATE TABLE IF NOT EXISTS warehouses (
    id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    warehouse_type VARCHAR(20) NOT NULL DEFAULT 'STORAGE' CHECK (warehouse_type IN ('STORAGE', 'PRODUCTION', 'TRANSIT', 'COLD_STORAGE', 'HAZARDOUS')),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'MAINTENANCE')),
    address_line1 VARCHAR(200),
    address_line2 VARCHAR(200),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    capacity_sqm DECIMAL(10,2),
    temperature_range JSONB, -- {min, max} for cold storage
    operating_hours JSONB,
    is_automated BOOLEAN DEFAULT false,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create warehouse_zones table
CREATE TABLE IF NOT EXISTS warehouse_zones (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    zone_code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    zone_type VARCHAR(20) NOT NULL DEFAULT 'STORAGE' CHECK (zone_type IN ('STORAGE', 'PICKING', 'RECEIVING', 'SHIPPING', 'QUARANTINE', 'DAMAGED')),
    temperature_controlled BOOLEAN DEFAULT false,
    hazardous_materials BOOLEAN DEFAULT false,
    capacity_sqm DECIMAL(10,2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, zone_code)
);

-- Create warehouse_bins table
CREATE TABLE IF NOT EXISTS warehouse_bins (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    zone_id INTEGER REFERENCES warehouse_zones(id) ON DELETE CASCADE,
    bin_code VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    description TEXT,
    bin_type VARCHAR(20) NOT NULL DEFAULT 'STORAGE' CHECK (bin_type IN ('STORAGE', 'PICKING', 'RECEIVING', 'SHIPPING', 'QUARANTINE')),
    location_type VARCHAR(20) NOT NULL DEFAULT 'FLOOR' CHECK (location_type IN ('FLOOR', 'RACK', 'SHELF', 'PALLET', 'BULK')),
    dimensions JSONB, -- {length, width, height, weight_capacity}
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_occupied BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(warehouse_id, bin_code)
);

-- Create price_lists table
CREATE TABLE IF NOT EXISTS price_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create item_prices table
CREATE TABLE IF NOT EXISTS item_prices (
    id SERIAL PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    price_type VARCHAR(20) NOT NULL DEFAULT 'PURCHASE' CHECK (price_type IN ('PURCHASE', 'SALE', 'TRANSFER')),
    unit_price DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    min_quantity DECIMAL(15,2) DEFAULT 1,
    max_quantity DECIMAL(15,2),
    valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(price_list_id, item_id, supplier_id, price_type, min_quantity)
);

-- Add foreign key constraint for items.supplier_id
ALTER TABLE items ADD CONSTRAINT fk_items_supplier 
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_supplier ON items(supplier_id);
CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);
CREATE INDEX IF NOT EXISTS idx_items_code ON items(item_code);

CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(supplier_type);
CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(supplier_code);

CREATE INDEX IF NOT EXISTS idx_supplier_contacts_supplier ON supplier_contacts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_contacts_primary ON supplier_contacts(supplier_id, is_primary);

CREATE INDEX IF NOT EXISTS idx_warehouses_status ON warehouses(status);
CREATE INDEX IF NOT EXISTS idx_warehouses_type ON warehouses(warehouse_type);
CREATE INDEX IF NOT EXISTS idx_warehouses_code ON warehouses(warehouse_code);

CREATE INDEX IF NOT EXISTS idx_warehouse_zones_warehouse ON warehouse_zones(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_zones_active ON warehouse_zones(is_active);

CREATE INDEX IF NOT EXISTS idx_warehouse_bins_warehouse ON warehouse_bins(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_bins_zone ON warehouse_bins(zone_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_bins_active ON warehouse_bins(is_active);
CREATE INDEX IF NOT EXISTS idx_warehouse_bins_occupied ON warehouse_bins(is_occupied);

CREATE INDEX IF NOT EXISTS idx_item_prices_price_list ON item_prices(price_list_id);
CREATE INDEX IF NOT EXISTS idx_item_prices_item ON item_prices(item_id);
CREATE INDEX IF NOT EXISTS idx_item_prices_supplier ON item_prices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_item_prices_active ON item_prices(is_active);

-- Create functions for data integrity
CREATE OR REPLACE FUNCTION update_item_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_supplier_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_warehouse_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER trigger_items_updated_at
    BEFORE UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION update_item_updated_at();

CREATE TRIGGER trigger_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_supplier_updated_at();

CREATE TRIGGER trigger_warehouses_updated_at
    BEFORE UPDATE ON warehouses
    FOR EACH ROW
    EXECUTE FUNCTION update_warehouse_updated_at();

COMMIT;
