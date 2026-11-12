-- Migration: Enhance price lists for Excel import functionality
-- Description: Add import tracking and improve price list management

BEGIN;

-- Add import tracking columns to price_lists table
ALTER TABLE price_lists 
ADD COLUMN IF NOT EXISTS import_source VARCHAR(50), -- 'excel', 'manual', 'api'
ADD COLUMN IF NOT EXISTS import_filename VARCHAR(255),
ADD COLUMN IF NOT EXISTS import_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS import_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS imported_items INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_items INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS import_notes TEXT;

-- Add GST rate column to item_prices table
ALTER TABLE item_prices 
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_item_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS supplier_item_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS mrp DECIMAL(15,4) DEFAULT 0;

-- Create import_logs table for tracking import operations
CREATE TABLE IF NOT EXISTS price_list_import_logs (
    id SERIAL PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
    import_type VARCHAR(20) NOT NULL DEFAULT 'excel' CHECK (import_type IN ('excel', 'csv', 'api')),
    filename VARCHAR(255),
    total_rows INTEGER NOT NULL DEFAULT 0,
    successful_imports INTEGER NOT NULL DEFAULT 0,
    failed_imports INTEGER NOT NULL DEFAULT 0,
    skipped_imports INTEGER NOT NULL DEFAULT 0,
    import_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (import_status IN ('pending', 'processing', 'completed', 'failed')),
    error_details JSONB,
    import_metadata JSONB, -- Store original file headers, column mapping, etc.
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create import_item_logs table for detailed item-level import tracking
CREATE TABLE IF NOT EXISTS price_list_import_item_logs (
    id SERIAL PRIMARY KEY,
    import_log_id INTEGER NOT NULL REFERENCES price_list_import_logs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    item_code VARCHAR(50),
    part_number VARCHAR(50),
    item_name VARCHAR(200),
    unit_price DECIMAL(15,4),
    gst_rate DECIMAL(5,2),
    lead_time_days INTEGER,
    min_order_qty DECIMAL(15,2),
    import_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (import_status IN ('pending', 'success', 'failed', 'skipped')),
    matched_item_id INTEGER REFERENCES items(id),
    match_type VARCHAR(20), -- 'item_code', 'part_number', 'name_fuzzy', 'no_match'
    error_message TEXT,
    original_data JSONB, -- Store the original row data
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_lists_import_source ON price_lists(import_source);
CREATE INDEX IF NOT EXISTS idx_price_lists_import_date ON price_lists(import_date);
CREATE INDEX IF NOT EXISTS idx_price_lists_supplier_import ON price_lists(supplier_id, import_date);

CREATE INDEX IF NOT EXISTS idx_item_prices_gst_rate ON item_prices(gst_rate);
CREATE INDEX IF NOT EXISTS idx_item_prices_lead_time ON item_prices(lead_time_days);
CREATE INDEX IF NOT EXISTS idx_item_prices_supplier_code ON item_prices(supplier_item_code);

CREATE INDEX IF NOT EXISTS idx_import_logs_price_list ON price_list_import_logs(price_list_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_status ON price_list_import_logs(import_status);
CREATE INDEX IF NOT EXISTS idx_import_logs_date ON price_list_import_logs(started_at);

CREATE INDEX IF NOT EXISTS idx_import_item_logs_import ON price_list_import_item_logs(import_log_id);
CREATE INDEX IF NOT EXISTS idx_import_item_logs_status ON price_list_import_item_logs(import_status);
CREATE INDEX IF NOT EXISTS idx_import_item_logs_item ON price_list_import_item_logs(matched_item_id);

COMMIT;
