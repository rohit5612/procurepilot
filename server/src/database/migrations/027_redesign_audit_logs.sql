-- Redesign audit logs system to fix partition and constraint issues
BEGIN;

-- Drop existing audit logs table and related objects
DROP VIEW IF EXISTS audit_summary;
DROP FUNCTION IF EXISTS insert_audit_log(INTEGER, audit_action, VARCHAR, INTEGER, JSONB, JSONB, INET, TEXT, VARCHAR, VARCHAR, TEXT, BOOLEAN, TEXT, JSONB);
DROP FUNCTION IF EXISTS create_next_audit_partition();
DROP FUNCTION IF EXISTS cleanup_old_audit_partitions();
DROP FUNCTION IF EXISTS create_audit_partition(DATE);

-- Drop existing partitions
DROP TABLE IF EXISTS audit_logs_today;
DROP TABLE IF EXISTS audit_logs_2025_08_08;
DROP TABLE IF EXISTS audit_logs_2025_08_11;

-- Drop main table
DROP TABLE IF EXISTS audit_logs;

-- Add user_archived to the enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'user_archived' AND enumtypid = 'audit_action'::regtype) THEN
        ALTER TYPE audit_action ADD VALUE 'user_archived';
    END IF;
END $$;

-- Create new audit_logs table with better partitioning strategy
CREATE TABLE audit_logs (
    id BIGSERIAL,
    
    -- User and session information
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Allow NULL when user is deleted
    session_id VARCHAR(255),
    
    -- Action details
    action audit_action NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    
    -- Change tracking
    old_values JSONB,
    new_values JSONB,
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_query JSONB,
    
    -- Result and metadata
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    duration_ms INTEGER,
    
    -- Additional context
    description TEXT,
    metadata JSONB,
    
    -- Timestamp (for partitioning)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
) PARTITION BY RANGE (created_at);

-- Create indexes on the partitioned table
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);

-- Create partitions for the last 7 days and next 3 days
-- This ensures we have enough partitions to handle the constraint
DO $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    -- Create partitions for the last 7 days
    FOR i IN 0..6 LOOP
        partition_date := CURRENT_DATE - (i || ' days')::INTERVAL;
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
    END LOOP;
    
    -- Create partitions for the next 3 days
    FOR i IN 1..3 LOOP
        partition_date := CURRENT_DATE + (i || ' days')::INTERVAL;
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
    END LOOP;
END $$;

-- Add a more flexible constraint that allows a wider range
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_created_at_check 
    CHECK (created_at >= CURRENT_DATE - INTERVAL '7 days' AND created_at <= CURRENT_DATE + INTERVAL '3 days');

-- Create improved audit log insertion function
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
    partition_name TEXT;
    partition_date DATE;
BEGIN
    -- Ensure we have a partition for the current date
    partition_date := CURRENT_DATE;
    partition_name := 'audit_logs_' || TO_CHAR(partition_date, 'YYYY_MM_DD');
    
    -- Create partition if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON c.relnamespace = n.oid 
        WHERE c.relname = partition_name AND n.nspname = 'public'
    ) THEN
        EXECUTE format('
            CREATE TABLE %I PARTITION OF audit_logs
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, partition_date::TEXT, (partition_date + INTERVAL '1 day')::TEXT
        );
        
        -- Create indexes on the new partition
        EXECUTE format('CREATE INDEX %I ON %I(user_id)', 
            'idx_' || partition_name || '_user_id', partition_name);
        EXECUTE format('CREATE INDEX %I ON %I(action)', 
            'idx_' || partition_name || '_action', partition_name);
        EXECUTE format('CREATE INDEX %I ON %I(created_at)', 
            'idx_' || partition_name || '_created_at', partition_name);
    END IF;
    
    -- Insert the audit log
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

-- Create function to automatically create partitions
CREATE OR REPLACE FUNCTION ensure_audit_partitions()
RETURNS VOID AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
    days_ahead INTEGER := 3;
    days_behind INTEGER := 7;
BEGIN
    -- Create partitions for future dates
    FOR i IN 1..days_ahead LOOP
        partition_date := CURRENT_DATE + (i || ' days')::INTERVAL;
        partition_name := 'audit_logs_' || TO_CHAR(partition_date, 'YYYY_MM_DD');
        start_date := partition_date::TEXT;
        end_date := (partition_date + INTERVAL '1 day')::TEXT;
        
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c 
            JOIN pg_namespace n ON c.relnamespace = n.oid 
            WHERE c.relname = partition_name AND n.nspname = 'public'
        ) THEN
            EXECUTE format('
                CREATE TABLE %I PARTITION OF audit_logs
                FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            
            -- Create indexes on the new partition
            EXECUTE format('CREATE INDEX %I ON %I(user_id)', 
                'idx_' || partition_name || '_user_id', partition_name);
            EXECUTE format('CREATE INDEX %I ON %I(action)', 
                'idx_' || partition_name || '_action', partition_name);
            EXECUTE format('CREATE INDEX %I ON %I(created_at)', 
                'idx_' || partition_name || '_created_at', partition_name);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create function to cleanup old partitions
CREATE OR REPLACE FUNCTION cleanup_old_audit_partitions()
RETURNS VOID AS $$
DECLARE
    partition_record RECORD;
    cutoff_date DATE;
BEGIN
    cutoff_date := CURRENT_DATE - INTERVAL '8 days'; -- Keep 7 days + 1 day buffer
    
    FOR partition_record IN
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE tablename LIKE 'audit_logs_%' 
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

-- Create a simple audit log function for basic operations
CREATE OR REPLACE FUNCTION log_audit_event(
    p_user_id INTEGER,
    p_action audit_action,
    p_resource_type VARCHAR(100) DEFAULT NULL,
    p_resource_id INTEGER DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS BIGINT AS $$
BEGIN
    RETURN insert_audit_log(
        p_user_id, p_action, p_resource_type, p_resource_id,
        NULL, NULL, NULL, NULL, NULL, NULL, p_description,
        TRUE, NULL, p_metadata
    );
END;
$$ LANGUAGE plpgsql;

COMMIT;
