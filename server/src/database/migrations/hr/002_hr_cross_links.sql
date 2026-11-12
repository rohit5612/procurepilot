-- HR Cross-Link Enhancements
-- Adds relational links between departments, positions, cost centers, locations and org metadata.

BEGIN;

-- Departments: defaults for cost center and location
ALTER TABLE hr_department
  ADD COLUMN IF NOT EXISTS default_cost_center_id INTEGER REFERENCES hr_cost_center(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_location_id INTEGER REFERENCES hr_location(id) ON DELETE SET NULL;

-- Positions: tie to department, cost center, approval role/band
ALTER TABLE hr_position
  ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES hr_department(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cost_center_id INTEGER REFERENCES hr_cost_center(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_role TEXT; -- e.g., manager, reviewer, finance

-- Locations: time zone and holiday calendar reference (string key)
ALTER TABLE hr_location
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS holiday_calendar TEXT;

COMMIT;

