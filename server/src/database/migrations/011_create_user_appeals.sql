-- Migration: Create user appeals table and related fields
-- Date: 2025-08-07
-- Description: Implements user appeal system for suspended accounts

-- Add appeal-related fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS suspended_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS suspension_notes TEXT;

-- Create user_appeals table
CREATE TABLE IF NOT EXISTS user_appeals (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appeal_reason TEXT NOT NULL,
    appeal_details TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_appeals_user_id ON user_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_appeals_status ON user_appeals(status);
CREATE INDEX IF NOT EXISTS idx_user_appeals_created_at ON user_appeals(created_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_appeals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_appeals_updated_at
    BEFORE UPDATE ON user_appeals
    FOR EACH ROW
    EXECUTE FUNCTION update_user_appeals_updated_at();

-- Add comment for documentation
COMMENT ON TABLE user_appeals IS 'Stores user appeals for suspended accounts';
COMMENT ON COLUMN user_appeals.user_id IS 'Reference to the suspended user';
COMMENT ON COLUMN user_appeals.appeal_reason IS 'Reason provided by user for appeal';
COMMENT ON COLUMN user_appeals.appeal_details IS 'Detailed explanation from user';
COMMENT ON COLUMN user_appeals.status IS 'Current status: pending, approved, rejected';
COMMENT ON COLUMN user_appeals.admin_notes IS 'Notes from admin reviewing the appeal';
COMMENT ON COLUMN user_appeals.reviewed_by IS 'Admin who reviewed the appeal';
COMMENT ON COLUMN user_appeals.reviewed_at IS 'When the appeal was reviewed';

-- Add comments to users table new columns
COMMENT ON COLUMN users.suspension_reason IS 'Reason for account suspension';
COMMENT ON COLUMN users.suspended_at IS 'When the account was suspended';
COMMENT ON COLUMN users.suspended_by IS 'Admin who suspended the account';
COMMENT ON COLUMN users.suspension_notes IS 'Additional notes about suspension';
