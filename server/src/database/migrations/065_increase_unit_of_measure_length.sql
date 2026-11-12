-- Migration: Increase unit_of_measure field length
-- Description: Some unit descriptions are longer than 20 characters

BEGIN;

-- Increase unit_of_measure length in items table
ALTER TABLE items ALTER COLUMN unit_of_measure TYPE VARCHAR(50);

-- Also update related tables
ALTER TABLE requisition_lines ALTER COLUMN unit_of_measure TYPE VARCHAR(50);
ALTER TABLE po_lines ALTER COLUMN unit_of_measure TYPE VARCHAR(50);
ALTER TABLE grn_lines ALTER COLUMN unit_of_measure TYPE VARCHAR(50);

COMMIT;

