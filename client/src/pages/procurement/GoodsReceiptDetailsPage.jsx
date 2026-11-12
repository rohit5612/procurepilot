import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { goodsReceiptAPI, purchaseOrderAPI, systemAPI } from '../../utils/api';
import WorkflowStatusCard from '../../components/common/WorkflowStatusCard';
import WorkflowTimeline from '../../components/system/WorkflowTimeline';
import { ArrowLeft, Building, Calendar, Radio, Package, Trash2, Printer } from 'lucide-react';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { usePermissions } from '../../hooks/usePermissions';
import { formatDate } from '../../utils/date';
import { useReactToPrint } from 'react-to-print';
import { getGRNPrintComponent } from '../../clients/printRegistry';

const GoodsReceiptDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [grn, setGrn] = useState(null);
  const [poCategoryName, setPoCategoryName] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const { add } = useToastContext() || { add: () => {} };
  const { open } = useDialog() || { open: () => {} };
  const { hasPermission } = usePermissions();
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [pendingTask, setPendingTask] = useState(null);
  const [taskActionLoading, setTaskActionLoading] = useState(false);
  const printRef = useRef(null);
  const GRNPrint = getGRNPrintComponent();
  const [showGrnPrintPreview, setShowGrnPrintPreview] = useState(false);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: grn?.grn_number ? `GRN_${grn.grn_number}` : 'Goods_Receipt'
  });

  const refreshWorkflow = async () => {
    try {
      setWorkflowLoading(true);
      setPendingTask(null);
      setWorkflowInstance(null);
      // Prefer entity read model
      const resp = await systemAPI.getWorkflowForEntity('goods_receipt', id);
      const json = await resp.json().catch(() => ({}));
      if (resp.ok && json?.data) setWorkflowInstance(json.data);

      // Find my pending task for quick actions
      const qp = new URLSearchParams({ entity_type: 'goods_receipt', status: 'pending' }).toString();
      const tRes = await systemAPI.getWorkflowTasks(qp);
      const tJson = await tRes.json().catch(() => ({}));
      const tasks = Array.isArray(tJson?.data) ? tJson.data : [];

      // Resolve instance id
      const instId = Number(
        json?.data?.id || json?.data?.instance_id || json?.instance_id || grn?.workflow_instance_id || 0
      );
      if (instId > 0) {
        const task = tasks.find(t => Number(t.instance_id) === instId);
        if (task) setPendingTask(task);
      }
    } catch (_) {
      setPendingTask(null);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await goodsReceiptAPI.getGRN(id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch GRN');
      const grnData = data.data || data;
      setGrn(grnData);
      // Fetch PO to show its transaction category
      try {
        const poId = grnData.purchase_order_id;
        if (poId) {
          const poRes = await purchaseOrderAPI.getPO(poId);
          const poJson = await poRes.json().catch(() => ({}));
          if (poRes.ok) setPoCategoryName(poJson?.data?.transaction_category_name || poJson?.transaction_category_name || null);
        }
      } catch (_) {}
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    if (id) refreshWorkflow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, grn?.workflow_instance_id]);

  const handlePost = async () => {
    try {
      const res = await goodsReceiptAPI.postGRN(id);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to post GRN');
      await fetchData();
      add('GRN posted', 'success');
      open('Posted', `GRN #${id} posted successfully.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSubmitForApproval = async () => {
    try {
      const res = await goodsReceiptAPI.submitGRN(id);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to submit GRN');
      
      // Optimistic update
      setGrn(prev => prev ? { ...prev, status: 'pending_approval' } : prev);
      
      // Refresh GRN data
      await fetchData();
      
      // Refresh workflow panel and tasks
      try {
        const resp = await systemAPI.getWorkflowForEntity('goods_receipt', id);
        const json = await resp.json().catch(() => ({}));
        if (resp.ok && json?.data) {
          setWorkflowInstance(json.data);
          
          // Also fetch tasks to see if there's a pending approval task
          const isSuper = user?.is_superuser || user?.isSuperuser;
          const isAdminL1 = Number.isInteger(user?.roleLevel) && user.roleLevel <= 1;
          const qp = isSuper || isAdminL1
            ? `status=pending&entity_type=goods_receipt`
            : `assignee=${user.id}&status=pending&entity_type=goods_receipt`;
          const tasksResp = await systemAPI.getWorkflowTasks(`?${qp}`);
          if (tasksResp.ok) {
            const tasksJson = await tasksResp.json().catch(() => ({}));
            const tasks = Array.isArray(tasksJson?.data) ? tasksJson.data : [];
            const instId = Number(json?.data?.id || json?.data?.instance_id || 0);
            if (instId > 0) {
              const task = tasks.find(t => Number(t.instance_id) === instId);
              if (task) setPendingTask(task);
            }
          }
        }
      } catch (_) {}
      
      add('GRN submitted', 'success');
      open('Submitted', `GRN #${grn?.grn_number || id} submitted for approval.`);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async () => {
    try {
      if (!window.confirm('Withdraw this draft GRN?')) return;
      const res = await goodsReceiptAPI.withdrawGRN(id);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Failed to withdraw GRN');
      add('GRN withdrawn', 'success');
      open('Withdrawn', `GRN #${grn.grn_number || id} withdrawn successfully.`);
      navigate('/procurement/grn/grn-list');
    } catch (e) { setError(e.message); }
  };

  const approveTask = async () => {
    if (!pendingTask) return;
    try {
      setTaskActionLoading(true);
      const res = await systemAPI.completeWorkflowTask(pendingTask.id, { action: 'approve', comment: 'Approved via GRN details' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Approve failed');
      }
      setPendingTask(null);
      await fetchData();
      await refreshWorkflow();
      add('Approved', 'success');
      open('Approved', `${grn?.grn_number || id} approved.`);
    } catch (e) { setError(e.message); } finally { setTaskActionLoading(false); }
  };

  const rejectTask = async (reason) => {
    if (!pendingTask) return;
    try {
      setTaskActionLoading(true);
      const res = await systemAPI.completeWorkflowTask(pendingTask.id, { action: 'reject', comment: reason || 'Rejected via GRN details' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Reject failed');
      }
      setPendingTask(null);
      await fetchData();
      await refreshWorkflow();
      add('Rejected', 'error');
      open('Rejected', `${grn?.grn_number || id} rejected.`);
    } catch (e) { setError(e.message); } finally { setTaskActionLoading(false); }
  };

  if (loading) return <div className="card"><div className="card-body"><div className="animate-pulse h-24 bg-muted rounded" /></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!grn) return <div className="text-muted">Not found</div>;

  const getSiteDisplay = () => {
    const name = grn.site_name || '';
    const code = grn.site_code || '';
    if (!name && !code) return 'N/A';
    return code ? `${name || ''} (${code})` : name;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/procurement/grn/grn-list')} className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} className="mr-2" /> Back to List
          </button>
          <div>
            <h1 className="text-2xl font-bold text-fg">Goods Receipt</h1>
            <p className="text-muted">#{grn.grn_number}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {grn.status === 'draft' && (
            <button onClick={() => navigate(`/procurement/grn/grn-edit/${id}`)} className="btn btn-secondary">Edit</button>
          )}
          {grn.status === 'draft' && hasPermission('procurement.goods_receipt.submit') && (
            <button onClick={handleSubmitForApproval} className="btn btn-primary">Submit for Approval</button>
          )}
          {grn.status === 'approved' && hasPermission('procurement.goods_receipt.approve') && (
            <button onClick={handlePost} className="btn btn-success">Post GRN</button>
          )}
          {grn.status === 'draft' && (
            <button onClick={handleDelete} className="btn btn-danger"><Trash2 size={16} className="mr-2" /> Withdraw</button>
          )}
          <button type="button" onClick={() => setShowGrnPrintPreview(true)} className="btn btn-secondary">
            <Printer size={16} className="mr-2" />
            Print / save PDF
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">Linked PO: {grn.po_number || `#${grn.purchase_order_id}`}</h3>
              <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
                grn?.status === 'draft' ? 'bg-gray-100 text-gray-700' :
                grn?.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
                grn?.status === 'approved' ? 'bg-blue-100 text-blue-800' :
                grn?.status === 'rejected' ? 'bg-red-100 text-red-800' :
                grn?.status === 'withdrawn' ? 'bg-gray-100 text-gray-700' :
                grn?.status === 'posted' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-700'
              }`}>
                {grn.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {showGrnPrintPreview && grn && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-fg">Goods receipt — print preview</h2>
                <p className="text-sm text-muted">ProcurePilot layout; print or save as PDF from your browser.</p>
              </div>
              <button
                type="button"
                className="text-muted hover:text-fg text-2xl leading-none"
                onClick={() => setShowGrnPrintPreview(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-muted/30">
              <div className="bg-white mx-auto shadow-sm max-w-[900px]">
                <GRNPrint ref={printRef} grn={grn} formatDate={formatDate} />
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowGrnPrintPreview(false)}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => handlePrint()}>
                <Printer size={16} className="mr-2" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">Basic Information</h3></div>
            <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Supplier</label>
                <div>{grn.supplier_name || grn.supplier_id || '-'}</div>
              </div>
              <div>
                <label className="form-label">Site</label>
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-muted" />
                  <span>{getSiteDisplay()}</span>
                </div>
              </div>
              <div>
                <label className="form-label">Warehouse</label>
                <div className="flex items-start gap-2"><Building size={16} className="text-muted mt-0.5" /><div><div>{grn.warehouse_name || 'N/A'}</div>{grn.warehouse_address && (<div className="text-xs text-muted">{grn.warehouse_address}</div>)}</div></div>
              </div>
              <div>
                <label className="form-label">Circle</label>
                <div className="flex items-center gap-2"><Radio size={16} className="text-muted" /><span>{grn.circle_name || 'N/A'}</span></div>
              </div>
              <div>
                <label className="form-label">Cluster</label>
                <div className="flex items-center gap-2"><Radio size={16} className="text-muted" /><span>{grn.cluster_name || 'N/A'}</span></div>
              </div>
              <div>
                <label className="form-label">Category</label>
                <div>{poCategoryName || 'N/A'}</div>
              </div>
              <div>
                <label className="form-label">Created</label>
                <div className="flex items-center gap-2"><Calendar size={16} className="text-muted" /><span>{grn.created_at ? new Date(grn.created_at).toLocaleString() : '-'}</span></div>
              </div>
              <div>
                <label className="form-label">Status</label>
                <div>{grn.status}</div>
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Remarks</label>
                <div>{grn.remarks || '-'}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">Line Items</h3></div>
            <div className="card-body">
              {grn.lines && grn.lines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Manufacturer</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Qty as per PO</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Already Received</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Expected Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Received</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Accepted</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Rejected</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">UoM</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {grn.lines.map((l, idx) => (
                        <tr key={l.id || idx}>
                          <td className="px-4 py-3">
                            <div className="font-medium text-fg">{l.item_name}</div>
                            {l.item_code && <div className="text-sm text-muted">{l.item_code}</div>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-fg">
                              {l.manufacturer || '-'}
                            </div>
                            {l.spare_type && (
                              <div className="text-xs text-muted">
                                {l.spare_type}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">{l.qty_as_per_po_snapshot ?? l.qty_as_per_po ?? '-'}</td>
                          <td className="px-4 py-3">{l.already_received_snapshot ?? '-'}</td>
                          <td className="px-4 py-3">{l.expected_qty_snapshot ?? '-'}</td>
                          <td className="px-4 py-3">{l.received_qty}</td>
                          <td className="px-4 py-3">{l.accepted_qty}</td>
                          <td className="px-4 py-3">{l.rejected_qty}</td>
                          <td className="px-4 py-3">{l.unit_of_measure}</td>
                          <td className="px-4 py-3">{typeof l.unit_price !== 'undefined' ? l.unit_price : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted">
                  <Package size={48} className="text-muted mx-auto mb-4" />
                  No lines
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">Summary</h3></div>
            <div className="card-body space-y-3">
              <div className="flex justify-between"><span className="text-muted">GRN Number:</span><span className="font-medium">{grn.grn_number}</span></div>
              <div className="flex justify-between"><span className="text-muted">Status:</span><span className="font-medium">{grn.status}</span></div>
              <div className="flex justify-between"><span className="text-muted">PO:</span><span className="font-medium">{grn.po_number || `#${grn.purchase_order_id}`}</span></div>
              <div className="flex justify-between"><span className="text-muted">Created:</span><span className="text-sm">{formatDate(grn.created_at)}</span></div>
              {grn.posted_at && (
                <div className="flex justify-between"><span className="text-muted">Posted:</span><span className="text-sm">{formatDate(grn.posted_at)}</span></div>
              )}
            </div>
          </div>

          {/* Prefer rich timeline if available, fallback to basic card */}
          {workflowInstance?.computed?.steps?.length ? (
            <div className="card">
              <div className="card-header"><h3 className="text-lg font-semibold">Workflow</h3></div>
              <div className="card-body">
                <WorkflowTimeline data={workflowInstance.computed} />
                {/* Quick actions if I have a pending task */}
                {pendingTask && ((user?.isSuperuser || (Number.isInteger(user?.roleLevel) && user.roleLevel <= 1)) || hasPermission('procurement.goods_receipt.approve')) && (
                  <div className="mt-4 flex gap-2">
                    <button disabled={taskActionLoading} onClick={approveTask} className="btn btn-success btn-sm">{taskActionLoading ? 'Working...' : 'Approve'}</button>
                    <button disabled={taskActionLoading} onClick={() => {
                      const r = window.prompt('Enter rejection reason');
                      if (r && r.trim()) rejectTask(r.trim());
                    }} className="btn btn-danger btn-sm">Reject</button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <WorkflowStatusCard instanceId={grn.workflow_instance_id} title="Workflow" />
          )}
        </div>
      </div>
    </div>
  );
};

export default GoodsReceiptDetailsPage;


