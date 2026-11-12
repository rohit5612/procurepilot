-- HR Organization: Company profile master (single row)
BEGIN;

CREATE TABLE IF NOT EXISTS hr_company_profile (
  id INTEGER PRIMARY KEY DEFAULT 1,

  legal_name TEXT,
  brand_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT,

  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,

  -- Statutory / tax identifiers
  cin TEXT,
  pan TEXT,
  tan TEXT,
  gstin TEXT,

  -- Establishment registrations (optional)
  pf_establishment_code TEXT,
  esic_establishment_code TEXT,

  -- Bank details (optional: for payslip header)
  bank_name TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_branch TEXT,

  default_currency TEXT NOT NULL DEFAULT 'INR',

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO hr_company_profile (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;

