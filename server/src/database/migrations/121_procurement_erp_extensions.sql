-- Procurement ERP extensions: budget commitments, RFQ, invoices, returns, PO amendments, supplier qualification

BEGIN;

-- Budget commitment tracking (pairs with budget_ledger)
CREATE TABLE IF NOT EXISTS budget_commitments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_type VARCHAR(40) NOT NULL,
  reference_id INTEGER NOT NULL,
  amount NUMERIC(18, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  status VARCHAR(20) NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'committed', 'released')),
  procurement_category VARCHAR(64) NOT NULL DEFAULT 'other',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reference_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_commitments_user ON budget_commitments (user_id, status);

-- Supplier qualification
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS qualification_status VARCHAR(30) NOT NULL DEFAULT 'qualified',
  ADD COLUMN IF NOT EXISTS qualified_until DATE,
  ADD COLUMN IF NOT EXISTS qualification_notes TEXT,
  ADD COLUMN IF NOT EXISTS qualification_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- PO amendments
CREATE TABLE IF NOT EXISTS po_amendments (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  amendment_number INTEGER NOT NULL,
  reason TEXT,
  snapshot_json JSONB NOT NULL,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (purchase_order_id, amendment_number)
);

-- RFQ
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_status') THEN
    CREATE TYPE rfq_status AS ENUM (
      'draft', 'sent', 'responses_open', 'evaluating', 'awarded', 'cancelled'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS rfqs (
  id SERIAL PRIMARY KEY,
  rfq_number VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  requisition_id INTEGER REFERENCES requisitions(id) ON DELETE SET NULL,
  status rfq_status NOT NULL DEFAULT 'draft',
  response_deadline DATE,
  awarded_supplier_id INTEGER REFERENCES suppliers(id),
  awarded_quotation_id INTEGER,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rfq_lines (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  requisition_line_id INTEGER REFERENCES requisition_lines(id),
  item_id INTEGER REFERENCES items(id),
  item_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(15, 3) NOT NULL,
  unit_of_measure VARCHAR(20) DEFAULT 'PCS',
  specifications TEXT,
  UNIQUE (rfq_id, line_number)
);

CREATE TABLE IF NOT EXISTS rfq_invitations (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by INTEGER REFERENCES users(id),
  status VARCHAR(30) NOT NULL DEFAULT 'invited',
  UNIQUE (rfq_id, supplier_id)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quotation_status') THEN
    CREATE TYPE quotation_status AS ENUM ('draft', 'submitted', 'awarded', 'rejected');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS supplier_quotations (
  id SERIAL PRIMARY KEY,
  rfq_id INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status quotation_status NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(15, 2) DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  valid_until DATE,
  notes TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (rfq_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS quotation_lines (
  id SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES supplier_quotations(id) ON DELETE CASCADE,
  rfq_line_id INTEGER NOT NULL REFERENCES rfq_lines(id) ON DELETE CASCADE,
  unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  lead_time_days INTEGER,
  notes TEXT,
  UNIQUE (quotation_id, rfq_line_id)
);

ALTER TABLE rfqs
  DROP CONSTRAINT IF EXISTS rfqs_awarded_quotation_id_fkey;
ALTER TABLE rfqs
  ADD CONSTRAINT rfqs_awarded_quotation_id_fkey
  FOREIGN KEY (awarded_quotation_id) REFERENCES supplier_quotations(id) ON DELETE SET NULL;

-- Supplier invoices (AP coordination)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplier_invoice_status') THEN
    CREATE TYPE supplier_invoice_status AS ENUM (
      'captured', 'matched', 'exception', 'ready_for_finance', 'cancelled'
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS supplier_invoices (
  id SERIAL PRIMARY KEY,
  invoice_number VARCHAR(100) NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  invoice_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  subtotal DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
  status supplier_invoice_status NOT NULL DEFAULT 'captured',
  match_notes TEXT,
  finance_handoff_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id SERIAL PRIMARY KEY,
  supplier_invoice_id INTEGER NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  po_line_id INTEGER REFERENCES po_lines(id),
  grn_line_id INTEGER REFERENCES grn_lines(id),
  quantity DECIMAL(15, 3) NOT NULL DEFAULT 0,
  unit_price DECIMAL(15, 2) NOT NULL DEFAULT 0,
  line_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  UNIQUE (supplier_invoice_id, line_number)
);

-- Store return notes (SRN)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'srn_status') THEN
    CREATE TYPE srn_status AS ENUM ('draft', 'posted', 'cancelled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS store_return_notes (
  id SERIAL PRIMARY KEY,
  srn_number VARCHAR(50) UNIQUE NOT NULL,
  goods_receipt_id INTEGER REFERENCES goods_receipts(id),
  purchase_order_id INTEGER REFERENCES purchase_orders(id),
  supplier_id INTEGER REFERENCES suppliers(id),
  status srn_status NOT NULL DEFAULT 'draft',
  reason TEXT,
  posted_at TIMESTAMPTZ,
  posted_by INTEGER REFERENCES users(id),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS srn_lines (
  id SERIAL PRIMARY KEY,
  store_return_note_id INTEGER NOT NULL REFERENCES store_return_notes(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  grn_line_id INTEGER REFERENCES grn_lines(id),
  po_line_id INTEGER REFERENCES po_lines(id),
  item_id INTEGER REFERENCES items(id),
  return_qty DECIMAL(15, 3) NOT NULL,
  unit_price DECIMAL(15, 2) DEFAULT 0,
  notes TEXT,
  UNIQUE (store_return_note_id, line_number)
);

COMMIT;
