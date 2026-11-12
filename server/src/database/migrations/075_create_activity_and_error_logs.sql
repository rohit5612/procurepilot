-- Create Activity Logs and Error Logs tables
-- Activity Logs: Track user activities and interactions
-- Error Logs: Track application errors and exceptions

BEGIN;

-- ============================================================================
-- ACTIVITY LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    
    -- User information
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    
    -- Activity details
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'logout', 'view', 'export', 'print', 'download'
    module VARCHAR(50), -- 'procurement', 'inventory', 'user_management', 'system'
    feature VARCHAR(100), -- 'purchase_orders', 'items', etc.
    action VARCHAR(100), -- 'viewed_list', 'viewed_details', 'exported_report'
    
    -- Resource information
    resource_type VARCHAR(100), -- 'purchase_order', 'requisition', 'item'
    resource_id INTEGER,
    resource_name VARCHAR(255),
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    
    -- Additional context
    description TEXT,
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

-- ============================================================================
-- ERROR LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS error_logs (
    id BIGSERIAL PRIMARY KEY,
    
    -- Error classification
    error_level VARCHAR(20) NOT NULL, -- 'info', 'warning', 'error', 'critical'
    error_type VARCHAR(100), -- 'validation', 'database', 'api', 'authentication', 'authorization'
    error_code VARCHAR(50), -- Custom error codes like 'ERR_DB_001'
    
    -- Error details
    error_message TEXT NOT NULL,
    error_stack TEXT,
    
    -- Context
    module VARCHAR(50),
    feature VARCHAR(100),
    function_name VARCHAR(200),
    line_number INTEGER,
    
    -- User and request information
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    request_method VARCHAR(10),
    request_path VARCHAR(500),
    request_body JSONB,
    
    -- Additional context
    metadata JSONB,
    
    -- Resolution tracking
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_logs_error_level ON error_logs(error_level);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_module ON error_logs(module);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_is_resolved ON error_logs(is_resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_activity(
    p_user_id INTEGER,
    p_username VARCHAR(100),
    p_activity_type VARCHAR(50),
    p_module VARCHAR(50) DEFAULT NULL,
    p_feature VARCHAR(100) DEFAULT NULL,
    p_action VARCHAR(100) DEFAULT NULL,
    p_resource_type VARCHAR(100) DEFAULT NULL,
    p_resource_id INTEGER DEFAULT NULL,
    p_resource_name VARCHAR(255) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO activity_logs (
        user_id, username, activity_type, module, feature, action,
        resource_type, resource_id, resource_name,
        ip_address, user_agent, description, metadata
    ) VALUES (
        p_user_id, p_username, p_activity_type, p_module, p_feature, p_action,
        p_resource_type, p_resource_id, p_resource_name,
        p_ip_address, p_user_agent, p_description, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log errors
CREATE OR REPLACE FUNCTION log_error(
    p_error_level VARCHAR(20),
    p_error_type VARCHAR(100),
    p_error_message TEXT,
    p_error_stack TEXT DEFAULT NULL,
    p_module VARCHAR(50) DEFAULT NULL,
    p_feature VARCHAR(100) DEFAULT NULL,
    p_user_id INTEGER DEFAULT NULL,
    p_username VARCHAR(100) DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO error_logs (
        error_level, error_type, error_message, error_stack,
        module, feature, user_id, username, ip_address, metadata
    ) VALUES (
        p_error_level, p_error_type, p_error_message, p_error_stack,
        p_module, p_feature, p_user_id, p_username, p_ip_address, p_metadata
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;

