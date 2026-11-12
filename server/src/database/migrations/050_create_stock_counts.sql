BEGIN;

-- Stock Count session tables
CREATE TABLE IF NOT EXISTS stock_counts (
  id SERIAL PRIMARY KEY,
  count_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(200),
  status VARCHAR(20) DEFAULT 'draft', -- draft|posted|canceled
  snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  posted_at TIMESTAMP,
  posted_by INTEGER REFERENCES users(id),
  remarks TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stock_count_lines (
  id SERIAL PRIMARY KEY,
  stock_count_id INTEGER NOT NULL REFERENCES stock_counts(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  bin_id INTEGER REFERENCES bins(id),
  snapshot_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
  counted_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
  variance_qty DECIMAL(15,3) NOT NULL DEFAULT 0,
  unit_of_measure VARCHAR(20) DEFAULT 'PCS',
  UNIQUE(stock_count_id, line_number)
);

CREATE OR REPLACE FUNCTION generate_stock_count_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  num VARCHAR(50);
BEGIN
  SELECT COALESCE(MAX(CAST(split_part(count_number, '-', 3) AS INTEGER)), 0) + 1
  INTO next_number FROM stock_counts WHERE count_number LIKE 'SC-%';
  num := 'SC-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN num;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_counts_updated_at
  BEFORE UPDATE ON stock_counts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_count_lines_updated_at
  BEFORE UPDATE ON stock_count_lines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;



