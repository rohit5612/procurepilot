/**
 * Deterministic procurement policy engine (no LLM).
 * AI may suggest values; this module is the authority for allow/deny and ranking.
 */

import {
  DEFAULT_CURRENCY,
  getDefaultPolicyForRoleLevel
} from '../../config/procurementPolicyCatalog.js';

export const POLICY_DECISION_CODES = {
  ELIGIBLE: 'ELIGIBLE',
  OVER_TRANSACTION_CAP: 'OVER_TRANSACTION_CAP',
  OVER_MONTHLY_BUDGET: 'OVER_MONTHLY_BUDGET',
  CATEGORY_NOT_ALLOWED: 'CATEGORY_NOT_ALLOWED',
  OVER_REQUEST_BUDGET: 'OVER_REQUEST_BUDGET',
  DELIVERY_AFTER_DEADLINE: 'DELIVERY_AFTER_DEADLINE',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  POLICY_BLOCKED: 'POLICY_BLOCKED'
};

/**
 * Merge policy layers: user override > role row > catalog default.
 * @param {object} params
 * @param {number} params.roleLevel
 * @param {object|null} params.rolePolicyRow
 * @param {object|null} params.userPolicyRow
 */
export function resolveEffectivePolicy({ roleLevel, rolePolicyRow = null, userPolicyRow = null }) {
  const base = getDefaultPolicyForRoleLevel(roleLevel);
  const fromRole = rolePolicyRow ? normalizePolicyRow(rolePolicyRow) : null;
  const fromUser = userPolicyRow ? normalizePolicyRow(userPolicyRow) : null;

  const merged = {
    ...base,
    ...(fromRole || {}),
    ...(fromUser || {}),
    currency: (fromUser?.currency || fromRole?.currency || base.currency || DEFAULT_CURRENCY),
    role_level: roleLevel,
    source: fromUser ? 'user_override' : fromRole ? 'role_policy' : base.source
  };

  if (fromUser?.id) merged.user_policy_id = fromUser.id;
  if (fromRole?.id) merged.role_policy_id = fromRole.id;

  return merged;
}

function normalizePolicyRow(row) {
  return {
    id: row.id,
    max_per_transaction: toNumber(row.max_per_transaction),
    max_monthly_budget: toNumber(row.max_monthly_budget),
    allowed_categories: parseJsonArray(row.allowed_categories),
    auto_approve_categories: parseJsonArray(row.auto_approve_categories),
    auto_approve_max_amount: toNumber(row.auto_approve_max_amount) ?? 0,
    approval_required_above: row.approval_required_above != null
      ? toNumber(row.approval_required_above)
      : null,
    currency: row.currency || DEFAULT_CURRENCY,
    notes: row.notes || null
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Check whether a purchase amount is allowed under spend caps (before offer compare).
 */
export function evaluatePurchaseEligibility({
  policy,
  procurementCategory,
  amount,
  monthlySpent = 0,
  monthlyReserved = 0
}) {
  const violations = [];
  const amt = toNumber(amount);

  if (amt === null || amt < 0) {
    violations.push({
      code: POLICY_DECISION_CODES.INVALID_AMOUNT,
      message: 'Purchase amount must be a non-negative number'
    });
    return { allowed: false, violations };
  }

  const category = (procurementCategory || 'other').toLowerCase();
  const allowed = policy.allowed_categories || [];
  if (allowed.length > 0 && !allowed.includes(category)) {
    violations.push({
      code: POLICY_DECISION_CODES.CATEGORY_NOT_ALLOWED,
      message: `Category "${category}" is not in your allowed procurement segments`,
      category
    });
  }

  if (policy.max_per_transaction != null && amt > policy.max_per_transaction) {
    violations.push({
      code: POLICY_DECISION_CODES.OVER_TRANSACTION_CAP,
      message: `Amount exceeds per-transaction cap (${policy.max_per_transaction} ${policy.currency})`,
      cap: policy.max_per_transaction
    });
  }

  const monthlyCap = policy.max_monthly_budget;
  if (monthlyCap != null) {
    const projected = monthlySpent + monthlyReserved + amt;
    if (projected > monthlyCap) {
      violations.push({
        code: POLICY_DECISION_CODES.OVER_MONTHLY_BUDGET,
        message: `Amount would exceed monthly budget (remaining ${Math.max(0, monthlyCap - monthlySpent - monthlyReserved)} ${policy.currency})`,
        monthly_cap: monthlyCap,
        monthly_spent: monthlySpent,
        monthly_reserved: monthlyReserved
      });
    }
  }

  return { allowed: violations.length === 0, violations };
}

/**
 * Evaluate supplier offers against request constraints and user policy.
 */
export function evaluateOffers({
  policy,
  request,
  offers = [],
  monthlySpent = 0,
  monthlyReserved = 0
}) {
  const maximumBudget = toNumber(request.maximum_budget ?? request.maximumBudget);
  const deadline = parseDate(request.delivery_deadline ?? request.deliveryDeadline);
  const category = (request.procurement_category ?? request.procurementCategory ?? 'other').toLowerCase();
  const currency = request.currency || policy.currency || DEFAULT_CURRENCY;

  const purchaseCheck = evaluatePurchaseEligibility({
    policy,
    procurementCategory: category,
    amount: maximumBudget ?? 0,
    monthlySpent,
    monthlyReserved
  });

  const results = offers.map((offer, index) => {
    const offerId = offer.id ?? offer.offer_id ?? `offer-${index}`;
    const price = toNumber(offer.price ?? offer.total_price ?? offer.amount);
    const delivery = parseDate(offer.delivery_date ?? offer.deliveryDate);
    const violations = [];

    if (price === null || price < 0) {
      violations.push({
        code: POLICY_DECISION_CODES.INVALID_AMOUNT,
        message: 'Offer price is invalid'
      });
    } else {
      const offerEligibility = evaluatePurchaseEligibility({
        policy,
        procurementCategory: category,
        amount: price,
        monthlySpent,
        monthlyReserved
      });
      violations.push(...offerEligibility.violations);

      if (maximumBudget != null && price > maximumBudget) {
        violations.push({
          code: POLICY_DECISION_CODES.OVER_REQUEST_BUDGET,
          message: `Price exceeds request maximum budget (${maximumBudget} ${currency})`,
          maximum_budget: maximumBudget
        });
      }
    }

    if (deadline && delivery && delivery > deadline) {
      violations.push({
        code: POLICY_DECISION_CODES.DELIVERY_AFTER_DEADLINE,
        message: 'Delivery date is after the required deadline',
        delivery_date: delivery.toISOString(),
        deadline: deadline.toISOString()
      });
    }

    const eligible = violations.length === 0;
    return {
      offer_id: offerId,
      supplier_name: offer.supplier_name ?? offer.supplierName ?? null,
      price,
      delivery_date: delivery ? delivery.toISOString() : null,
      eligible,
      violations,
      decision_code: eligible ? POLICY_DECISION_CODES.ELIGIBLE : violations[0]?.code
    };
  });

  const eligibleOffers = results
    .filter((r) => r.eligible)
    .sort((a, b) => {
      if (a.price !== b.price) return (a.price ?? 0) - (b.price ?? 0);
      const ad = a.delivery_date ? new Date(a.delivery_date).getTime() : Infinity;
      const bd = b.delivery_date ? new Date(b.delivery_date).getTime() : Infinity;
      return ad - bd;
    });

  const recommended = eligibleOffers[0] ?? null;

  return {
    request: {
      procurement_category: category,
      maximum_budget: maximumBudget,
      delivery_deadline: deadline ? deadline.toISOString() : null,
      currency
    },
    policy_source: policy.source,
    request_level_violations: purchaseCheck.violations,
    offers: results,
    eligible_count: eligibleOffers.length,
    recommended_offer_id: recommended?.offer_id ?? null,
    ranked_eligible_offer_ids: eligibleOffers.map((o) => o.offer_id)
  };
}

/**
 * Whether a human approver is required before payment.
 */
export function requiresHumanApproval({
  policy,
  procurementCategory,
  amount,
  roleLevel,
  requestFlag
}) {
  if (requestFlag === true || requestFlag === 'true') {
    return { required: true, reason: 'request_flagged' };
  }

  const amt = toNumber(amount) ?? 0;
  const category = (procurementCategory || 'other').toLowerCase();
  const autoCats = policy.auto_approve_categories || [];
  const autoMax = policy.auto_approve_max_amount ?? 0;

  if (
    autoCats.includes(category) &&
    autoMax > 0 &&
    amt <= autoMax &&
    Number(roleLevel) >= 3
  ) {
    return { required: false, reason: 'category_auto_approve' };
  }

  if (policy.approval_required_above != null && amt > policy.approval_required_above) {
    return { required: true, reason: 'above_approval_threshold' };
  }

  if (Number(roleLevel) >= 3) {
    return { required: true, reason: 'role_level_requires_approval' };
  }

  return { required: false, reason: 'within_authority' };
}
