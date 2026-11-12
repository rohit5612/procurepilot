BEGIN;

-- Inventory Transfers: header and lines
CREATE TABLE IF NOT EXISTS inventory_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number VARCHAR(50) UNIQUE NOT NULL,
  from_warehouse_id INTEGER REFERENCES warehouses(id),
  from_bin_id INTEGER REFERENCES bins(id),
  to_warehouse_id INTEGER REFERENCES warehouses(id),
  to_bin_id INTEGER REFERENCES bins(id),
  status VARCHAR(20) DEFAULT 'draft', -- draft|posted|canceled
  remarks TEXT,
  posted_at TIMESTAMP,
  posted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_transfer_lines (
  id SERIAL PRIMARY KEY,
  transfer_id INTEGER NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id INTEGER REFERENCES items(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit_of_measure VARCHAR(20) DEFAULT 'PCS',
  UNIQUE(transfer_id, line_number)
);

CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  transfer_number VARCHAR(50);
BEGIN
  SELECT COALESCE(MAX(CAST(split_part(transfer_number, '-', 3) AS INTEGER)), 0) + 1
  INTO next_number FROM inventory_transfers WHERE transfer_number LIKE 'TR-%';
  transfer_number := 'TR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN transfer_number;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_transfers_updated_at
  BEFORE UPDATE ON inventory_transfers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;



