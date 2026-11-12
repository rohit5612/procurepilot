-- Add email attachment fields to requisitions for mandatory PR submission attachment
BEGIN;

ALTER TABLE requisitions
  ADD COLUMN IF NOT EXISTS email_attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS email_attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS email_attachment_mime TEXT,
  ADD COLUMN IF NOT EXISTS email_attachment_size INTEGER;

COMMENT ON COLUMN requisitions.email_attachment_path IS 'Filesystem path to the attached PR email PDF';
COMMENT ON COLUMN requisitions.email_attachment_name IS 'Original filename of the attached PR email PDF';
COMMENT ON COLUMN requisitions.email_attachment_mime IS 'MIME type (should be application/pdf)';
COMMENT ON COLUMN requisitions.email_attachment_size IS 'File size in bytes';

COMMIT;


