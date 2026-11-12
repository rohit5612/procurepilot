BEGIN;

-- Extend inventory_transfers with challan-style fields for inter-warehouse movements
ALTER TABLE IF EXISTS inventory_transfers
  ADD COLUMN IF NOT EXISTS challan_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS eway_bill_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS eway_bill_date DATE,
  ADD COLUMN IF NOT EXISTS origin_gst_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS destination_gst_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS driver_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20);

COMMIT;


