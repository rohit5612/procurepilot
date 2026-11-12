import { query } from '../../database/connection.js';
import policyService from './policyService.js';
import procurementPolicyService from '../procurement/procurementPolicyService.js';

async function tableMissing(err) {
  return err?.code === '42P01';
}

export async function getSpendSnapshotForUser(userId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  let policy = { currency: 'INR', max_monthly_budget: null };
  let roleLevel = null;
  try {
    const effective = await policyService.getEffectivePolicyForUser(userId);
    policy = effective.policy;
    roleLevel = effective.roleLevel;
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  let ledger = { spent: 0, reserved: 0 };
  try {
    ledger = await procurementPolicyService.getLedger(null, userId, policy.currency || 'INR');
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  let ledgerRow = null;
  try {
    const { rows } = await query(
      `SELECT * FROM budget_ledger
       WHERE user_id = $1 AND period_year = $2 AND period_month = $3 AND currency = $4`,
      [userId, year, month, policy.currency || 'INR']
    );
    ledgerRow = rows[0] || null;
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  let commitments = [];
  try {
    const { rows } = await query(
      `SELECT id, reference_type, reference_id, amount, currency, status, procurement_category, created_at, updated_at
       FROM budget_commitments
       WHERE user_id = $1
       ORDER BY updated_at DESC
       LIMIT 20`,
      [userId]
    );
    commitments = rows;
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  let payments = [];
  try {
    const { rows } = await query(
      `SELECT id, purchase_request_id, paypal_order_id, paypal_capture_id,
              amount, currency, amount_inr, status, created_at, updated_at
       FROM payment_events
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [userId]
    );
    payments = rows;
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  let purchaseRequests = [];
  try {
    const { rows } = await query(
      `SELECT id, status, payment_status, selected_offer_id, amount_inr, checkout_currency, checkout_amount, created_at, updated_at
       FROM purchase_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 15`,
      [userId]
    );
    purchaseRequests = rows;
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  const maxMonthly = policy.max_monthly_budget != null ? Number(policy.max_monthly_budget) : null;
  const remaining =
    maxMonthly != null
      ? Math.max(0, maxMonthly - Number(ledger.spent) - Number(ledger.reserved))
      : null;

  return {
    period: { year, month },
    role_level: roleLevel,
    policy_currency: policy.currency || 'INR',
    max_monthly_budget: maxMonthly,
    ledger: {
      spent: Number(ledger.spent),
      reserved: Number(ledger.reserved),
      remaining,
      row: ledgerRow
    },
    commitments,
    payment_events: payments,
    purchase_requests: purchaseRequests
  };
}

export async function getSpendAuditFeed({ limit = 30 } = {}) {
  const lim = Math.min(100, Math.max(1, Number(limit) || 30));

  let payments = [];
  let commitments = [];
  try {
    const payRes = await query(
      `SELECT pe.*, u.email AS user_email, u.first_name, u.last_name
       FROM payment_events pe
       JOIN users u ON u.id = pe.user_id
       ORDER BY pe.created_at DESC
       LIMIT $1`,
      [lim]
    );
    payments = payRes.rows;
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  try {
    const comRes = await query(
      `SELECT bc.*, u.email AS user_email
       FROM budget_commitments bc
       JOIN users u ON u.id = bc.user_id
       WHERE bc.status IN ('reserved', 'committed')
       ORDER BY bc.updated_at DESC
       LIMIT $1`,
      [lim]
    );
    commitments = comRes.rows;
  } catch (err) {
    if (!(await tableMissing(err))) throw err;
  }

  return { payment_events: payments, open_commitments: commitments };
}
