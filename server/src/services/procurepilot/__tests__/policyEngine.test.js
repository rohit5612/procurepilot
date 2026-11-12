import {
  evaluateOffers,
  evaluatePurchaseEligibility,
  POLICY_DECISION_CODES,
  requiresHumanApproval,
  resolveEffectivePolicy
} from '../policyEngine.js';

const basePolicy = resolveEffectivePolicy({ roleLevel: 4 });

describe('policyEngine', () => {
  test('rejects offer over request budget', () => {
    const friday = new Date('2026-10-24T12:00:00Z');
    const thursday = new Date('2026-10-23T12:00:00Z');
    const result = evaluateOffers({
      policy: basePolicy,
      request: {
        maximum_budget: 80000,
        delivery_deadline: friday.toISOString(),
        procurement_category: 'office'
      },
      offers: [
        { id: 'A', price: 76000, delivery_date: friday.toISOString() },
        { id: 'B', price: 84000, delivery_date: thursday.toISOString() },
        { id: 'C', price: 72000, delivery_date: '2026-10-28T12:00:00Z' }
      ]
    });

    expect(result.offers.find((o) => o.offer_id === 'A').eligible).toBe(true);
    expect(result.offers.find((o) => o.offer_id === 'B').eligible).toBe(false);
    expect(result.offers.find((o) => o.offer_id === 'B').decision_code).toBe(
      POLICY_DECISION_CODES.OVER_REQUEST_BUDGET
    );
    expect(result.offers.find((o) => o.offer_id === 'C').eligible).toBe(false);
    expect(result.offers.find((o) => o.offer_id === 'C').decision_code).toBe(
      POLICY_DECISION_CODES.DELIVERY_AFTER_DEADLINE
    );
    expect(result.recommended_offer_id).toBe('A');
  });

  test('recommends cheapest eligible offer', () => {
    const result = evaluateOffers({
      policy: basePolicy,
      request: { maximum_budget: 100000, procurement_category: 'office' },
      offers: [
        { id: 'A', price: 90000 },
        { id: 'B', price: 70000 }
      ]
    });
    expect(result.recommended_offer_id).toBe('B');
  });

  test('blocks disallowed category', () => {
    const check = evaluatePurchaseEligibility({
      policy: basePolicy,
      procurementCategory: 'steel',
      amount: 10000
    });
    expect(check.allowed).toBe(false);
    expect(check.violations[0].code).toBe(POLICY_DECISION_CODES.CATEGORY_NOT_ALLOWED);
  });

  test('approval required for L4 above threshold', () => {
    const approval = requiresHumanApproval({
      policy: basePolicy,
      procurementCategory: 'office',
      amount: 60000,
      roleLevel: 4
    });
    expect(approval.required).toBe(true);
  });
});
