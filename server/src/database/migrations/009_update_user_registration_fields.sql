-- Migration: Update user registration fields for enhanced registration
-- Description: Add required fields for new registration process

BEGIN;

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS full_name VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(15),
ADD COLUMN IF NOT EXISTS aadhar_card VARCHAR(12),
ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS captcha_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS captcha_verified BOOLEAN DEFAULT FALSE;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_mobile_number ON users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_aadhar_card ON users(aadhar_card);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_date_of_birth ON users(date_of_birth);

-- Add constraints
ALTER TABLE users ADD CONSTRAINT users_username_check 
    CHECK (username IS NULL OR (LENGTH(TRIM(username)) >= 3 AND LENGTH(TRIM(username)) <= 50));

ALTER TABLE users ADD CONSTRAINT users_mobile_number_check 
    CHECK (mobile_number IS NULL OR mobile_number ~* '^[+]?[1-9][\d\s\-()]{7,20}$');

ALTER TABLE users ADD CONSTRAINT users_aadhar_card_check 
    CHECK (aadhar_card IS NULL OR aadhar_card ~* '^[0-9]{12}$');

ALTER TABLE users ADD CONSTRAINT users_date_of_birth_check 
    CHECK (date_of_birth IS NULL OR date_of_birth <= CURRENT_DATE);

-- Update existing users to have full_name if not set
UPDATE users SET full_name = CONCAT(first_name, ' ', last_name) 
WHERE full_name = '' OR full_name IS NULL;

-- Make full_name NOT NULL after updating existing records
ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;

COMMIT;
