BEGIN;

CREATE TABLE IF NOT EXISTS inventory_issues (
  id SERIAL PRIMARY KEY,
  issue_number VARCHAR(50) UNIQUE NOT NULL,
  warehouse_id INTEGER REFERENCES warehouses(id),
  bin_id INTEGER REFERENCES bins(id),
  project_id INTEGER,
  remarks TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft|posted|canceled
  posted_at TIMESTAMP,
  posted_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS inventory_issue_lines (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES inventory_issues(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  item_id INTEGER REFERENCES items(id),
  quantity DECIMAL(15,3) NOT NULL,
  unit_of_measure VARCHAR(20) DEFAULT 'PCS',
  UNIQUE(issue_id, line_number)
);

CREATE OR REPLACE FUNCTION generate_issue_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  num VARCHAR(50);
BEGIN
  SELECT COALESCE(MAX(CAST(split_part(issue_number, '-', 3) AS INTEGER)), 0) + 1
  INTO next_number FROM inventory_issues WHERE issue_number LIKE 'ISS-%';
  num := 'ISS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN num;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inventory_issues_updated_at
  BEFORE UPDATE ON inventory_issues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;



