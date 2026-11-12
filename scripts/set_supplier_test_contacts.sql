-- ProcurePilot — point all supplier contact fields at one inbox/phone for testing.
-- Database: procurepilot (see server/.env DB_NAME)
--
-- psql:
--   psql -h localhost -U postgres -d procurepilot -f scripts/set_supplier_test_contacts.sql
--
-- Revert: restore from backup; this script does not store previous values.
--
-- IMPORTANT: Direct SQL does NOT clear Redis. After COMMIT, flush supplier cache
-- (otherwise the app may still show old email/phone for up to 15 minutes):
--   redis-cli --scan --pattern "api:v1:procurement:suppliers:*" | xargs -r redis-cli DEL
-- On Windows Git Bash, omit xargs -r or run keys manually in redis-cli.
-- Or restart the Node server (dev).

BEGIN;

-- Preview
SELECT COUNT(*) AS supplier_rows FROM suppliers;
SELECT COUNT(*) AS active_supplier_contacts FROM supplier_contacts WHERE is_active = true;

-- Supplier master (list, PO, notifications)
UPDATE suppliers
SET
  email = 'rishida1raegetsu@gmail.com',
  phone = '9673396808',
  updated_at = NOW();

-- Contact rows (detail / multi-contact UI)
UPDATE supplier_contacts
SET
  email = 'rishida1raegetsu@gmail.com',
  phone = '9673396808',
  mobile = '9673396808'
WHERE is_active = true;

-- One primary contact per supplier that has none
INSERT INTO supplier_contacts (supplier_id, name, position, email, phone, mobile, is_primary, is_active)
SELECT
  s.id,
  COALESCE(s.contact_person, 'Test contact'),
  'Testing',
  'rishida1raegetsu@gmail.com',
  '9673396808',
  '9673396808',
  true,
  true
FROM suppliers s
WHERE NOT EXISTS (
  SELECT 1
  FROM supplier_contacts sc
  WHERE sc.supplier_id = s.id
    AND sc.is_active = true
);

-- Verify
SELECT COUNT(*) AS suppliers_with_test_email
FROM suppliers
WHERE email = 'rishida1raegetsu@gmail.com' AND phone = '9673396808';

SELECT COUNT(*) AS contacts_with_test_email
FROM supplier_contacts
WHERE is_active = true AND email = 'rishida1raegetsu@gmail.com';

COMMIT;

-- Quick check (run after COMMIT):
-- SELECT email, phone, COUNT(*) FROM suppliers GROUP BY 1, 2;
