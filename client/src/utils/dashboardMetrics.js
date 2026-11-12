const DAY_MS = 24 * 60 * 60 * 1000;

export const DASHBOARD_RANGES = [
  { id: '30d', label: '30D', longLabel: 'Last 30 days', days: 30, bucket: 'day' },
  { id: '90d', label: '90D', longLabel: 'Last 90 days', days: 91, bucket: 'week' },
  { id: '12m', label: '12M', longLabel: 'Last 12 months', days: 365, bucket: 'month' }
];

const PO_COMMITTED = new Set(['approved', 'issued', 'closed']);
const PO_ISSUED = new Set(['issued', 'closed']);
const PR_INACTIVE = new Set(['cancelled', 'withdrawn']);
const PR_OPEN = new Set(['draft', 'submitted', 'pending_approval']);

export const PR_STATUS_SEGMENTS = [
  { key: 'draft', label: 'Draft' },
  { key: 'pending_approval', label: 'Pending approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' }
];

export function getRange(rangeId) {
  return DASHBOARD_RANGES.find((r) => r.id === rangeId) || DASHBOARD_RANGES[0];
}

/** Start of the selected window as an ISO date (day precision, so it stays stable within a day). */
export function getRangeStartIso(rangeId, now = Date.now()) {
  const range = getRange(rangeId);
  const end = startOfDay(now) + DAY_MS;
  return new Date(end - range.days * DAY_MS).toISOString();
}

function toTime(value) {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function startOfDay(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' });

export function buildBuckets(range, now = Date.now()) {
  const buckets = [];
  if (range.bucket === 'month') {
    const anchor = new Date(now);
    anchor.setDate(1);
    anchor.setHours(0, 0, 0, 0);
    for (let i = 11; i >= 0; i -= 1) {
      const start = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1).getTime();
      const end = new Date(anchor.getFullYear(), anchor.getMonth() - i + 1, 1).getTime();
      buckets.push({ start, end, label: monthFmt.format(start) });
    }
    return buckets;
  }

  const step = range.bucket === 'week' ? 7 : 1;
  const count = Math.ceil(range.days / step);
  const tomorrow = startOfDay(now) + DAY_MS;
  for (let i = count - 1; i >= 0; i -= 1) {
    const end = tomorrow - i * step * DAY_MS;
    const start = end - step * DAY_MS;
    buckets.push({ start, end, label: dayFmt.format(start) });
  }
  return buckets;
}

function bucketIndex(buckets, t) {
  if (t == null) return -1;
  for (let i = 0; i < buckets.length; i += 1) {
    if (t >= buckets[i].start && t < buckets[i].end) return i;
  }
  return -1;
}

function inWindow(t, from, to) {
  return t != null && t >= from && t < to;
}

function pctChange(current, previous) {
  if (!previous) return current ? null : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function summarizeWindow(requisitions, purchaseOrders, from, to) {
  let prValue = 0;
  let prCount = 0;
  let poValue = 0;
  let poCount = 0;
  let approved = 0;
  let rejected = 0;
  let cycleTotal = 0;
  let cycleCount = 0;
  let issued = 0;
  let received = 0;

  for (const pr of requisitions) {
    const created = toTime(pr.created_at);
    if (inWindow(created, from, to) && !PR_INACTIVE.has(pr.status)) {
      prValue += num(pr.total_amount);
      prCount += 1;
    }
    const approvedAt = toTime(pr.approved_at);
    if (inWindow(approvedAt, from, to)) {
      approved += 1;
      const submittedAt = toTime(pr.submitted_at) ?? created;
      if (submittedAt != null && approvedAt >= submittedAt) {
        cycleTotal += approvedAt - submittedAt;
        cycleCount += 1;
      }
    }
    if (inWindow(toTime(pr.rejected_at), from, to)) rejected += 1;
  }

  for (const po of purchaseOrders) {
    if (!inWindow(toTime(po.created_at), from, to)) continue;
    poCount += 1;
    if (PO_COMMITTED.has(po.status)) poValue += num(po.total_amount);
    if (PO_ISSUED.has(po.status)) {
      issued += 1;
      if (po.receiving_status === 'fully_received') received += 1;
    }
  }

  const decided = approved + rejected;
  return {
    prValue,
    prCount,
    poValue,
    poCount,
    approvalRate: decided ? (approved / decided) * 100 : null,
    avgCycleHours: cycleCount ? cycleTotal / cycleCount / (60 * 60 * 1000) : null,
    receiptRate: issued ? (received / issued) * 100 : null,
    approved,
    rejected,
    issued,
    received
  };
}

function buildSeries(requisitions, purchaseOrders, buckets) {
  const rows = buckets.map((b) => ({
    label: b.label,
    prValue: 0,
    poValue: 0,
    prCount: 0,
    poCount: 0,
    approved: 0,
    rejected: 0,
    cycleTotal: 0,
    cycleCount: 0,
    issued: 0,
    received: 0
  }));

  for (const pr of requisitions) {
    const created = toTime(pr.created_at);
    const i = bucketIndex(buckets, created);
    if (i >= 0 && !PR_INACTIVE.has(pr.status)) {
      rows[i].prValue += num(pr.total_amount);
      rows[i].prCount += 1;
    }
    const approvedAt = toTime(pr.approved_at);
    const a = bucketIndex(buckets, approvedAt);
    if (a >= 0) {
      rows[a].approved += 1;
      const submittedAt = toTime(pr.submitted_at) ?? created;
      if (submittedAt != null && approvedAt >= submittedAt) {
        rows[a].cycleTotal += approvedAt - submittedAt;
        rows[a].cycleCount += 1;
      }
    }
    const r = bucketIndex(buckets, toTime(pr.rejected_at));
    if (r >= 0) rows[r].rejected += 1;
  }

  for (const po of purchaseOrders) {
    const i = bucketIndex(buckets, toTime(po.created_at));
    if (i < 0) continue;
    rows[i].poCount += 1;
    if (PO_COMMITTED.has(po.status)) rows[i].poValue += num(po.total_amount);
    if (PO_ISSUED.has(po.status)) {
      rows[i].issued += 1;
      if (po.receiving_status === 'fully_received') rows[i].received += 1;
    }
  }

  return rows.map((row) => {
    const decided = row.approved + row.rejected;
    return {
      ...row,
      approvalRate: decided ? (row.approved / decided) * 100 : 0,
      avgCycleHours: row.cycleCount ? row.cycleTotal / row.cycleCount / (60 * 60 * 1000) : 0,
      receiptRate: row.issued ? (row.received / row.issued) * 100 : 0
    };
  });
}

function buildFunnel(requisitions, purchaseOrders, from, to) {
  const prs = requisitions.filter((pr) => inWindow(toTime(pr.created_at), from, to));
  const pos = purchaseOrders.filter((po) => inWindow(toTime(po.created_at), from, to));
  const submitted = prs.filter((pr) => pr.submitted_at || (pr.status && pr.status !== 'draft')).length;
  const approved = prs.filter((pr) => pr.approved_at || pr.status === 'approved').length;
  const issued = pos.filter((po) => PO_ISSUED.has(po.status));
  const received = issued.filter((po) => po.receiving_status === 'fully_received').length;

  return [
    { stage: 'Raised', value: prs.length },
    { stage: 'Submitted', value: submitted },
    { stage: 'Approved', value: approved },
    { stage: 'PO created', value: pos.length },
    { stage: 'PO issued', value: issued.length },
    { stage: 'Received', value: received }
  ];
}

function groupTop(items, keyFn, valueFn, limit = 6) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'Unassigned';
    const entry = map.get(key) || { label: key, value: 0, count: 0 };
    entry.value += valueFn(item);
    entry.count += 1;
    map.set(key, entry);
  }
  const sorted = [...map.values()].sort((a, b) => b.value - a.value);
  if (sorted.length <= limit) return sorted;
  const head = sorted.slice(0, limit - 1);
  const rest = sorted.slice(limit - 1).reduce(
    (acc, e) => ({ label: 'Other', value: acc.value + e.value, count: acc.count + e.count }),
    { label: 'Other', value: 0, count: 0 }
  );
  return [...head, rest];
}

function buildPipeline(stats, requisitions) {
  const fromStats = {
    draft: num(stats?.draft_count),
    pending_approval: num(stats?.pending_approval_count),
    approved: num(stats?.approved_count),
    rejected: num(stats?.rejected_count),
    cancelled: num(stats?.cancelled_count)
  };
  const statsTotal = Object.values(fromStats).reduce((a, b) => a + b, 0);
  const counts = statsTotal ? fromStats : { draft: 0, pending_approval: 0, approved: 0, rejected: 0, cancelled: 0 };

  if (!statsTotal) {
    for (const pr of requisitions) {
      const key = pr.status === 'submitted' ? 'pending_approval' : pr.status === 'withdrawn' ? 'cancelled' : pr.status;
      if (key in counts) counts[key] += 1;
    }
  }

  return PR_STATUS_SEGMENTS.map((s) => ({ ...s, value: counts[s.key] })).filter((s) => s.value > 0);
}

function buildAttention(requisitions, purchaseOrders, approvalRows, now) {
  const today = startOfDay(now);
  const staleCutoff = now - 3 * DAY_MS;
  const draftCutoff = now - 7 * DAY_MS;

  const staleApprovals = approvalRows.filter((row) => {
    const t = toTime(row.date);
    return t != null && t < staleCutoff;
  }).length;

  const overdue = requisitions.filter((pr) => {
    const needBy = toTime(pr.needed_by_date);
    return needBy != null && needBy < today && PR_OPEN.has(pr.status);
  });

  const awaitingReceipt = purchaseOrders.filter(
    (po) => PO_ISSUED.has(po.status) && po.status !== 'closed' && po.receiving_status !== 'fully_received'
  );

  const staleDrafts = requisitions.filter((pr) => pr.status === 'draft' && (toTime(pr.created_at) ?? now) < draftCutoff);

  return [
    {
      id: 'stale-approvals',
      tone: 'danger',
      title: 'Approvals waiting 3+ days',
      description: 'Items in your queue that are slowing the cycle.',
      count: staleApprovals,
      href: '/procurement/pr/approval-tasks'
    },
    {
      id: 'overdue',
      tone: 'warning',
      title: 'Past needed-by date',
      description: 'Open requisitions whose delivery date has passed.',
      count: overdue.length,
      value: overdue.reduce((s, pr) => s + num(pr.total_amount), 0),
      href: '/procurement/pr/requisition-list'
    },
    {
      id: 'awaiting-receipt',
      tone: 'info',
      title: 'Issued POs awaiting receipt',
      description: 'Goods not yet fully received against issued orders.',
      count: awaitingReceipt.length,
      value: awaitingReceipt.reduce((s, po) => s + num(po.total_amount), 0),
      href: '/procurement/po/po-list'
    },
    {
      id: 'stale-drafts',
      tone: 'neutral',
      title: 'Drafts older than 7 days',
      description: 'Requisitions started but never submitted.',
      count: staleDrafts.length,
      href: '/procurement/pr/requisition-list'
    }
  ];
}

/**
 * Derives every dashboard widget from raw PR/PO lists for the selected range.
 */
export function computeDashboardMetrics({
  requisitions = [],
  purchaseOrders = [],
  approvalRows = [],
  stats,
  rangeId,
  now = Date.now()
}) {
  const range = getRange(rangeId);
  const to = startOfDay(now) + DAY_MS;
  const from = to - range.days * DAY_MS;
  const prevFrom = from - range.days * DAY_MS;

  const current = summarizeWindow(requisitions, purchaseOrders, from, to);
  const previous = summarizeWindow(requisitions, purchaseOrders, prevFrom, from);
  const buckets = buildBuckets(range, now);
  const series = buildSeries(requisitions, purchaseOrders, buckets);

  const windowPrs = requisitions.filter((pr) => inWindow(toTime(pr.created_at), from, to) && !PR_INACTIVE.has(pr.status));
  const windowPos = purchaseOrders.filter((po) => inWindow(toTime(po.created_at), from, to) && PO_COMMITTED.has(po.status));

  return {
    range,
    from,
    to,
    current,
    previous,
    deltas: {
      prValue: pctChange(current.prValue, previous.prValue),
      poValue: pctChange(current.poValue, previous.poValue),
      prCount: pctChange(current.prCount, previous.prCount),
      approvalRate:
        current.approvalRate != null && previous.approvalRate != null ? current.approvalRate - previous.approvalRate : null,
      avgCycleHours: current.avgCycleHours != null && previous.avgCycleHours != null
        ? pctChange(current.avgCycleHours, previous.avgCycleHours)
        : null,
      receiptRate:
        current.receiptRate != null && previous.receiptRate != null ? current.receiptRate - previous.receiptRate : null
    },
    series,
    funnel: buildFunnel(requisitions, purchaseOrders, from, to),
    pipeline: buildPipeline(stats, requisitions),
    departments: groupTop(windowPrs, (pr) => pr.department_name, (pr) => num(pr.total_amount)),
    sites: groupTop(windowPrs, (pr) => pr.site_name, (pr) => num(pr.total_amount)),
    categories: groupTop(windowPos, (po) => po.transaction_category_name, (po) => num(po.total_amount)),
    suppliersFromList: groupTop(windowPos, (po) => po.supplier_name, (po) => num(po.total_amount), 8),
    attention: buildAttention(requisitions, purchaseOrders, approvalRows, now)
  };
}

export function formatCompactInr(value) {
  const n = num(value);
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(abs >= 1e8 ? 0 : 1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(abs >= 1e6 ? 0 : 1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  return `₹${Math.round(n)}`;
}

export function formatDuration(hours) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}
