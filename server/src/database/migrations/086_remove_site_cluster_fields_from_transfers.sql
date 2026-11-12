-- Remove site and cluster fields from inventory_transfers table
-- Since transfers are warehouse-to-warehouse transactions, site/cluster info is not needed

BEGIN;

-- Drop the site and cluster related columns from inventory_transfers
ALTER TABLE inventory_transfers 
  DROP COLUMN IF EXISTS from_site_id,
  DROP COLUMN IF EXISTS from_site_name,
  DROP COLUMN IF EXISTS to_site_id,
  DROP COLUMN IF EXISTS to_site_name,
  DROP COLUMN IF EXISTS from_circle_id,
  DROP COLUMN IF EXISTS to_circle_id,
  DROP COLUMN IF EXISTS from_cluster_id,
  DROP COLUMN IF EXISTS to_cluster_id;

COMMIT;

-- Separate migration step: drop GST columns from inventory_transfers
BEGIN;

ALTER TABLE inventory_transfers 
  DROP COLUMN IF EXISTS origin_gst_number,
  DROP COLUMN IF EXISTS destination_gst_number;

COMMIT;
