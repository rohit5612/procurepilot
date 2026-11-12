INSERT INTO procurement_role_policies (
  role_level, max_per_transaction, max_monthly_budget, currency,
  allowed_categories, auto_approve_categories, auto_approve_max_amount, approval_required_above, notes
) VALUES
  (1, 2000000, 8000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 25000, 150000, 'L1 — org admin / superuser map'),
  (2, 5000000, 15000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 50000, 500000, 'L2 — department head approvals'),
  (3, 1000000, 4000000, 'INR', '["office","mro","steel","electrical","ppe","other"]', '["office"]', 25000, 150000, 'L3 — manager submit/no PO approve'),
  (4, 300000, 1200000, 'INR', '["office","mro","ppe","other"]', '[]', 0, 75000, 'L4 — requester'),
  (5, 75000, 300000, 'INR', '["office","mro","other"]', '[]', 0, 25000, 'L5 — basic user')
ON CONFLICT (role_level) DO NOTHING;
