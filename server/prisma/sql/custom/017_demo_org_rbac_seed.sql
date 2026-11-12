-- Single Procurement department, enterprise policy caps (L1 = org admin; superuser maps to L1 in app).
-- Role rows are created by scripts/db/reset-demo-org-rbac.js via template API.

BEGIN;

-- Must clear role assignments before dropping departments (fk_user_roles_department)
DELETE FROM user_roles;
DELETE FROM role_permissions;
DELETE FROM roles;

INSERT INTO procurement_role_policies (
  role_level, max_per_transaction, max_monthly_budget, currency,
  allowed_categories, auto_approve_categories, auto_approve_max_amount, approval_required_above, notes
) VALUES
  (1, 2000000, 8000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 25000, 150000, 'L1 — org admin / superuser map'),
  (2, 5000000, 15000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 50000, 500000, 'L2 — department head approvals'),
  (3, 1000000, 4000000, 'INR', '["office","mro","steel","electrical","ppe","other"]', '["office"]', 25000, 150000, 'L3 — manager submit/no PO approve'),
  (4, 300000, 1200000, 'INR', '["office","mro","ppe","other"]', '[]', 0, 75000, 'L4 — requester'),
  (5, 75000, 300000, 'INR', '["office","mro","other"]', '[]', 0, 25000, 'L5 — basic user')
ON CONFLICT (role_level) DO UPDATE SET
  max_per_transaction = EXCLUDED.max_per_transaction,
  max_monthly_budget = EXCLUDED.max_monthly_budget,
  currency = EXCLUDED.currency,
  allowed_categories = EXCLUDED.allowed_categories,
  auto_approve_categories = EXCLUDED.auto_approve_categories,
  auto_approve_max_amount = EXCLUDED.auto_approve_max_amount,
  approval_required_above = EXCLUDED.approval_required_above,
  notes = EXCLUDED.notes,
  updated_at = NOW();

INSERT INTO departments (name, display_name, description, department_code, is_active, created_by, updated_by)
VALUES (
  'procurement',
  'Procurement',
  'Single demo department — assign users to L1–L5 template roles manually',
  'PROC',
  true,
  1,
  1
)
ON CONFLICT (department_code) DO UPDATE SET
  name = EXCLUDED.name,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = NOW();

-- Retarget transactional rows before removing other departments
UPDATE requisitions r
SET department_id = d.id
FROM departments d
WHERE d.department_code = 'PROC'
  AND (r.department_id IS DISTINCT FROM d.id);

DELETE FROM departments
WHERE department_code IS DISTINCT FROM 'PROC' OR department_code IS NULL;

COMMIT;
