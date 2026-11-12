-- Drop the views first
DROP VIEW IF EXISTS secure_audit_view;
DROP VIEW IF EXISTS secure_users_view;

-- Increase email and username length limits
ALTER TABLE users
ALTER COLUMN email TYPE VARCHAR(255),
ALTER COLUMN username TYPE VARCHAR(255);

-- Recreate the audit view
CREATE VIEW secure_audit_view AS
SELECT 
  al.id,
  al.user_id,
  u.email,
  al.action,
  al.resource_type,
  al.resource_id,
  al.old_values,
  al.new_values,
  al.ip_address,
  al.user_agent,
  al.request_method,
  al.request_path,
  al.description,
  al.success,
  al.error_message,
  al.metadata,
  al.created_at
FROM audit_logs al
JOIN users u ON al.user_id = u.id;

-- Recreate the users view
CREATE VIEW secure_users_view AS
SELECT 
  u.id,
  u.email,
  u.username,
  u.first_name,
  u.last_name,
  u.full_name,
  u.mobile_number,
  u.employee_id,
  u.designation,
  u.date_of_birth,
  u.status,
  u.email_verified,
  u.last_login,
  u.login_count,
  u.created_at,
  u.updated_at,
  u.approval_status,
  u.approved_at,
  u.approved_by,
  u.approval_notes,
  u.rejection_date,
  u.rejected_by_user_id,
  u.rejection_reason,
  u.is_protected,
  u.is_superuser,
  u.suspended_at,
  u.suspended_by,
  u.suspension_reason,
  u.suspension_notes,
  u.deleted_at,
  u.deleted_by
FROM users u;
