-- Migration: Change project_number to VARCHAR in requisitions table
-- This allows project numbers to contain alphanumeric codes

ALTER TABLE requisitions
ALTER COLUMN project_id TYPE VARCHAR(100);

-- Update any NULL values if needed (optional, project_id is already optional)
COMMENT ON COLUMN requisitions.project_id IS 'Optional project number/code (alphanumeric)';

