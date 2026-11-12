-- Migration: Add entity tracking to workflow tasks
-- Description: Add entity_id and entity_type to workflow_tasks for better task filtering
-- Date: 2025-10-07

BEGIN;

-- Add entity tracking columns to workflow_tasks
ALTER TABLE workflow_tasks 
ADD COLUMN IF NOT EXISTS entity_id INTEGER,
ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_entity ON workflow_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_status_entity ON workflow_tasks(status, entity_type);

-- Add due_date column if it doesn't exist (for task deadline tracking)
ALTER TABLE workflow_tasks
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- Add context column for storing task-specific data
ALTER TABLE workflow_tasks
ADD COLUMN IF NOT EXISTS context JSONB;

COMMIT;

