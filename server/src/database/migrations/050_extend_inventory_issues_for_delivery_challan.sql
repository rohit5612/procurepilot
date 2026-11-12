BEGIN;

-- Extend inventory_issues for Delivery Challan data capture
ALTER TABLE IF EXISTS inventory_issues 
  ADD COLUMN IF NOT EXISTS challan_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS challan_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS destination_type VARCHAR(20), -- PROJECT|SITE|VENDOR|TECHNICIAN
  ADD COLUMN IF NOT EXISTS destination_id INTEGER,
  ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id),
  ADD COLUMN IF NOT EXISTS vendor_id INTEGER REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS technician_id INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS site_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS cluster_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS material_request_type VARCHAR(50) DEFAULT 'Internal Transfer',
  ADD COLUMN IF NOT EXISTS destination_address TEXT,
  ADD COLUMN IF NOT EXISTS eway_bill_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS eway_bill_date DATE,
  ADD COLUMN IF NOT EXISTS origin_gst_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS destination_gst_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS warehouse_address TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT 'THESE ITEMS ARE NOT FOR SALE. STOCK TRANSFER FROM STORE TO SITE OR SITE TO STORE',
  ADD COLUMN IF NOT EXISTS requested_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS issued_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP;

-- Extend issue lines to store challan-line attributes
ALTER TABLE IF EXISTS inventory_issue_lines 
  ADD COLUMN IF NOT EXISTS company_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS item_description TEXT,
  ADD COLUMN IF NOT EXISTS requested_qty DECIMAL(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_qty DECIMAL(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS issued_qty DECIMAL(15,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT false;

-- Sequence-style challan number generator: DC/VR/JP/YY-YY/NNN
CREATE OR REPLACE FUNCTION generate_challan_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  y1 TEXT;
  y2 TEXT;
BEGIN
  y1 := TO_CHAR(CURRENT_DATE, 'YY');
  y2 := TO_CHAR((CURRENT_DATE + INTERVAL '1 year'), 'YY');
  SELECT COALESCE(MAX(CAST(split_part(challan_number, '/', 5) AS INTEGER)), 0) + 1
    INTO next_number
  FROM inventory_issues
  WHERE challan_number LIKE 'DC/VR/JP/' || y1 || '-' || y2 || '/%';
  RETURN 'DC/VR/JP/' || y1 || '-' || y2 || '/' || LPAD(next_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

COMMIT;


