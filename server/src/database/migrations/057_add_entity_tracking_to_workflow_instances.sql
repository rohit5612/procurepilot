-- Migration: Add entity tracking to workflow instances
-- Description: Add entity_id and entity_type to workflow_instances for better tracking
-- Date: 2025-10-07

BEGIN;

-- Add entity tracking columns to workflow_instances
ALTER TABLE workflow_instances 
ADD COLUMN IF NOT EXISTS entity_id INTEGER,
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_workflow_instances_entity ON workflow_instances(entity_type, entity_id);

COMMIT;

