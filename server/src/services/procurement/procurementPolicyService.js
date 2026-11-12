/**
 * Bridges ERP documents (PR/PO) to ProcurePilot policy engine + budget_ledger.
 */

import policyService from '../procurepilot/policyService.js';
import { evaluatePurchaseEligibility, POLICY_DECISION_CODES } from '../procurepilot/policyEngine.js';
import { query } from '../../database/connection.js';

export class PolicyViolationError extends Error {
  constructor(violations, message = 'Procurement policy violation') {
    super(message);
    this.name = 'PolicyViolationError';
    this.violations = violations;
    this.code = 'POLICY_VIOLATION';
  }
}

function periodParts(date = new Date()) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1
  };
}

async function tableMissing(err) {
  return err?.code === '42P01';
}

class ProcurementPolicyService {
  async getLedger(client, userId, currency) {
    const { year, month } = periodParts();
    const runner = client ? client.query.bind(client) : query;
    try {
      const { rows } = await runner(
        `SELECT spent_amount, reserved_amount FROM budget_ledger
         WHERE user_id = $1 AND period_year = $2 AND period_month = $3 AND currency = $4`,
        [userId, year, month, currency]
      );
      const row = rows[0];
      return {
        spent: Number(row?.spent_amount || 0),
        reserved: Number(row?.reserved_amount || 0)
      };
    } catch (err) {
      if (await tableMissing(err)) return { spent: 0, reserved: 0 };
      throw err;
    }
  }

  async upsertLedgerRow(client, userId, currency, deltaSpent = 0, deltaReserved = 0) {
    const { year, month } = periodParts();
    const runner = client.query.bind(client);
    await runner(
      `INSERT INTO budget_ledger (user_id, period_year, period_month, currency, spent_amount, reserved_amount)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, period_year, period_month, currency)
       DO UPDATE SET
         spent_amount = budget_ledger.spent_amount + EXCLUDED.spent_amount,
         reserved_amount = budget_ledger.reserved_amount + EXCLUDED.reserved_amount,
         updated_at = NOW()`,
      [userId, year, month, currency, deltaSpent, deltaReserved]
    );
  }

  async logPolicyEvent(client, actorUserId, eventType, payload) {
    const runner = client ? client.query.bind(client) : query;
    try {
      await runner(
        `INSERT INTO policy_audit_events (actor_user_id, event_type, payload)
         VALUES ($1, $2, $3::jsonb)`,
        [actorUserId, eventType, JSON.stringify(payload)]
      );
    } catch (err) {
      if (!(await tableMissing(err))) throw err;
    }
  }

  async assertEligible(client, userId, { amount, category = 'other', actorUserId = null }) {
    const amt = Number(amount || 0);
    if (!Number.isFinite(amt) || amt < 0) {
      throw new PolicyViolationError([{ code: POLICY_DECISION_CODES.INVALID_AMOUNT, message: 'Invalid amount' }]);
    }

    let policy;
    try {
      ({ policy } = await policyService.getEffectivePolicyForUser(userId));
    } catch (err) {
      if (await tableMissing(err)) return { allowed: true, skipped: true };
      throw err;
    }

    const ledger = await this.getLedger(client, userId, policy.currency);
    const result = evaluatePurchaseEligibility({
      policy,
      procurementCategory: category,
      amount: amt,
      monthlySpent: ledger.spent,
      monthlyReserved: ledger.reserved
    });

    if (!result.allowed) {
      await this.logPolicyEvent(client, actorUserId || userId, 'erp_policy_blocked', {
        user_id: userId,
        amount: amt,
        category,
        violations: result.violations
      });
      throw new PolicyViolationError(result.violations);
    }

    return { policy, ledger };
  }

  async getCommitment(client, referenceType, referenceId) {
    const runner = client.query.bind(client);
    try {
      const { rows } = await runner(
        `SELECT * FROM budget_commitments WHERE reference_type = $1 AND reference_id = $2`,
        [referenceType, referenceId]
      );
      return rows[0] || null;
    } catch (err) {
      if (await tableMissing(err)) return null;
      throw err;
    }
  }

  async reserveForDocument(client, userId, {
    referenceType,
    referenceId,
    amount,
    category = 'other',
    actorUserId
  }) {
    const existing = await this.getCommitment(client, referenceType, referenceId);
    if (existing?.status === 'reserved' || existing?.status === 'committed') return existing;

    const { policy } = await this.assertEligible(client, userId, {
      amount,
      category,
      actorUserId
    });

    const amt = Number(amount || 0);
    const runner = client.query.bind(client);
    await runner(
      `INSERT INTO budget_commitments (
         user_id, reference_type, reference_id, amount, currency, status, procurement_category
       ) VALUES ($1, $2, $3, $4, $5, 'reserved', $6)
       ON CONFLICT (reference_type, reference_id)
       DO UPDATE SET
         amount = EXCLUDED.amount,
         status = CASE WHEN budget_commitments.status = 'released' THEN 'reserved' ELSE budget_commitments.status END,
         updated_at = NOW()`,
      [userId, referenceType, referenceId, amt, policy.currency, category]
    );
    await this.upsertLedgerRow(client, userId, policy.currency, 0, amt);
    await this.logPolicyEvent(client, actorUserId || userId, 'budget_reserved', {
      reference_type: referenceType,
      reference_id: referenceId,
      amount: amt,
      currency: policy.currency
    });
  }

  async commitDocument(client, referenceType, referenceId, actorUserId) {
    const commitment = await this.getCommitment(client, referenceType, referenceId);
    if (!commitment || commitment.status !== 'reserved') return;

    const amt = Number(commitment.amount || 0);
    await client.query(
      `UPDATE budget_commitments SET status = 'committed', updated_at = NOW()
       WHERE reference_type = $1 AND reference_id = $2`,
      [referenceType, referenceId]
    );
    await this.upsertLedgerRow(client, commitment.user_id, commitment.currency, amt, -amt);
    await this.logPolicyEvent(client, actorUserId, 'budget_committed', {
      reference_type: referenceType,
      reference_id: referenceId,
      amount: amt
    });
  }

  async releaseDocument(client, referenceType, referenceId, actorUserId) {
    const commitment = await this.getCommitment(client, referenceType, referenceId);
    if (!commitment || commitment.status !== 'reserved') return;

    const amt = Number(commitment.amount || 0);
    await client.query(
      `UPDATE budget_commitments SET status = 'released', updated_at = NOW()
       WHERE reference_type = $1 AND reference_id = $2`,
      [referenceType, referenceId]
    );
    await this.upsertLedgerRow(client, commitment.user_id, commitment.currency, 0, -amt);
    await this.logPolicyEvent(client, actorUserId, 'budget_released', {
      reference_type: referenceType,
      reference_id: referenceId,
      amount: amt
    });
  }

  /**
   * PO linked to an approved PR: spend was committed on PR approval.
   */
  async hasCommittedParentRequisition(client, requisitionId) {
    if (!requisitionId) return false;
    const c = await this.getCommitment(client, 'requisition', requisitionId);
    return c?.status === 'committed';
  }
}

export default new ProcurementPolicyService();
