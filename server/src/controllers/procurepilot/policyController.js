import policyService from '../../services/procurepilot/policyService.js';
import {
  CATEGORY_LABELS,
  DEFAULT_ROLE_POLICY,
  PROCUREMENT_CATEGORIES
} from '../../config/procurementPolicyCatalog.js';
import { ROLE_LEVELS } from '../../config/procurePilotAccess.js';
import { getSpendAuditFeed } from '../../services/procurepilot/spendAuditService.js';

class PolicyController {
  async getCatalog(req, res) {
    try {
      res.json({
        success: true,
        data: {
          categories: PROCUREMENT_CATEGORIES.map((c) => ({
            id: c,
            label: CATEGORY_LABELS[c] || c
          })),
          role_levels: ROLE_LEVELS,
          default_role_policy: DEFAULT_ROLE_POLICY
        }
      });
    } catch (error) {
      console.error('getCatalog policy:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getMyPolicy(req, res) {
    try {
      const { roleLevel, policy } = await policyService.getEffectivePolicyForUser(req.user.id);
      const now = new Date();
      const ledger = await policyService.getMonthlyLedger(
        req.user.id,
        now.getFullYear(),
        now.getMonth() + 1,
        policy.currency
      ).catch((err) => (err.code === '42P01' ? { spent: 0, reserved: 0 } : Promise.reject(err)));

      res.json({
        success: true,
        data: {
          role_level: roleLevel,
          policy,
          monthly_ledger: {
            spent: ledger.spent,
            reserved: ledger.reserved,
            remaining: policy.max_monthly_budget != null
              ? Math.max(0, policy.max_monthly_budget - ledger.spent - ledger.reserved)
              : null
          }
        }
      });
    } catch (error) {
      console.error('getMyPolicy:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async listRolePolicies(req, res) {
    try {
      const rows = await policyService.listRolePolicies();
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('listRolePolicies:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateRolePolicy(req, res) {
    try {
      const roleLevel = Number(req.params.roleLevel);
      if (!Number.isInteger(roleLevel) || roleLevel < 1 || roleLevel > 5) {
        return res.status(400).json({ success: false, message: 'roleLevel must be 1–5' });
      }
      const row = await policyService.upsertRolePolicy(roleLevel, req.body, req.user.id);
      res.json({ success: true, data: row });
    } catch (error) {
      console.error('updateRolePolicy:', error);
      const status = error.code === '42P01' ? 503 : 500;
      res.status(status).json({
        success: false,
        message: error.code === '42P01'
          ? 'Policy tables not installed. Run scripts/procurepilot_policy_engine.sql'
          : error.message
      });
    }
  }

  async updateUserPolicy(req, res) {
    try {
      const userId = Number(req.params.userId);
      if (!Number.isInteger(userId)) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
      }
      const row = await policyService.upsertUserPolicy(userId, req.body, req.user.id);
      res.json({ success: true, data: row });
    } catch (error) {
      console.error('updateUserPolicy:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async spendAudit(req, res) {
    try {
      const limit = Number(req.query.limit) || 30;
      const data = await getSpendAuditFeed({ limit });
      res.json({ success: true, data });
    } catch (error) {
      console.error('spendAudit:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async evaluate(req, res) {
    try {
      const { request, offers, user_id: targetUserId } = req.body || {};
      if (!request || !Array.isArray(offers)) {
        return res.status(400).json({
          success: false,
          message: 'Body must include request and offers array'
        });
      }
      const result = await policyService.evaluateForUser(req.user.id, {
        request,
        offers,
        targetUserId
      });
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('policy evaluate:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

export default new PolicyController();
