-- Seed: common Indian payroll components + one standard structure
-- Safe to run multiple times (idempotent via ON CONFLICT).
BEGIN;

-- Components
INSERT INTO hr_payroll_component (code, name, type, description, is_taxable, is_statutory, is_active)
VALUES
  -- Earnings
  ('BASIC', 'Basic', 'earning', 'Basic pay (PF wage base in most setups).', TRUE, FALSE, TRUE),
  ('HRA', 'House Rent Allowance', 'earning', 'HRA (taxable subject to exemptions).', TRUE, FALSE, TRUE),
  ('SPL', 'Special Allowance', 'earning', 'Residual balancing allowance.', TRUE, FALSE, TRUE),
  ('CONV', 'Conveyance Allowance', 'earning', 'Conveyance allowance.', TRUE, FALSE, TRUE),
  ('MED', 'Medical Allowance', 'earning', 'Medical allowance (taxable).', TRUE, FALSE, TRUE),
  ('LTA', 'Leave Travel Allowance', 'earning', 'LTA (taxable subject to exemptions).', TRUE, FALSE, TRUE),
  ('BONUS', 'Bonus', 'earning', 'Bonus / ex-gratia (typically periodic input).', TRUE, FALSE, TRUE),

  -- Statutory deductions (employee-side; computed on pay-run)
  ('PF_EMP', 'PF (Employee)', 'deduction', 'Employee EPF contribution.', FALSE, TRUE, TRUE),
  ('ESI_EMP', 'ESI (Employee)', 'deduction', 'Employee ESI contribution.', FALSE, TRUE, TRUE),
  ('PT', 'Professional Tax', 'deduction', 'State professional tax.', FALSE, TRUE, TRUE),

  -- Other common deductions (manual)
  ('TDS', 'TDS', 'deduction', 'Income tax deducted at source (manual for now).', FALSE, FALSE, TRUE),
  ('ADV', 'Salary Advance', 'deduction', 'Advance recovery.', FALSE, FALSE, TRUE),
  ('LOP', 'Loss of Pay', 'deduction', 'Leave/attendance driven LOP (manual for now).', FALSE, FALSE, TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  description = EXCLUDED.description,
  is_taxable = EXCLUDED.is_taxable,
  is_statutory = EXCLUDED.is_statutory,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Structure: "IND-STD" (fixed amounts; tune as needed)
INSERT INTO hr_payroll_structure (code, name, description, is_active)
VALUES ('IND-STD', 'India - Standard (Fixed)', 'Common Indian salary structure template (fixed amounts).', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

WITH s AS (
  SELECT id FROM hr_payroll_structure WHERE code = 'IND-STD'
),
comp AS (
  SELECT code, id FROM hr_payroll_component WHERE code IN ('BASIC','HRA','SPL','CONV','MED','LTA')
),
src AS (
  -- Example monthly amounts (edit after seeding)
  SELECT 'BASIC'::text AS code, 25000::numeric AS amount, 10::int AS sort_order
  UNION ALL SELECT 'HRA', 12500, 20
  UNION ALL SELECT 'CONV', 1600, 30
  UNION ALL SELECT 'MED', 1250, 40
  UNION ALL SELECT 'LTA', 2000, 50
  UNION ALL SELECT 'SPL', 7650, 60
)
INSERT INTO hr_payroll_structure_line (structure_id, component_id, calc_type, amount, sort_order, is_active)
SELECT s.id, c.id, 'fixed', src.amount, src.sort_order, TRUE
FROM s
JOIN src ON TRUE
JOIN comp c ON c.code = src.code
ON CONFLICT (structure_id, component_id) DO UPDATE SET
  calc_type = EXCLUDED.calc_type,
  amount = EXCLUDED.amount,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

COMMIT;

