-- Migration: Create domain events system
-- Description: Phase 0 - Platform setup - Domain events with outbox pattern

BEGIN;

-- Create domain_outbox table for event publishing
CREATE TABLE IF NOT EXISTS domain_outbox (
    id SERIAL PRIMARY KEY,
    event_id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    event_version INTEGER NOT NULL DEFAULT 1,
    aggregate_id VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_domain_outbox_status ON domain_outbox(status);
CREATE INDEX IF NOT EXISTS idx_domain_outbox_event_type ON domain_outbox(event_type);
CREATE INDEX IF NOT EXISTS idx_domain_outbox_aggregate ON domain_outbox(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_domain_outbox_retry ON domain_outbox(status, next_retry_at) WHERE status = 'pending';

-- Create function to insert events
CREATE OR REPLACE FUNCTION insert_domain_event(
    p_event_type VARCHAR(100),
    p_aggregate_id VARCHAR(100),
    p_aggregate_type VARCHAR(50),
    p_event_data JSONB,
    p_metadata JSONB DEFAULT '{}',
    p_event_version INTEGER DEFAULT 1
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO domain_outbox (
        event_type,
        aggregate_id,
        aggregate_type,
        event_data,
        metadata,
        event_version
    ) VALUES (
        p_event_type,
        p_aggregate_id,
        p_aggregate_type,
        p_event_data,
        p_metadata,
        p_event_version
    ) RETURNING event_id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark event as processed
CREATE OR REPLACE FUNCTION mark_event_processed(p_event_id UUID) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE domain_outbox 
    SET status = 'processed', 
        processed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE event_id = p_event_id AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to mark event as failed
CREATE OR REPLACE FUNCTION mark_event_failed(
    p_event_id UUID, 
    p_error_message TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_retry_count INTEGER;
    v_max_retries INTEGER;
BEGIN
    SELECT retry_count, max_retries INTO v_retry_count, v_max_retries
    FROM domain_outbox WHERE event_id = p_event_id;
    
    IF v_retry_count >= v_max_retries THEN
        -- Mark as permanently failed
        UPDATE domain_outbox 
        SET status = 'failed',
            error_message = p_error_message,
            updated_at = CURRENT_TIMESTAMP
        WHERE event_id = p_event_id;
    ELSE
        -- Increment retry count and schedule next retry
        UPDATE domain_outbox 
        SET status = 'pending',
            retry_count = retry_count + 1,
            next_retry_at = CURRENT_TIMESTAMP + (INTERVAL '5 minutes' * retry_count),
            error_message = p_error_message,
            updated_at = CURRENT_TIMESTAMP
        WHERE event_id = p_event_id;
    END IF;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Create function to get pending events for processing
CREATE OR REPLACE FUNCTION get_pending_events(p_limit INTEGER DEFAULT 100) 
RETURNS TABLE (
    event_id UUID,
    event_type VARCHAR(100),
    event_version INTEGER,
    aggregate_id VARCHAR(100),
    aggregate_type VARCHAR(50),
    event_data JSONB,
    metadata JSONB,
    retry_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.event_id,
        o.event_type,
        o.event_version,
        o.aggregate_id,
        o.aggregate_type,
        o.event_data,
        o.metadata,
        o.retry_count
    FROM domain_outbox o
    WHERE o.status = 'pending' 
    AND (o.next_retry_at IS NULL OR o.next_retry_at <= CURRENT_TIMESTAMP)
    ORDER BY o.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

COMMIT;
