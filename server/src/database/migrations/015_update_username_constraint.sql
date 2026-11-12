-- Drop existing username constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_check;

-- Add new username constraint that allows deleted_ prefix
ALTER TABLE users
ADD CONSTRAINT users_username_check
CHECK (
  (deleted_at IS NULL AND username ~* '^[A-Za-z0-9._-]+$') OR
  (deleted_at IS NOT NULL AND username LIKE 'deleted_%')
);
