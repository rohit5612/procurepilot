-- Migration: Create Requisition Tables
-- Description: Phase 2 - Requisition (PR) system implementation
-- Date: 2025-01-27

BEGIN;

-- Create requisition status enum
CREATE TYPE requisition_status AS ENUM (
    'draft',
    'submitted',
    'pending_approval',
    'approved',
    'rejected',
    'cancelled'
);

-- Create requisitions table
CREATE TABLE requisitions (
    id SERIAL PRIMARY KEY,
    
    -- Basic requisition info
    requisition_number VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Requester information
    requester_id INTEGER NOT NULL REFERENCES users(id),
    department_id INTEGER NOT NULL REFERENCES departments(id),
    
    -- Optional fields
    project_id INTEGER, -- For future project module integration
    site_id INTEGER REFERENCES sites(id),
    
    -- Dates
    needed_by_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Status and workflow
    status requisition_status DEFAULT 'draft',
    workflow_instance_id INTEGER, -- Reference to workflow system
    
    -- Approval information
    submitted_at TIMESTAMP,
    submitted_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    rejected_at TIMESTAMP,
    rejected_by INTEGER REFERENCES users(id),
    rejection_reason TEXT,
    
    -- Total calculations
    total_amount DECIMAL(15,2) DEFAULT 0,
    total_quantity INTEGER DEFAULT 0,
    
    -- Audit fields
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Create requisition_lines table
CREATE TABLE requisition_lines (
    id SERIAL PRIMARY KEY,
    requisition_id INTEGER NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
    
    -- Line item information
    line_number INTEGER NOT NULL,
    item_id INTEGER REFERENCES items(id), -- Can be NULL for free-text items
    item_code VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    
    -- Quantity and pricing
    quantity DECIMAL(15,3) NOT NULL,
    unit_of_measure VARCHAR(20) DEFAULT 'PCS',
    unit_price DECIMAL(15,2) DEFAULT 0,
    total_price DECIMAL(15,2) DEFAULT 0,
    
    -- Specifications
    specifications TEXT,
    brand VARCHAR(100),
    model VARCHAR(100),
    
    -- Dates
    needed_by_date DATE,
    
    -- Status
    is_approved BOOLEAN DEFAULT FALSE,
    approved_quantity DECIMAL(15,3),
    approved_unit_price DECIMAL(15,2),
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure line numbers are unique within a requisition
    UNIQUE(requisition_id, line_number)
);

-- Create indexes for performance
CREATE INDEX idx_requisitions_requester_id ON requisitions(requester_id);
CREATE INDEX idx_requisitions_department_id ON requisitions(department_id);
CREATE INDEX idx_requisitions_status ON requisitions(status);
CREATE INDEX idx_requisitions_created_at ON requisitions(created_at);
CREATE INDEX idx_requisitions_workflow_instance_id ON requisitions(workflow_instance_id);
CREATE INDEX idx_requisitions_requisition_number ON requisitions(requisition_number);

CREATE INDEX idx_requisition_lines_requisition_id ON requisition_lines(requisition_id);
CREATE INDEX idx_requisition_lines_item_id ON requisition_lines(item_id);
CREATE INDEX idx_requisition_lines_line_number ON requisition_lines(line_number);

-- Create triggers for automatic updated_at updates
CREATE TRIGGER update_requisitions_updated_at 
    BEFORE UPDATE ON requisitions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requisition_lines_updated_at 
    BEFORE UPDATE ON requisition_lines 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to generate requisition number
CREATE OR REPLACE FUNCTION generate_requisition_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    next_number INTEGER;
    requisition_number VARCHAR(50);
BEGIN
    -- Get the next number
    SELECT COALESCE(MAX(CAST(SUBSTRING(requisition_number FROM 4) AS INTEGER)), 0) + 1
    INTO next_number
    FROM requisitions
    WHERE requisition_number LIKE 'PR-%';
    
    -- Format: PR-YYYYMMDD-XXXX
    requisition_number := 'PR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 4, '0');
    
    RETURN requisition_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate requisition totals
CREATE OR REPLACE FUNCTION calculate_requisition_totals(requisition_id_param INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE requisitions 
    SET 
        total_amount = (
            SELECT COALESCE(SUM(total_price), 0)
            FROM requisition_lines 
            WHERE requisition_id = requisition_id_param
        ),
        total_quantity = (
            SELECT COALESCE(SUM(quantity), 0)
            FROM requisition_lines 
            WHERE requisition_id = requisition_id_param
        )
    WHERE id = requisition_id_param;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update totals when lines change
CREATE OR REPLACE FUNCTION update_requisition_totals_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_requisition_totals(OLD.requisition_id);
        RETURN OLD;
    ELSE
        PERFORM calculate_requisition_totals(NEW.requisition_id);
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_requisition_totals
    AFTER INSERT OR UPDATE OR DELETE ON requisition_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_requisition_totals_trigger();

-- Add comments for documentation
COMMENT ON TABLE requisitions IS 'Purchase requisitions for procurement workflow';
COMMENT ON TABLE requisition_lines IS 'Individual line items within requisitions';
COMMENT ON COLUMN requisitions.workflow_instance_id IS 'Reference to workflow system for approval process';
COMMENT ON COLUMN requisition_lines.item_id IS 'Reference to item master, NULL for free-text items';

COMMIT;

