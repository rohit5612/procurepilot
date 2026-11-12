-- Migration: Fix user schema for Phase 3
-- Description: Add missing enum values and ensure proper user_roles table structure

BEGIN;

-- 1. Add 'active' and other missing statuses to user_status enum
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'active';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'rejected';

-- 2. Add missing columns to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS profile_metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS registration_notes TEXT,
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approval_notes TEXT,
ADD COLUMN IF NOT EXISTS rejection_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
ADD COLUMN IF NOT EXISTS deactivated_by_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 3. Update existing email_verified logic
UPDATE users SET email_verified_at = NOW() WHERE email_verified = true AND email_verified_at IS NULL;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_email_verified_at ON users(email_verified_at);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_approval_date ON users(approval_date);

-- 5. Ensure user_roles table has all necessary columns
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id),
ADD COLUMN IF NOT EXISTS assignment_notes TEXT,
ADD COLUMN IF NOT EXISTS transfer_from_assignment_id INTEGER REFERENCES user_roles(id),
ADD COLUMN IF NOT EXISTS transfer_reason TEXT,
ADD COLUMN IF NOT EXISTS unassignment_reason TEXT,
ADD COLUMN IF NOT EXISTS unassignment_notes TEXT,
ADD COLUMN IF NOT EXISTS unassigned_by_user_id INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS unassigned_at TIMESTAMP;

-- Update the unique constraint to allow multiple historical assignments per user
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_roles_active_user ON user_roles(user_id) WHERE is_active = true;

-- 6. Create additional indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_is_active ON user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_at ON user_roles(assigned_at);
CREATE INDEX IF NOT EXISTS idx_user_roles_department ON user_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_department ON user_roles(user_id, department_id) WHERE is_active = true;

-- 7. Update superuser status if needed
UPDATE users SET status = 'active' WHERE is_superuser = true AND status = 'pending';

COMMIT;
