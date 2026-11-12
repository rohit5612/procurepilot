-- HR Org linking: designations tied to departments, positions tied to designations (and optional default location)
BEGIN;

-- Designations belong to departments (strict single parent)
ALTER TABLE hr_designation
  ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES hr_department(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_designation_department ON hr_designation(department_id);

-- Positions link to designation and optional default location
ALTER TABLE hr_position
  ADD COLUMN IF NOT EXISTS designation_id INTEGER REFERENCES hr_designation(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hr_position_designation ON hr_position(designation_id);
CREATE INDEX IF NOT EXISTS idx_hr_position_location ON hr_position(location_id);

COMMIT;




