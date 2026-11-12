-- Fix generate_transfer_number() ambiguity by qualifying column and renaming variable
BEGIN;

CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS VARCHAR(50) AS $$
DECLARE
  next_number INTEGER;
  new_transfer_number VARCHAR(50);
BEGIN
  SELECT COALESCE(MAX(CAST(split_part(it.transfer_number, '-', 3) AS INTEGER)), 0) + 1
  INTO next_number
  FROM inventory_transfers it
  WHERE it.transfer_number LIKE 'TR-%';

  new_transfer_number := 'TR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || LPAD(next_number::TEXT, 4, '0');
  RETURN new_transfer_number;
END;
$$ LANGUAGE plpgsql;

COMMIT;


