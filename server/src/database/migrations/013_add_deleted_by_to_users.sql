-- Add deleted_by column to users table
ALTER TABLE users
ADD COLUMN deleted_by INTEGER REFERENCES users(id);

-- Add index for better performance
CREATE INDEX idx_users_deleted_by ON users(deleted_by);
