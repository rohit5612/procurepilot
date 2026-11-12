import { query } from '../../database/connection.js';

/**
 * Lightweight helper for writing audit log entries.
 *
 * This avoids relying on DB functions (like insert_audit_log) so that
 * application code stays resilient even if those functions are missing
 * or changed in the database.
 *
 * NOTE: For safety with enum-based action columns, callers should pass
 * values that are part of the expected audit_action set, e.g.:
 * - 'login', 'logout', 'login_failed'
 * - 'user_created', 'user_updated', 'user_deleted', 'user_approved', 'user_suspended'
 * - 'role_created', 'role_updated', 'role_deleted', 'role_assigned', 'role_revoked'
 * - 'department_created', 'department_updated', 'department_deleted'
 * - 'module_assigned', 'module_revoked'
 * - 'permission_granted', 'permission_revoked'
 * - 'data_accessed', 'data_created', 'data_updated', 'data_deleted', 'data_exported'
 * - 'system_settings_changed'
 * - 'password_reset_requested', 'password_reset_completed'
 * - 'email_verification_sent', 'email_verified'
 */
export async function writeAuditLog({
  userId,
  sessionId,
  action,
  resourceType,
  resourceId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
  requestMethod,
  requestPath,
  requestQuery,
  description,
  success = true,
  errorMessage = null,
  metadata
}) {
  // Temporarily disable audit logging (no-op)
  return;

  /* Original implementation retained for future re‑enable:
  try {
    await query(
      `
      INSERT INTO audit_logs (
        user_id,
        session_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        ip_address,
        user_agent,
        request_method,
        request_path,
        request_query,
        success,
        error_message,
        description,
        metadata,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7,
        $8, $9,
        $10, $11, $12,
        $13, $14,
        $15, $16,
        NOW()
      )
    `,
      [
        userId ?? null,
        sessionId ?? null,
        action,
        resourceType ?? null,
        resourceId ?? null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress ?? null,
        userAgent ?? null,
        requestMethod ?? null,
        requestPath ?? null,
        requestQuery ? JSON.stringify(requestQuery) : null,
        typeof success === 'boolean' ? success : true,
        errorMessage ?? null,
        description ?? null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
  } catch (error) {
    // Never break the main flow because of audit log failures
    console.warn('Audit log write failed:', error.message);
  }
  */
}

export default {
  writeAuditLog
};


