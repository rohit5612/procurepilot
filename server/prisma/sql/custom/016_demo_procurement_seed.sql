-- ProcurePilot demo masters: geo sites, items, suppliers, price lists (INR, GST).
-- Assumes admin user exists (migration 15).
-- Contacts use @mail.procurepilot.test and 9000000xxx phones (non-routable; no mail is sent on PO issue).

BEGIN;

INSERT INTO departments (name, display_name, description, department_code, is_active)
VALUES ('Procurement', 'Procurement', 'Demo procurement department for E2E tests', 'PROC', true)
ON CONFLICT (department_code) DO UPDATE
  SET name = EXCLUDED.name,
      display_name = EXCLUDED.display_name,
      description = EXCLUDED.description,
      is_active = true;

-- Demo clusters (Rajasthan + Delhi NCR)
INSERT INTO clusters (circle_id, code, name)
SELECT tc.id, v.code, v.name
FROM telecom_circles tc
CROSS JOIN (VALUES
  ('JAI', 'Jaipur'),
  ('UDR', 'Udaipur')
) AS v(code, name)
WHERE tc.code = 'RJ'
ON CONFLICT (circle_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO clusters (circle_id, code, name)
SELECT tc.id, 'NCR', 'Delhi NCR'
FROM telecom_circles tc
WHERE tc.code = 'DL'
ON CONFLICT (circle_id, code) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO sites (
  site_code, name, description, site_type, status,
  address_line1, city, state, postal_code, country,
  contact_person, email, phone,
  circle_id, cluster_id, is_default, created_by
)
SELECT
  v.site_code, v.name, v.description, 'OFFICE', 'ACTIVE',
  v.address, v.city, v.state, v.postal, 'India',
  v.contact_person, v.email, v.phone,
  tc.id, cl.id, v.is_default,
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (VALUES
  ('PP-JAI-01', 'Jaipur Operations Hub', 'Rajasthan demo site', 'MI Road, Jaipur', 'Jaipur', 'Rajasthan', '302006', 'Site Incharge', 'site-jai@mail.procurepilot.test', '9000000101', 'JAI', 'RJ', true),
  ('PP-DEL-01', 'Delhi NCR Office', 'Delhi demo site', 'Connaught Place', 'New Delhi', 'Delhi', '110001', 'Site Incharge', 'site-del@mail.procurepilot.test', '9000000102', 'NCR', 'DL', false)
) AS v(site_code, name, description, address, city, state, postal, contact_person, email, phone, cluster_code, circle_code, is_default)
JOIN telecom_circles tc ON tc.code = v.circle_code
JOIN clusters cl ON cl.circle_id = tc.id AND cl.code = v.cluster_code;

INSERT INTO warehouses (
  warehouse_code, name, description, warehouse_type, status,
  address_line1, city, state, postal_code, country,
  contact_person, email, phone,
  circle_id, cluster_id, created_by
)
SELECT
  v.wh_code, v.name, v.description, 'STORAGE', 'ACTIVE',
  v.address, v.city, v.state, v.postal, 'India',
  v.contact_person, v.email, v.phone,
  tc.id, cl.id,
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (VALUES
  ('WH-JAI-01', 'Jaipur Central Store', 'GRN destination — Jaipur', 'Sitapura Industrial Area', 'Jaipur', 'Rajasthan', '302022', 'Store Manager', 'wh-jai@mail.procurepilot.test', '9000000201', 'JAI', 'RJ'),
  ('WH-DEL-01', 'Delhi NCR Store', 'GRN destination — Delhi', 'Okhla Phase II', 'New Delhi', 'Delhi', '110020', 'Store Manager', 'wh-del@mail.procurepilot.test', '9000000202', 'NCR', 'DL')
) AS v(wh_code, name, description, address, city, state, postal, contact_person, email, phone, cluster_code, circle_code)
JOIN telecom_circles tc ON tc.code = v.circle_code
JOIN clusters cl ON cl.circle_id = tc.id AND cl.code = v.cluster_code;

INSERT INTO item_categories (category_code, name, description, category_type, status, sort_order, created_by)
SELECT
  v.code, v.name, v.description, 'PRODUCT', 'ACTIVE', v.ord,
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (VALUES
  ('PP-ELEC', 'Electrical & switchgear', 'MCB, lighting, cable', 10),
  ('PP-PPE', 'Personal protective equipment', 'Helmets, shoes', 20),
  ('PP-OFC', 'Office & general supplies', 'Paper, stationery', 30)
) AS v(code, name, description, ord);

INSERT INTO items (
  item_code, name, description, category_id, unit_of_measure, item_type,
  company_code, hsn_code, manufacturer, is_active, standard_cost, created_by
)
SELECT
  v.item_code, v.name, v.description,
  c.id, v.uom, 'STOCK',
  v.company_code, v.hsn, v.mfr, true, v.std_cost,
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (VALUES
  ('PP-ELEC-001', 'MCB 32A Single Pole', 'Electrical distribution', 'PP-ELEC', 'PCS', 'PP-SKU-E001', '85362010', 'Schneider', 220.00),
  ('PP-ELEC-002', 'LED Panel Light 2x2', 'Ceiling panel 36W', 'PP-ELEC', 'PCS', 'PP-SKU-E002', '94054200', 'Philips', 1850.00),
  ('PP-ELEC-003', 'Copper Cable 2.5 sqmm', 'FR PVC cable per meter', 'PP-ELEC', 'MTR', 'PP-SKU-E003', '85444999', 'Polycab', 42.00),
  ('PP-PPE-001', 'Industrial Safety Helmet', 'IS 2925 compliant', 'PP-PPE', 'PCS', 'PP-SKU-P001', '65061010', 'Karam', 285.00),
  ('PP-PPE-002', 'Safety Shoes Steel Toe', 'Size 8 UK', 'PP-PPE', 'PR', 'PP-SKU-P002', '64039990', 'Hillson', 1290.00),
  ('PP-OFC-001', 'A4 Copier Paper 75gsm', 'Ream 500 sheets', 'PP-OFC', 'PCS', 'PP-SKU-O001', '48025620', 'JK Paper', 320.00),
  ('PP-OFC-002', 'Ballpoint Pen Box', 'Box of 50 pens', 'PP-OFC', 'PCS', 'PP-SKU-O002', '96081019', 'Classmate', 145.00)
) AS v(item_code, name, description, cat_code, uom, company_code, hsn, mfr, std_cost)
JOIN item_categories c ON c.category_code = v.cat_code;

INSERT INTO suppliers (
  supplier_code, name, legal_name, supplier_type, status,
  contact_person, email, phone,
  address_line1, city, state, postal_code, country,
  gst_number, payment_terms, currency,
  qualification_status, qualified_until, rating, created_by
)
SELECT
  v.code, v.name, v.legal, 'VENDOR', 'ACTIVE',
  v.contact, v.email, v.phone,
  v.addr, v.city, v.state, v.postal, 'India',
  v.gst, 30, 'INR',
  'qualified', (CURRENT_DATE + INTERVAL '1 year')::date, v.rating,
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (VALUES
  ('SUP-RJ-ELC', 'Jaipur Electricals Pvt Ltd', 'Jaipur Electricals Private Limited',
   'Ravi Meena', 'sup-rj-elc@mail.procurepilot.test', '9000000001',
   '22-Gopalpura Bypass', 'Jaipur', 'Rajasthan', '302018', '08ABCDE1234F1Z5', 4),
  ('SUP-DL-SAF', 'Capital Safety Supplies', 'Capital Safety Supplies LLP',
   'Neha Sharma', 'sup-dl-saf@mail.procurepilot.test', '9000000002',
   'Okhla Industrial Estate', 'New Delhi', 'Delhi', '110020', '07FGHIJ5678K2Z6', 5),
  ('SUP-IN-MRO', 'Bharat MRO Traders', 'Bharat MRO Traders',
   'Amit Jain', 'sup-in-mro@mail.procurepilot.test', '9000000003',
   'Sitapura RIICO', 'Jaipur', 'Rajasthan', '302022', '08PQRST9012L3Z7', 4)
) AS v(code, name, legal, contact, email, phone, addr, city, state, postal, gst, rating);

INSERT INTO supplier_contacts (supplier_id, name, position, email, phone, mobile, is_primary, is_active)
SELECT
  s.id,
  COALESCE(s.contact_person, 'Demo contact'),
  'Sales',
  s.email,
  s.phone,
  s.phone,
  true,
  true
FROM suppliers s
WHERE s.supplier_code IN ('SUP-RJ-ELC', 'SUP-DL-SAF', 'SUP-IN-MRO');

INSERT INTO supplier_circles (supplier_id, circle_id)
SELECT s.id, tc.id
FROM suppliers s
JOIN telecom_circles tc ON (
  (s.supplier_code = 'SUP-RJ-ELC' AND tc.code = 'RJ')
  OR (s.supplier_code = 'SUP-DL-SAF' AND tc.code = 'DL')
  OR (s.supplier_code = 'SUP-IN-MRO' AND tc.code IN ('RJ', 'DL'))
);

INSERT INTO supplier_clusters (supplier_id, cluster_id)
SELECT s.id, cl.id
FROM suppliers s
JOIN telecom_circles tc ON tc.code IN ('RJ', 'DL')
JOIN clusters cl ON cl.circle_id = tc.id
WHERE
  (s.supplier_code = 'SUP-RJ-ELC' AND tc.code = 'RJ' AND cl.code IN ('JAI', 'UDR'))
  OR (s.supplier_code = 'SUP-DL-SAF' AND tc.code = 'DL' AND cl.code = 'NCR')
  OR (s.supplier_code = 'SUP-IN-MRO' AND (
    (tc.code = 'RJ' AND cl.code IN ('JAI', 'UDR')) OR (tc.code = 'DL' AND cl.code = 'NCR')
  ));

INSERT INTO price_lists (name, description, currency, is_active, valid_from, supplier_id, import_source, created_by)
SELECT
  s.name || ' — FY list',
  'Demo contract prices for ProcurePilot E2E',
  'INR', true, CURRENT_DATE, s.id, 'manual',
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM suppliers s
WHERE s.supplier_code IN ('SUP-RJ-ELC', 'SUP-DL-SAF', 'SUP-IN-MRO');

UPDATE suppliers s
SET applied_price_list_id = pl.id, updated_at = NOW()
FROM price_lists pl
WHERE pl.supplier_id = s.id;

-- Contract unit prices (₹, GST %). Same values on supplier_items for PR supplier pickers.
INSERT INTO item_prices (
  price_list_id, item_id, supplier_id, price_type, unit_price, currency,
  gst_rate, min_quantity, valid_from, is_active
)
SELECT pl.id, i.id, s.id, 'PURCHASE', p.unit_price, 'INR', p.gst_rate, 1, CURRENT_DATE, true
FROM (VALUES
  ('SUP-RJ-ELC', 'PP-ELEC-001', 235.00, 18.00),
  ('SUP-RJ-ELC', 'PP-ELEC-002', 1820.00, 18.00),
  ('SUP-RJ-ELC', 'PP-ELEC-003', 39.50, 18.00),
  ('SUP-DL-SAF', 'PP-PPE-001', 278.00, 12.00),
  ('SUP-DL-SAF', 'PP-PPE-002', 1245.00, 12.00),
  ('SUP-DL-SAF', 'PP-ELEC-001', 252.00, 18.00),
  ('SUP-IN-MRO', 'PP-OFC-001', 312.00, 12.00),
  ('SUP-IN-MRO', 'PP-OFC-002', 138.00, 12.00),
  ('SUP-IN-MRO', 'PP-PPE-001', 292.00, 12.00),
  ('SUP-IN-MRO', 'PP-ELEC-003', 41.00, 18.00),
  ('SUP-IN-MRO', 'PP-ELEC-001', 248.00, 18.00)
) AS p(sup_code, item_code, unit_price, gst_rate)
JOIN suppliers s ON s.supplier_code = p.sup_code
JOIN price_lists pl ON pl.supplier_id = s.id
JOIN items i ON i.item_code = p.item_code;

INSERT INTO supplier_items (
  supplier_id, item_id, unit_price, currency, lead_time_days, minimum_order_qty, is_preferred, created_by
)
SELECT s.id, i.id, p.unit_price, 'INR', p.lead_days, 1, p.preferred,
       (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
FROM (VALUES
  ('SUP-RJ-ELC', 'PP-ELEC-001', 235.00, 5, true),
  ('SUP-RJ-ELC', 'PP-ELEC-002', 1820.00, 7, true),
  ('SUP-RJ-ELC', 'PP-ELEC-003', 39.50, 5, true),
  ('SUP-DL-SAF', 'PP-PPE-001', 278.00, 4, true),
  ('SUP-DL-SAF', 'PP-PPE-002', 1245.00, 6, true),
  ('SUP-DL-SAF', 'PP-ELEC-001', 252.00, 8, false),
  ('SUP-IN-MRO', 'PP-OFC-001', 312.00, 3, true),
  ('SUP-IN-MRO', 'PP-OFC-002', 138.00, 3, true),
  ('SUP-IN-MRO', 'PP-PPE-001', 292.00, 5, false),
  ('SUP-IN-MRO', 'PP-ELEC-003', 41.00, 5, false),
  ('SUP-IN-MRO', 'PP-ELEC-001', 248.00, 6, false)
) AS p(sup_code, item_code, unit_price, lead_days, preferred)
JOIN suppliers s ON s.supplier_code = p.sup_code
JOIN items i ON i.item_code = p.item_code;

COMMIT;
