-- Migration: Create audit logs table with partitioning
-- Description: Comprehensive audit logging system with 24-hour retention

BEGIN;

-- Create audit log action types
CREATE TYPE audit_action AS ENUM (
    'login', 'logout', 'login_failed',
    'user_created', 'user_updated', 'user_deleted', 'user_approved', 'user_suspended',
    'role_created', 'role_updated', 'role_deleted', 'role_assigned', 'role_revoked',
    'department_created', 'department_updated', 'department_deleted',
    'module_assigned', 'module_revoked',
    'permission_granted', 'permission_revoked',
    'data_accessed', 'data_created', 'data_updated', 'data_deleted', 'data_exported',
    'system_settings_changed',
    'password_reset_requested', 'password_reset_completed',
    'email_verification_sent', 'email_verified'
);

-- Create main audit_logs table (will be partitioned)
CREATE TABLE audit_logs (
    id BIGSERIAL,
    
    -- User and session information
    user_id INTEGER REFERENCES users(id),
    session_id VARCHAR(255), -- For tracking user sessions
    
    -- Action details
    action audit_action NOT NULL,
    resource_type VARCHAR(100), -- 'user', 'role', 'department', 'purchase_order', etc.
    resource_id INTEGER, -- ID of the affected resource
    
    -- Change tracking
    old_values JSONB, -- Previous state of the resource
    new_values JSONB, -- New state of the resource
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_query JSONB,
    
    -- Result and metadata
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    duration_ms INTEGER, -- Request duration
    
    -- Additional context
    description TEXT, -- Human-readable description
    metadata JSONB, -- Additional structured data
    
    -- Timestamp (for partitioning)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
) PARTITION BY RANGE (created_at);

-- Create index on the partitioned table
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);

-- Create today's partition
CREATE TABLE audit_logs_today PARTITION OF audit_logs
    FOR VALUES FROM (CURRENT_DATE) TO (CURRENT_DATE + INTERVAL '1 day');

-- Function to create daily partitions
CREATE OR REPLACE FUNCTION create_audit_partition(partition_date DATE)
RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_name := 'audit_logs_' || TO_CHAR(partition_date, 'YYYY_MM_DD');
    start_date := partition_date::TEXT;
    end_date := (partition_date + INTERVAL '1 day')::TEXT;
    
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs
        FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date
    );
    
    -- Create indexes on the partition
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(user_id)', 
        'idx_' || partition_name || '_user_id', partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(action)', 
        'idx_' || partition_name || '_action', partition_name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I(created_at)', 
        'idx_' || partition_name || '_created_at', partition_name);
END;
$$ LANGUAGE plpgsql;

-- Function to drop old partitions (24-hour retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_partitions()
RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - INTERVAL '2 days'; -- Keep extra day for safety
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'audit_logs_%' 
        AND tablename != 'audit_logs_today'
        AND tablename ~ '^audit_logs_\d{4}_\d{2}_\d{2}$'
    LOOP
        -- Extract date from partition name and check if it's old enough
        DECLARE
            partition_date DATE;
            date_part TEXT;
        BEGIN
            date_part := SUBSTRING(partition_record.tablename FROM 'audit_logs_(\d{4}_\d{2}_\d{2})');
            partition_date := TO_DATE(date_part, 'YYYY_MM_DD');
            
            IF partition_date < cutoff_date THEN
                EXECUTE format('DROP TABLE IF EXISTS %I', partition_record.tablename);
                RAISE NOTICE 'Dropped old audit partition: %', partition_record.tablename;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to process partition %: %', partition_record.tablename, SQLERRM;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create next day's partition
CREATE OR REPLACE FUNCTION create_next_audit_partition()
RETURNS VOID AS $$
BEGIN
    PERFORM create_audit_partition(CURRENT_DATE + INTERVAL '1 day');
END;
$$ LANGUAGE plpgsql;

-- Create audit log summary view
CREATE VIEW audit_summary AS
SELECT 
    DATE(created_at) as audit_date,
    action,
    resource_type,
    COUNT(*) as action_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_actions,
    MIN(created_at) as first_action,
    MAX(created_at) as last_action
FROM audit_logs 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at), action, resource_type
ORDER BY audit_date DESC, action_count DESC;

-- Add constraints
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_created_at_check 
    CHECK (created_at >= CURRENT_DATE - INTERVAL '3 days' AND created_at <= CURRENT_DATE + INTERVAL '1 day');

-- Function to insert audit log entry
CREATE OR REPLACE FUNCTION insert_audit_log(
    p_user_id INTEGER,
    p_action audit_action,
    p_resource_type VARCHAR(100) DEFAULT NULL,
    p_resource_id INTEGER DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_request_method VARCHAR(10) DEFAULT NULL,
    p_request_path VARCHAR(500) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_success BOOLEAN DEFAULT TRUE,
    p_error_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id,
        old_values, new_values, ip_address, user_agent,
        request_method, request_path, description,
        success, error_message, metadata
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_old_values, p_new_values, p_ip_address, p_user_agent,
        p_request_method, p_request_path, p_description,
        p_success, p_error_message, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
