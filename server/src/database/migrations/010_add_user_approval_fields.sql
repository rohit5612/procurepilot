-- Migration: Add user approval fields and update registration schema
-- Description: Add approval tracking fields and update name fields

BEGIN;

-- Add approval-related fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create indexes for approval fields
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_approved_by ON users(approved_by);
CREATE INDEX IF NOT EXISTS idx_users_approved_at ON users(approved_at);

-- Update existing users to have approved status if they are superusers or have verified email
UPDATE users 
SET approval_status = 'approved', 
    approved_at = created_at,
    approved_by = id
WHERE is_superuser = TRUE OR email_verified = TRUE;

-- Update existing users to have pending status if not already approved
UPDATE users 
SET approval_status = 'pending'
WHERE approval_status IS NULL;

-- Make approval_status NOT NULL after updating existing records
ALTER TABLE users ALTER COLUMN approval_status SET NOT NULL;

COMMIT;
