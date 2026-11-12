-- Drop existing email constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_check;

-- Add new email constraint that allows deleted_ prefix
ALTER TABLE users
ADD CONSTRAINT users_email_check
CHECK (
  (deleted_at IS NULL AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') OR
  (deleted_at IS NOT NULL AND email LIKE 'deleted_%')
);
