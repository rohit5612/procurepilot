INSERT INTO procurement_role_policies (
  role_level, max_per_transaction, max_monthly_budget, currency,
  allowed_categories, auto_approve_categories, auto_approve_max_amount, approval_required_above, notes
) VALUES
  (1, 10000000, 50000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 100000, NULL, 'L1 org admin'),
  (2, 5000000, 20000000, 'INR', '["office","mro","steel","infra","electrical","ppe","other"]', '["office"]', 50000, 500000, 'L2 department head'),
  (3, 500000, 2000000, 'INR', '["office","mro","ppe","other"]', '["office"]', 25000, 100000, 'L3 manager'),
  (4, 200000, 800000, 'INR', '["office","mro","ppe","other"]', '[]', 0, 50000, 'L4 requester'),
  (5, 50000, 200000, 'INR', '["office","mro","other"]', '[]', 0, 25000, 'L5 basic')
ON CONFLICT (role_level) DO NOTHING;
