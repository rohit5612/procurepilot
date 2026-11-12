-- Add deleted_by column to user_roles table
ALTER TABLE user_roles
ADD COLUMN deleted_by INTEGER REFERENCES users(id);

-- Add index for better performance
CREATE INDEX idx_user_roles_deleted_by ON user_roles(deleted_by);

-- Foreign key constraint is already added by REFERENCES in the ADD COLUMN statement
