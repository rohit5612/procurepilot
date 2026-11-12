-- Extend inventory_transfers to work like delivery challans for internal transfers
BEGIN;

-- Add challan number and workflow support
ALTER TABLE inventory_transfers
  ADD COLUMN IF NOT EXISTS challan_number VARCHAR(50) UNIQUE,
  ADD COLUMN IF NOT EXISTS workflow_instance_id INTEGER REFERENCES workflow_instances(id) ON DELETE SET NULL;

-- Add site/location information
ALTER TABLE inventory_transfers
  ADD COLUMN IF NOT EXISTS from_site_id INTEGER REFERENCES sites(id),
  ADD COLUMN IF NOT EXISTS from_site_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS to_site_id INTEGER REFERENCES sites(id),
  ADD COLUMN IF NOT EXISTS to_site_name VARCHAR(200),
  ADD COLUMN IF NOT EXISTS from_circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS to_circle_id INTEGER REFERENCES telecom_circles(id),
  ADD COLUMN IF NOT EXISTS from_cluster_id INTEGER REFERENCES clusters(id),
  ADD COLUMN IF NOT EXISTS to_cluster_id INTEGER REFERENCES clusters(id);

-- Add address fields
ALTER TABLE inventory_transfers
  ADD COLUMN IF NOT EXISTS from_warehouse_address TEXT,
  ADD COLUMN IF NOT EXISTS to_warehouse_address TEXT;

-- Add standard note/remarks
ALTER TABLE inventory_transfers
  ADD COLUMN IF NOT EXISTS note TEXT DEFAULT 'THESE ITEMS ARE NOT FOR SALE. INTERNAL STOCK TRANSFER BETWEEN WAREHOUSES';

-- Generate challan number function for transfers
CREATE OR REPLACE FUNCTION generate_transfer_challan_number()
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
  FROM inventory_transfers
  WHERE challan_number LIKE 'TC/VR/JP/' || y1 || '-' || y2 || '/%';
  RETURN 'TC/VR/JP/' || y1 || '-' || y2 || '/' || LPAD(next_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_transfer_challan_number() IS 'Generates Transfer Challan numbers in format TC/VR/JP/YY-YY/NNN';

COMMIT;

