-- Migration: Disable audit logging completely
-- Description: Remove all audit logging functionality to eliminate 500 errors

BEGIN;

-- Drop all audit log related functions
DROP FUNCTION IF EXISTS insert_audit_log(INTEGER, audit_action, VARCHAR, INTEGER, JSONB, JSONB, INET, TEXT, VARCHAR, VARCHAR, TEXT, BOOLEAN, TEXT, JSONB);
DROP FUNCTION IF EXISTS ensure_audit_partitions();
DROP FUNCTION IF EXISTS create_audit_partition(DATE);
DROP FUNCTION IF EXISTS create_next_audit_partition();
DROP FUNCTION IF EXISTS cleanup_old_audit_partitions();

-- Drop all audit log partitions
DROP TABLE IF EXISTS audit_logs_today;
DROP TABLE IF EXISTS audit_logs_2025_08_08;
DROP TABLE IF EXISTS audit_logs_2025_08_11;

-- Drop any audit-related views first
DROP VIEW IF EXISTS audit_summary CASCADE;
DROP VIEW IF EXISTS secure_audit_view CASCADE;

-- Drop the main audit_logs table
DROP TABLE IF EXISTS audit_logs CASCADE;

-- Drop the audit_action enum
DROP TYPE IF EXISTS audit_action;

COMMIT;
