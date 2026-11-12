-- Extend hr_employee with deeper HR profile fields (essential + recommended + nice-to-have)
-- Notes:
-- - Keep one-to-many/history data in separate tables (bank accounts, dependents, education, experience, transfers, nominees).
-- - This migration only adds columns on hr_employee.

BEGIN;

-- Personal
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS gender TEXT;          -- male | female | other
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS marital_status TEXT;  -- single | married | divorced | widowed
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS nationality TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS disability_flag BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS disability_details TEXT;

-- Family (often needed for payroll/statutory)
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS spouse_name TEXT;

-- Contact
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS secondary_email TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS secondary_phone TEXT;

-- Address split (existing address_* treated as current address)
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS permanent_address_line1 TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS permanent_address_line2 TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS permanent_city TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS permanent_state TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS permanent_postal_code TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS permanent_country TEXT;

-- Employment / lifecycle
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS employment_type TEXT;      -- permanent | contract | intern | consultant
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS employment_category TEXT;  -- staff | worker | technician | other
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS probation_end_date DATE;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS confirmation_date DATE;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS resign_date DATE;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS last_working_day DATE;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS exit_reason TEXT;

-- Statutory / compliance identifiers (store minimally; document proofs stay in hr_employee_document)
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS uan_number TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS pf_number TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS esic_number TEXT;

-- Payroll essentials (structure mapping comes in Payroll phase; these are the employee-level basics)
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS payment_mode TEXT; -- bank | cash | cheque

-- Access/operations (nice-to-have but helps integration with attendance/biometrics/inventory)
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS biometric_device_id TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS access_card_id TEXT;

-- Insurance (nice-to-have)
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS insurance_provider TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT;
ALTER TABLE hr_employee ADD COLUMN IF NOT EXISTS insurance_valid_to DATE;

-- Indexes for fast lookups (optional but useful)
CREATE INDEX IF NOT EXISTS idx_hr_employee_pan ON hr_employee(pan_number);
CREATE INDEX IF NOT EXISTS idx_hr_employee_aadhaar ON hr_employee(aadhaar_number);
CREATE INDEX IF NOT EXISTS idx_hr_employee_uan ON hr_employee(uan_number);
CREATE INDEX IF NOT EXISTS idx_hr_employee_esic ON hr_employee(esic_number);

COMMIT;

