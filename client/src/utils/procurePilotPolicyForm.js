/**
 * @typedef {import('../types/procurePilotPolicy').PolicyFormDraft} PolicyFormDraft
 * @typedef {import('../types/procurePilotPolicy').PolicySavePayload} PolicySavePayload
 * @typedef {import('../types/procurePilotPolicy').PolicyValidationResult} PolicyValidationResult
 * @typedef {import('../types/procurePilotPolicy').RolePolicyRecord} RolePolicyRecord
 * @typedef {import('../types/procurePilotPolicy').ProcurementCategoryId} ProcurementCategoryId
 */

/** @type {readonly ProcurementCategoryId[]} */
export const PROCUREMENT_CATEGORY_IDS = [
  'office',
  'mro',
  'steel',
  'infra',
  'electrical',
  'ppe',
  'other'
];

/**
 * @param {unknown} raw
 * @returns {ProcurementCategoryId[]}
 */
export function parseCategories(raw) {
  if (Array.isArray(raw)) {
    return raw.filter((c) => typeof c === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((c) => typeof c === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * @param {RolePolicyRecord | null | undefined} row
 * @returns {PolicyFormDraft}
 */
export function rolePolicyToDraft(row) {
  if (!row) {
    return emptyDraft();
  }
  return {
    max_per_transaction: String(row.max_per_transaction ?? ''),
    max_monthly_budget: String(row.max_monthly_budget ?? ''),
    auto_approve_max_amount: String(row.auto_approve_max_amount ?? 0),
    approval_required_above:
      row.approval_required_above == null || row.approval_required_above === ''
        ? ''
        : String(row.approval_required_above),
    allowed_categories: parseCategories(row.allowed_categories),
    auto_approve_categories: parseCategories(row.auto_approve_categories),
    notes: row.notes || ''
  };
}

/** @returns {PolicyFormDraft} */
export function emptyDraft() {
  return {
    max_per_transaction: '',
    max_monthly_budget: '',
    auto_approve_max_amount: '0',
    approval_required_above: '',
    allowed_categories: [],
    auto_approve_categories: [],
    notes: ''
  };
}

/**
 * @param {string} value
 * @returns {number | null}
 */
function parseAmount(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {PolicyFormDraft} draft
 * @returns {PolicyValidationResult}
 */
export function validatePolicyDraft(draft) {
  /** @type {PolicyValidationResult} */
  const result = { valid: true, errors: {}, warnings: {} };

  const perTxn = parseAmount(draft.max_per_transaction);
  const monthly = parseAmount(draft.max_monthly_budget);
  const autoMax = parseAmount(draft.auto_approve_max_amount);
  const approvalAbove = draft.approval_required_above === ''
    ? null
    : parseAmount(draft.approval_required_above);

  if (perTxn === null || perTxn < 0) {
    result.errors.max_per_transaction = 'Enter a valid per-transaction cap (≥ 0).';
  }
  if (monthly === null || monthly < 0) {
    result.errors.max_monthly_budget = 'Enter a valid monthly budget (≥ 0).';
  }
  if (autoMax === null || autoMax < 0) {
    result.errors.auto_approve_max_amount = 'Auto-approve max must be ≥ 0.';
  }
  if (draft.approval_required_above !== '' && (approvalAbove === null || approvalAbove < 0)) {
    result.errors.approval_required_above = 'Approval threshold must be a positive number or empty.';
  }

  if (!draft.allowed_categories.length) {
    result.errors.allowed_categories = 'Select at least one procurement segment.';
  }

  const autoNotSubset = draft.auto_approve_categories.filter(
    (c) => !draft.allowed_categories.includes(c)
  );
  if (autoNotSubset.length > 0) {
    result.errors.auto_approve_categories =
      'Auto-approve segments must also be allowed segments.';
  }

  if (perTxn != null && monthly != null && perTxn > monthly) {
    result.warnings.form =
      'Per-transaction cap exceeds monthly budget — only one large purchase may fit per month.';
  }

  if (autoMax != null && perTxn != null && autoMax > perTxn) {
    result.warnings.auto_approve_max_amount =
      'Auto-approve max is higher than the per-transaction cap.';
  }

  result.valid = Object.keys(result.errors).length === 0;
  return result;
}

/**
 * @param {PolicyFormDraft} draft
 * @returns {PolicySavePayload}
 */
export function draftToSavePayload(draft) {
  const validation = validatePolicyDraft(draft);
  if (!validation.valid) {
    throw new Error('Policy form is invalid');
  }
  return {
    max_per_transaction: Number(draft.max_per_transaction),
    max_monthly_budget: Number(draft.max_monthly_budget),
    auto_approve_max_amount: Number(draft.auto_approve_max_amount || 0),
    approval_required_above:
      draft.approval_required_above === '' ? null : Number(draft.approval_required_above),
    allowed_categories: [...draft.allowed_categories],
    auto_approve_categories: [...draft.auto_approve_categories],
    notes: draft.notes.trim()
  };
}

/**
 * @param {PolicyFormDraft} a
 * @param {PolicyFormDraft} b
 */
export function isDraftDirty(a, b) {
  return JSON.stringify(normalizeDraftForCompare(a)) !== JSON.stringify(normalizeDraftForCompare(b));
}

/** @param {PolicyFormDraft} d */
function normalizeDraftForCompare(d) {
  return {
    ...d,
    allowed_categories: [...d.allowed_categories].sort(),
    auto_approve_categories: [...d.auto_approve_categories].sort(),
    notes: d.notes.trim()
  };
}

/**
 * @param {number | string | null | undefined} value
 */
export function formatInr(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n);
}

/**
 * @param {PolicyFormDraft} before
 * @param {PolicyFormDraft} after
 * @param {(id: string) => string} categoryLabel
 */
export function summarizePolicyChanges(before, after, categoryLabel) {
  const lines = [];
  if (before.max_per_transaction !== after.max_per_transaction) {
    lines.push(
      `Per-transaction cap: ${formatInr(before.max_per_transaction)} → ${formatInr(after.max_per_transaction)}`
    );
  }
  if (before.max_monthly_budget !== after.max_monthly_budget) {
    lines.push(
      `Monthly budget: ${formatInr(before.max_monthly_budget)} → ${formatInr(after.max_monthly_budget)}`
    );
  }
  if (before.auto_approve_max_amount !== after.auto_approve_max_amount) {
    lines.push(
      `Auto-approve max: ${formatInr(before.auto_approve_max_amount)} → ${formatInr(after.auto_approve_max_amount)}`
    );
  }
  if (before.approval_required_above !== after.approval_required_above) {
    lines.push(
      `Approval above: ${before.approval_required_above || '—'} → ${after.approval_required_above || '—'}`
    );
  }
  const sortJoin = (arr) => [...arr].sort().map(categoryLabel).join(', ');
  if (sortJoin(before.allowed_categories) !== sortJoin(after.allowed_categories)) {
    lines.push(`Allowed segments updated`);
  }
  if (sortJoin(before.auto_approve_categories) !== sortJoin(after.auto_approve_categories)) {
    lines.push(`Auto-approve segments updated`);
  }
  if (before.notes.trim() !== after.notes.trim()) {
    lines.push('Notes updated');
  }
  return lines;
}
