import { query, transaction } from '../../database/connection.js';
import {
  DEFAULT_ROLE_POLICY,
  PROCUREMENT_CATEGORIES,
  getDefaultPolicyForRoleLevel
} from '../../config/procurementPolicyCatalog.js';
import {
  evaluateOffers,
  requiresHumanApproval,
  resolveEffectivePolicy
} from './policyEngine.js';

function coerceRequestApprovalFlag(value) {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  return false;
}

class PolicyService {
  async getUserRoleLevel(userId) {
    const superRes = await query(
      `SELECT is_superuser FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (superRes.rows[0]?.is_superuser) {
      return 1;
    }

    const result = await query(
      `SELECT MIN(r.role_level) AS role_level
       FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND r.is_active = true`,
      [userId]
    );
    const level = result.rows[0]?.role_level;
    return Number.isInteger(level) ? level : 5;
  }

  async getRolePolicyRow(roleLevel) {
    const result = await query(
      `SELECT * FROM procurement_role_policies WHERE role_level = $1`,
      [roleLevel]
    );
    return result.rows[0] || null;
  }

  async getUserPolicyRow(userId) {
    const result = await query(
      `SELECT * FROM user_procurement_policies WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async getMonthlyLedger(userId, year, month, currency = 'INR') {
    const result = await query(
      `SELECT spent_amount, reserved_amount
       FROM budget_ledger
       WHERE user_id = $1 AND period_year = $2 AND period_month = $3 AND currency = $4`,
      [userId, year, month, currency]
    );
    const row = result.rows[0];
    return {
      spent: Number(row?.spent_amount || 0),
      reserved: Number(row?.reserved_amount || 0)
    };
  }

  async getEffectivePolicyForUser(userId) {
    const roleLevel = await this.getUserRoleLevel(userId);
    let rolePolicyRow = null;
    let userPolicyRow = null;
    try {
      rolePolicyRow = await this.getRolePolicyRow(roleLevel);
      userPolicyRow = await this.getUserPolicyRow(userId);
    } catch (err) {
      if (err.code !== '42P01') throw err;
    }
    const policy = resolveEffectivePolicy({
      roleLevel,
      rolePolicyRow,
      userPolicyRow
    });
    return { roleLevel, policy };
  }

  async listRolePolicies() {
    try {
      const result = await query(
        `SELECT * FROM procurement_role_policies ORDER BY role_level`
      );
      if (result.rows.length === 0) {
        return Object.entries(DEFAULT_ROLE_POLICY).map(([level, def]) => ({
          role_level: Number(level),
          ...def,
          currency: 'INR',
          source: 'catalog_default',
          id: null
        }));
      }
      return result.rows;
    } catch (err) {
      if (err.code === '42P01') {
        return Object.entries(DEFAULT_ROLE_POLICY).map(([level, def]) => ({
          role_level: Number(level),
          ...def,
          currency: 'INR',
          source: 'catalog_default',
          id: null
        }));
      }
      throw err;
    }
  }

  async upsertRolePolicy(roleLevel, data, actorUserId) {
    const level = Number(roleLevel);
    const payload = this.normalizePolicyPayload(data);
    return transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO procurement_role_policies (
          role_level, max_per_transaction, max_monthly_budget, currency,
          allowed_categories, auto_approve_categories, auto_approve_max_amount,
          approval_required_above, notes, updated_by, updated_at
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,NOW())
        ON CONFLICT (role_level) DO UPDATE SET
          max_per_transaction = EXCLUDED.max_per_transaction,
          max_monthly_budget = EXCLUDED.max_monthly_budget,
          currency = EXCLUDED.currency,
          allowed_categories = EXCLUDED.allowed_categories,
          auto_approve_categories = EXCLUDED.auto_approve_categories,
          auto_approve_max_amount = EXCLUDED.auto_approve_max_amount,
          approval_required_above = EXCLUDED.approval_required_above,
          notes = EXCLUDED.notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *`,
        [
          level,
          payload.max_per_transaction,
          payload.max_monthly_budget,
          payload.currency,
          JSON.stringify(payload.allowed_categories),
          JSON.stringify(payload.auto_approve_categories),
          payload.auto_approve_max_amount,
          payload.approval_required_above,
          payload.notes,
          actorUserId
        ]
      );
      await client.query(
        `INSERT INTO policy_audit_events (actor_user_id, event_type, payload)
         VALUES ($1, 'role_policy_upsert', $2::jsonb)`,
        [actorUserId, JSON.stringify({ role_level: level })]
      );
      return result.rows[0];
    });
  }

  async upsertUserPolicy(userId, data, actorUserId) {
    const payload = this.normalizePolicyPayload(data, { partial: true });
    return transaction(async (client) => {
      const result = await client.query(
        `INSERT INTO user_procurement_policies (
          user_id, max_per_transaction, max_monthly_budget, currency,
          allowed_categories, auto_approve_categories, auto_approve_max_amount,
          approval_required_above, notes, updated_by, updated_at
        ) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10,NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          max_per_transaction = COALESCE(EXCLUDED.max_per_transaction, user_procurement_policies.max_per_transaction),
          max_monthly_budget = COALESCE(EXCLUDED.max_monthly_budget, user_procurement_policies.max_monthly_budget),
          currency = EXCLUDED.currency,
          allowed_categories = COALESCE(EXCLUDED.allowed_categories, user_procurement_policies.allowed_categories),
          auto_approve_categories = COALESCE(EXCLUDED.auto_approve_categories, user_procurement_policies.auto_approve_categories),
          auto_approve_max_amount = COALESCE(EXCLUDED.auto_approve_max_amount, user_procurement_policies.auto_approve_max_amount),
          approval_required_above = EXCLUDED.approval_required_above,
          notes = EXCLUDED.notes,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
        RETURNING *`,
        [
          userId,
          payload.max_per_transaction,
          payload.max_monthly_budget,
          payload.currency,
          payload.allowed_categories ? JSON.stringify(payload.allowed_categories) : null,
          payload.auto_approve_categories ? JSON.stringify(payload.auto_approve_categories) : null,
          payload.auto_approve_max_amount,
          payload.approval_required_above,
          payload.notes,
          actorUserId
        ]
      );
      await client.query(
        `INSERT INTO policy_audit_events (actor_user_id, event_type, payload)
         VALUES ($1, 'user_policy_upsert', $2::jsonb)`,
        [actorUserId, JSON.stringify({ user_id: userId })]
      );
      return result.rows[0];
    });
  }

  normalizePolicyPayload(data, { partial = false } = {}) {
    const base = partial ? {} : getDefaultPolicyForRoleLevel(5);
    const allowed = data.allowed_categories ?? data.allowedCategories ?? base.allowed_categories;
    const autoApprove = data.auto_approve_categories ?? data.autoApproveCategories ?? base.auto_approve_categories;
    return {
      max_per_transaction: data.max_per_transaction ?? data.maxPerTransaction ?? base.max_per_transaction,
      max_monthly_budget: data.max_monthly_budget ?? data.maxMonthlyBudget ?? base.max_monthly_budget,
      currency: data.currency || base.currency || 'INR',
      allowed_categories: Array.isArray(allowed) ? allowed : PROCUREMENT_CATEGORIES,
      auto_approve_categories: Array.isArray(autoApprove) ? autoApprove : [],
      auto_approve_max_amount: data.auto_approve_max_amount ?? data.autoApproveMaxAmount ?? base.auto_approve_max_amount ?? 0,
      approval_required_above: data.approval_required_above ?? data.approvalRequiredAbove ?? base.approval_required_above,
      notes: data.notes ?? null
    };
  }

  async evaluateForUser(userId, { request, offers, targetUserId }) {
    const subjectId = targetUserId || userId;
    const { roleLevel, policy } = await this.getEffectivePolicyForUser(subjectId);
    const now = new Date();
    const ledger = await this.getMonthlyLedger(
      subjectId,
      now.getFullYear(),
      now.getMonth() + 1,
      policy.currency
    ).catch((err) => {
      if (err.code === '42P01') return { spent: 0, reserved: 0 };
      throw err;
    });

    const comparison = evaluateOffers({
      policy,
      request,
      offers,
      monthlySpent: ledger.spent,
      monthlyReserved: ledger.reserved
    });

    const selectedAmount = comparison.recommended_offer_id
      ? comparison.offers.find((o) => o.offer_id === comparison.recommended_offer_id)?.price
      : request.maximum_budget ?? request.maximumBudget;

    const requestFlag = coerceRequestApprovalFlag(
      request.requires_human_approval ?? request.requiresHumanApproval
    );

    const approval = requiresHumanApproval({
      policy,
      procurementCategory: comparison.request.procurement_category,
      amount: selectedAmount,
      roleLevel,
      requestFlag
    });

    return {
      user_id: subjectId,
      role_level: roleLevel,
      effective_policy: policy,
      monthly_ledger: ledger,
      ...comparison,
      approval
    };
  }

  getCatalog() {
    return { categories: PROCUREMENT_CATEGORIES };
  }
}

export default new PolicyService();
