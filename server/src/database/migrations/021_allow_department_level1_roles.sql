-- Migration: Allow department-specific level 1 roles
-- Description: Remove constraint that prevents level 1 roles from having departments
-- This allows superadmins to create department-specific admin roles

BEGIN;

-- Drop the existing constraint that prevents level 1 roles from having departments
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_superuser_check;

-- Drop the constraint if it exists to avoid conflicts
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_superadmin_check;

-- Add new constraint that only prevents level 0 (superadmin) from having departments
-- Level 0 = superadmin (system-wide, no department)
-- Level 1 = admin (can be department-specific)
-- Level 2-5 = department roles (as before)
ALTER TABLE roles ADD CONSTRAINT roles_superadmin_check 
    CHECK (role_level != 0 OR (role_level = 0 AND department_id IS NULL));

-- Update the comment to reflect the new levels
COMMENT ON COLUMN roles.role_level IS '0=superadmin (no dept), 1=admin (dept-specific), 2=dept_head, 3=manager, 4=senior_user, 5=basic_user';

COMMIT;
