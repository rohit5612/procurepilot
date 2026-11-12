-- Extend sites table with technician/FSE and power configuration fields
-- Non-breaking: only adds nullable columns.

BEGIN;

ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS technician_employee_code TEXT,
  ADD COLUMN IF NOT EXISTS technician_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS fse_employee_code TEXT,
  ADD COLUMN IF NOT EXISTS fse_employee_name TEXT,
  ADD COLUMN IF NOT EXISTS power_type TEXT,   -- e.g. 'DG', 'Non DG'
  ADD COLUMN IF NOT EXISTS dg_make TEXT,      -- e.g. 'Kirloskar', 'M&M', 'Eicher'
  ADD COLUMN IF NOT EXISTS dg_rating TEXT,    -- keep as text to support values like '62.5*2'
  ADD COLUMN IF NOT EXISTS solar_type TEXT;   -- e.g. 'Solar', 'Non-Solar', 'HPSC'

COMMIT;

