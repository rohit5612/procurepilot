-- ProcurePilot — point all supplier contacts at demo inbox/phone (never meant for live SMTP).
-- Database: procurepilot (see server/.env DB_NAME)
--
-- psql:
--   psql -h localhost -U postgres -d procurepilot -f scripts/set_supplier_test_contacts.sql
--
-- Use after importing legacy supplier data. Keeps realistic UI without real addresses.
-- PO issue does not email suppliers; keep EMAIL_ENABLED=false in server/.env for outbound mail.
--
-- Revert: restore from backup; this script does not store previous values.

BEGIN;

-- Non-routable .test domain (same convention as npm run db:demo-reset)
-- Change literals below only if you use a sandbox inbox with EMAIL_ENABLED=true.

-- Preview
SELECT COUNT(*) AS supplier_rows FROM suppliers;
SELECT COUNT(*) AS active_supplier_contacts FROM supplier_contacts WHERE is_active = true;

UPDATE suppliers
SET
  email = 'suppliers@mail.procurepilot.test',
  phone = '9000000099',
  updated_at = NOW();

UPDATE supplier_contacts
SET
  email = 'suppliers@mail.procurepilot.test',
  phone = '9000000099',
  mobile = '9000000099'
WHERE is_active = true;

INSERT INTO supplier_contacts (supplier_id, name, position, email, phone, mobile, is_primary, is_active)
SELECT
  s.id,
  COALESCE(s.contact_person, 'Demo contact'),
  'Testing',
  'suppliers@mail.procurepilot.test',
  '9000000099',
  '9000000099',
  true,
  true
FROM suppliers s
WHERE NOT EXISTS (
  SELECT 1
  FROM supplier_contacts sc
  WHERE sc.supplier_id = s.id
    AND sc.is_active = true
);

COMMIT;

-- Quick check:
-- SELECT email, phone, COUNT(*) FROM suppliers GROUP BY 1, 2;
