-- Add eWay Bill fields to store_return_notes for SRN-specific values
ALTER TABLE store_return_notes
ADD COLUMN IF NOT EXISTS eway_bill_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS eway_bill_date DATE;

COMMENT ON COLUMN store_return_notes.eway_bill_number IS 'SRN-specific eWay bill number (optional, can differ from DC)';
COMMENT ON COLUMN store_return_notes.eway_bill_date IS 'SRN-specific eWay bill date (optional, can differ from DC)';


