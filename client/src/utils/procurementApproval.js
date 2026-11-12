import { requisitionAPI, purchaseOrderAPI, systemAPI } from './api';

/**
 * Load PR approval queue: workflow tasks when present, else pending requisitions (ProcurePilot path).
 */
export async function fetchRequisitionApprovalTasks(user) {
  const isSuper = user?.is_superuser || user?.isSuperuser;
  const isAdminL1 = Number.isInteger(user?.roleLevel) && user.roleLevel <= 1;
  let queryParams = isSuper || isAdminL1
    ? 'status=pending&entity_type=requisition'
    : `assignee=${user.id}&status=pending&entity_type=requisition`;

  try {
    const response = await systemAPI.getWorkflowTasks(`?${queryParams}`);
    if (response.ok) {
      const data = await response.json();
      const tasks = data.data || [];
      if (tasks.length > 0) {
        return tasks.map((t) => ({ ...t, _source: 'workflow' }));
      }
    }
  } catch (_) {
    /* fall through */
  }

  const params = new URLSearchParams({ status: 'pending_approval', limit: '100', page: '1' });
  const prRes = await requisitionAPI.getRequisitions(params.toString());
  if (!prRes.ok) return [];
  const json = await prRes.json();
  const list = json.data?.requisitions || json.data || [];
  return list.map((pr) => ({
    id: `direct-pr-${pr.id}`,
    _source: 'direct',
    entity_id: pr.id,
    entity_type: 'requisition',
    instance_data: {
      title: pr.title,
      requisition_id: pr.id,
      requisition_number: pr.requisition_number,
      total_amount: pr.total_amount,
      requester_name: pr.requester_name,
      department_name: pr.department_name
    },
    _requisition: pr
  }));
}

export async function approveRequisitionTask(task, comment = 'Approved') {
  if (task._source === 'direct') {
    const id = task.entity_id || task._requisition?.id;
    const res = await requisitionAPI.approveRequisition(id, { comment });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to approve requisition');
    }
    return;
  }
  const res = await systemAPI.completeWorkflowTask(task.id, { action: 'approve', comment });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to approve task');
  }
}

export async function fetchPurchaseOrderApprovalTasks(user) {
  const isSuper = user?.is_superuser || user?.isSuperuser;
  const isAdminL1 = Number.isInteger(user?.roleLevel) && user.roleLevel <= 1;
  let queryParams = isSuper || isAdminL1
    ? 'status=pending&entity_type=purchase_order'
    : `assignee=${user.id}&status=pending&entity_type=purchase_order`;

  try {
    const response = await systemAPI.getWorkflowTasks(`?${queryParams}`);
    if (response.ok) {
      const data = await response.json();
      const tasks = data.data || [];
      if (tasks.length > 0) {
        return tasks.map((t) => ({ ...t, _source: 'workflow' }));
      }
    }
  } catch (_) {
    /* fall through */
  }

  const params = new URLSearchParams({ status: 'pending_approval', limit: '100', page: '1' });
  const poRes = await purchaseOrderAPI.getPOs(params.toString());
  if (!poRes.ok) return [];
  const json = await poRes.json();
  const list = json.data || [];
  return list.map((po) => ({
    id: `direct-po-${po.id}`,
    _source: 'direct',
    entity_id: po.id,
    entity_type: 'purchase_order',
    instance_data: {
      title: po.title,
      po_number: po.po_number,
      total_amount: po.total_amount,
      supplier_name: po.supplier_name
    },
    _purchaseOrder: po
  }));
}

export async function approvePurchaseOrderTask(task, comment = 'Approved') {
  if (task._source === 'direct') {
    const id = task.entity_id || task._purchaseOrder?.id;
    const res = await purchaseOrderAPI.approvePO(id, { comment });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to approve purchase order');
    }
    return;
  }
  const res = await systemAPI.completeWorkflowTask(task.id, { action: 'approve', comment });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to approve task');
  }
}

export async function rejectPurchaseOrderTask(task, reason) {
  if (task._source === 'direct') {
    const id = task.entity_id || task._purchaseOrder?.id;
    const res = await purchaseOrderAPI.rejectPO(id, { reason });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to reject purchase order');
    }
    return;
  }
  const res = await systemAPI.completeWorkflowTask(task.id, { action: 'reject', comment: reason });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to reject task');
  }
}

export async function rejectRequisitionTask(task, reason) {
  if (task._source === 'direct') {
    const id = task.entity_id || task._requisition?.id;
    const res = await requisitionAPI.rejectRequisition(id, { rejection_reason: reason });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to reject requisition');
    }
    return;
  }
  const res = await systemAPI.completeWorkflowTask(task.id, { action: 'reject', comment: reason });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Failed to reject task');
  }
}
