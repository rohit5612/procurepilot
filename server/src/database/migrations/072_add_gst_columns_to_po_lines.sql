-- Add GST breakdown columns to po_lines table
ALTER TABLE po_lines
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS base_amount NUMERIC(15,2) DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_po_lines_gst_rate ON po_lines(gst_rate);

-- Comments
COMMENT ON COLUMN po_lines.gst_rate IS 'Total GST percentage (e.g., 18 for 18%)';
COMMENT ON COLUMN po_lines.cgst_rate IS 'CGST percentage (intrastate)';
COMMENT ON COLUMN po_lines.sgst_rate IS 'SGST percentage (intrastate)';
COMMENT ON COLUMN po_lines.igst_rate IS 'IGST percentage (interstate)';
COMMENT ON COLUMN po_lines.cgst_amount IS 'CGST amount in currency';
COMMENT ON COLUMN po_lines.sgst_amount IS 'SGST amount in currency';
COMMENT ON COLUMN po_lines.igst_amount IS 'IGST amount in currency';
COMMENT ON COLUMN po_lines.base_amount IS 'Base amount without GST';

