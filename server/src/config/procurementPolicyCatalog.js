/**
 * Procurement policy catalog — categories and default caps by role level (L1–L5).
 * Admins can override per role in DB; user-level rows override role rows.
 */

export const DEFAULT_CURRENCY = 'INR';

/** @type {readonly string[]} */
export const PROCUREMENT_CATEGORIES = [
  'office',
  'mro',
  'steel',
  'infra',
  'electrical',
  'ppe',
  'other'
];

export const CATEGORY_LABELS = {
  office: 'Office supplies',
  mro: 'MRO / consumables',
  steel: 'Steel & structural',
  infra: 'Infrastructure / civil',
  electrical: 'Electrical',
  ppe: 'PPE & safety',
  other: 'Other'
};

/**
 * Seeded defaults when no DB row exists for a role level.
 * Amounts in INR (whole rupees).
 */
export const DEFAULT_ROLE_POLICY = {
  1: {
    max_per_transaction: 10_000_000,
    max_monthly_budget: 50_000_000,
    allowed_categories: [...PROCUREMENT_CATEGORIES],
    auto_approve_categories: ['office'],
    auto_approve_max_amount: 100_000,
    approval_required_above: null
  },
  2: {
    max_per_transaction: 5_000_000,
    max_monthly_budget: 20_000_000,
    allowed_categories: [...PROCUREMENT_CATEGORIES],
    auto_approve_categories: ['office'],
    auto_approve_max_amount: 50_000,
    approval_required_above: 500_000
  },
  3: {
    max_per_transaction: 500_000,
    max_monthly_budget: 2_000_000,
    allowed_categories: ['office', 'mro', 'ppe', 'other'],
    auto_approve_categories: ['office'],
    auto_approve_max_amount: 25_000,
    approval_required_above: 100_000
  },
  4: {
    max_per_transaction: 200_000,
    max_monthly_budget: 800_000,
    allowed_categories: ['office', 'mro', 'ppe', 'other'],
    auto_approve_categories: [],
    auto_approve_max_amount: 0,
    approval_required_above: 50_000
  },
  5: {
    max_per_transaction: 50_000,
    max_monthly_budget: 200_000,
    allowed_categories: ['office', 'mro', 'other'],
    auto_approve_categories: [],
    auto_approve_max_amount: 0,
    approval_required_above: 25_000
  }
};

export function getDefaultPolicyForRoleLevel(roleLevel) {
  const level = Number(roleLevel);
  if (DEFAULT_ROLE_POLICY[level]) {
    return { ...DEFAULT_ROLE_POLICY[level], role_level: level, source: 'catalog_default' };
  }
  return { ...DEFAULT_ROLE_POLICY[5], role_level: 5, source: 'catalog_default' };
}
