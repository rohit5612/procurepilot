-- Migration: Update role_level constraint to support superadmin
-- Description: Allow role_level 0 for superadmin roles (no department)

BEGIN;

-- Drop the existing constraint
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_role_level_check;

-- Add new constraint that allows level 0 for superadmin
ALTER TABLE roles ADD CONSTRAINT roles_role_level_check 
    CHECK (role_level BETWEEN 0 AND 5);

-- Update the comment to reflect the new levels
COMMENT ON COLUMN roles.role_level IS '0=superadmin, 1=admin, 2=dept_head, 3=manager, 4=senior_user, 5=basic_user';

COMMIT;
