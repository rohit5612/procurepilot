-- Migration: Backfill entity tracking for existing workflows
-- Description: Update existing workflow instances and tasks with entity information
-- Date: 2025-10-07

BEGIN;

-- Update workflow_instances for requisitions (PRs)
UPDATE workflow_instances wi
SET 
  entity_id = (wi.data->>'requisitionId')::integer,
  entity_type = 'requisition'
WHERE entity_type IS NULL
  AND wi.data->>'requisitionId' IS NOT NULL;

-- Update workflow_instances for purchase orders (POs)
UPDATE workflow_instances wi
SET 
  entity_id = (wi.data->>'poId')::integer,
  entity_type = 'purchase_order'
WHERE entity_type IS NULL
  AND wi.data->>'poId' IS NOT NULL;

-- Update workflow_tasks with entity info from their instances
UPDATE workflow_tasks wt
SET 
  entity_id = wi.entity_id,
  entity_type = wi.entity_type,
  context = wi.data
FROM workflow_instances wi
WHERE wt.instance_id = wi.id
  AND wt.entity_type IS NULL
  AND wi.entity_type IS NOT NULL;

COMMIT;

