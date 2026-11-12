BEGIN;

CREATE TABLE IF NOT EXISTS store_return_notes (
  id SERIAL PRIMARY KEY,
  srn_number VARCHAR(50) UNIQUE NOT NULL,
  reference_challan_id INTEGER REFERENCES inventory_issues(id) ON DELETE SET NULL,
  source_type VARCHAR(20), -- SITE|VENDOR|TECHNICIAN
  source_id INTEGER,
  destination_warehouse_id INTEGER REFERENCES warehouses(id),
  return_reason TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft|received|inspected|posted
  received_at TIMESTAMP,
  inspected_at TIMESTAMP,
  received_by INTEGER REFERENCES users(id),
  inspected_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS store_return_items (
  id SERIAL PRIMARY KEY,
  srn_id INTEGER REFERENCES store_return_notes(id) ON DELETE CASCADE,
  challan_line_id INTEGER REFERENCES inventory_issue_lines(id) ON DELETE SET NULL,
  item_id INTEGER REFERENCES items(id),
  quantity_returned DECIMAL(15,3) DEFAULT 0,
  quantity_accepted DECIMAL(15,3) DEFAULT 0,
  quantity_rejected DECIMAL(15,3) DEFAULT 0,
  condition VARCHAR(20), -- GOOD|DAMAGED|DEFECTIVE
  remarks TEXT
);

-- SRN number generator
CREATE OR REPLACE FUNCTION generate_srn_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(split_part(srn_number, '-', 2) AS INTEGER)), 0) + 1
    INTO next_number
  FROM store_return_notes
  WHERE srn_number LIKE 'SRN-%';
  RETURN 'SRN-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMIT;


