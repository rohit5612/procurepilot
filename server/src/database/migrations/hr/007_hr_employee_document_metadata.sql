-- HR Employee Documents: add structured metadata for document details
-- Example: Aadhaar number, PAN number, etc.

BEGIN;

ALTER TABLE hr_employee_document
  ADD COLUMN IF NOT EXISTS doc_number TEXT;

ALTER TABLE hr_employee_document
  ADD COLUMN IF NOT EXISTS doc_meta JSONB;

CREATE INDEX IF NOT EXISTS idx_hr_emp_doc_type ON hr_employee_document(doc_type);
CREATE INDEX IF NOT EXISTS idx_hr_emp_doc_number ON hr_employee_document(doc_number);

COMMIT;

