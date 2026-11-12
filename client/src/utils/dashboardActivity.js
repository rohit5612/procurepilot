import { formatDate } from './date';

export function formatInr(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(n);
}

const STATUS_LABELS = {
  draft: 'Draft',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  issued: 'Issued',
  partially_received: 'Partially received',
  received: 'Received',
  closed: 'Closed',
  posted: 'Posted',
  withdrawn: 'Withdrawn'
};

export function formatProcurementStatus(status) {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}

function sortKey(date) {
  const t = new Date(date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function mapRequisitionToActivityRow(pr) {
  const id = pr.id;
  return {
    id: `pr-${id}`,
    docType: 'PR',
    documentNumber: pr.requisition_number || `PR-${id}`,
    title: pr.title || '—',
    status: pr.status,
    statusLabel: formatProcurementStatus(pr.status),
    amount: pr.total_amount,
    party: pr.requester_name || pr.department_name || '—',
    date: pr.updated_at || pr.created_at,
    dateLabel: formatDate(pr.updated_at || pr.created_at),
    href: `/procurement/pr/requisition-details/${id}`
  };
}

export function mapGoodsReceiptToActivityRow(grn) {
  const id = grn.id;
  return {
    id: `grn-${id}`,
    docType: 'GRN',
    documentNumber: grn.grn_number || `GRN-${id}`,
    title: grn.po_title || grn.po_number || 'Goods receipt',
    status: grn.status,
    statusLabel: formatProcurementStatus(grn.status),
    amount: grn.total_amount ?? null,
    party: grn.supplier_name || '—',
    date: grn.posted_at || grn.updated_at || grn.created_at,
    dateLabel: formatDate(grn.posted_at || grn.updated_at || grn.created_at),
    href: `/procurement/grn/grn-details/${id}`,
  };
}

export function mapPurchaseOrderToActivityRow(po) {
  const id = po.id;
  return {
    id: `po-${id}`,
    docType: 'PO',
    documentNumber: po.po_number || `PO-${id}`,
    title: po.title || '—',
    status: po.status,
    statusLabel: formatProcurementStatus(po.status),
    amount: po.total_amount,
    party: po.supplier_name || '—',
    date: po.updated_at || po.created_at,
    dateLabel: formatDate(po.updated_at || po.created_at),
    href: `/procurement/po/po-details/${id}`
  };
}

export function mapApprovalTaskToRow(task) {
  const entityType = task.entity_type || 'requisition';
  const isPo = entityType === 'purchase_order';
  const inst = task.instance_data || {};
  const entityId = task.entity_id || inst.requisition_id || inst.purchase_order_id || task._requisition?.id || task._purchaseOrder?.id;

  const documentNumber = isPo
    ? inst.po_number || task._purchaseOrder?.po_number
    : inst.requisition_number || task._requisition?.requisition_number;

  const title = inst.title || task._requisition?.title || task._purchaseOrder?.title || '—';
  const amount = inst.total_amount ?? task._requisition?.total_amount ?? task._purchaseOrder?.total_amount;
  const party = isPo
    ? inst.supplier_name || task._purchaseOrder?.supplier_name
    : inst.requester_name || task._requisition?.requester_name || inst.department_name;

  const href = isPo
    ? `/procurement/po/po-details/${entityId}`
    : `/procurement/pr/requisition-details/${entityId}`;

  return {
    id: task.id || `task-${entityType}-${entityId}`,
    docType: isPo ? 'PO' : 'PR',
    documentNumber: documentNumber || (isPo ? `PO-${entityId}` : `PR-${entityId}`),
    title,
    status: 'pending_approval',
    statusLabel: 'Pending approval',
    amount,
    party: party || '—',
    date: task.created_at || task.updated_at,
    dateLabel: formatDate(task.created_at || task.updated_at),
    href
  };
}

export function mergeActivityRows(requisitions, purchaseOrders, goodsReceipts = [], limit = 40) {
  const rows = [
    ...(requisitions || []).map(mapRequisitionToActivityRow),
    ...(purchaseOrders || []).map(mapPurchaseOrderToActivityRow),
    ...(goodsReceipts || []).map(mapGoodsReceiptToActivityRow),
  ];
  rows.sort((a, b) => sortKey(b.date) - sortKey(a.date));
  return rows.slice(0, limit);
}
