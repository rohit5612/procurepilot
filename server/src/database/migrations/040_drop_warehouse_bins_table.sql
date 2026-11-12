-- Migration: Drop warehouse_bins table
-- This table is not being used by the main bin management system
-- The main bin management uses the 'bins' table instead

-- Drop the warehouse_bins table
DROP TABLE IF EXISTS warehouse_bins CASCADE;

-- Note: This table was used for zone-based bin management which is not currently implemented in the frontend
-- The main bin management system uses the 'bins' table with warehouse_id foreign key
