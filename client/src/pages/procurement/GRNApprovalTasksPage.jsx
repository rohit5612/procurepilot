import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Eye, Calendar, User, Loader, Package } from 'lucide-react';
import { systemAPI } from '../../utils/api';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { formatDate } from '../../utils/date';

const GRNApprovalTasksPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { add } = useToastContext() || { add: () => {} };
  const { open } = useDialog() || { open: () => {} };

  useEffect(() => { fetchApprovalTasks(); }, []);

  const fetchApprovalTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const isSuper = user.is_superuser || user.isSuperuser;
      const isAdminL1 = Number.isInteger(user?.roleLevel) && user.roleLevel <= 1;
      const qp = isSuper || isAdminL1
        ? 'status=pending&entity_type=goods_receipt'
        : `assignee=${user.id}&status=pending&entity_type=goods_receipt`;
      const res = await systemAPI.getWorkflowTasks(`?${qp}`);
      if (!res.ok) throw new Error(`Failed to fetch GRN approval tasks: ${res.status}`);
      const json = await res.json();
      setTasks(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (task) => {
    try {
      setActionLoading(prev => ({ ...prev, [task.id]: true }));
      const res = await systemAPI.completeWorkflowTask(task.id, { action: 'approve', comment: 'Approved via GRN approval tasks' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to approve');
      }
      await fetchApprovalTasks();
      const info = getTaskInfo(task);
      add('GRN approved', 'success');
      open('Approved', `${info.grnNumber} approved successfully.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const handleReject = async (task) => {
    if (!rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }
    try {
      setActionLoading(prev => ({ ...prev, [task.id]: true }));
      const res = await systemAPI.completeWorkflowTask(task.id, { action: 'reject', comment: rejectionReason });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to reject');
      }
      setShowRejectionModal(false);
      setSelectedTask(null);
      setRejectionReason('');
      await fetchApprovalTasks();
      const info = getTaskInfo(task);
      add('GRN rejected', 'error');
      open('Rejected', `${info.grnNumber} rejected.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const getTaskInfo = (task) => {
    const ctx = task.context || {};
    return {
      grnNumber: ctx.grnNumber || `GRN #${task.entity_id}`,
      supplierName: ctx.supplierName || 'N/A',
      siteName: ctx.siteName || 'N/A',
      nodeId: task.node_id || 'Unknown',
      grnId: task.entity_id
    };
  };

  const isAnyLoading = Object.values(actionLoading).some(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">GRN Approval Tasks</h1>
          <p className="text-muted">Review and approve Goods Receipt Notes</p>
        </div>
        <button onClick={fetchApprovalTasks} disabled={loading} className="btn btn-secondary">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="card-body">
            <div className="animate-pulse space-y-4">
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-fg mb-2">No Pending Approvals</h3>
            <p className="text-muted">You have no GRNs pending approval.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tasks.map((task) => {
            const ti = getTaskInfo(task);
            const tLoading = !!actionLoading[task.id];
            return (
              <div key={task.id} className="card hover:shadow-md transition-shadow">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      <div>
                        <h3 className="text-lg font-semibold text-fg">{ti.grnNumber}</h3>
                        <p className="text-sm text-muted">{ti.supplierName}</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      <Clock className="h-3 w-3 mr-1.5" />
                      Pending Approval
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="space-y-4 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-muted rounded-lg">
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Site</div>
                        <div className="font-medium text-fg">{ti.siteName}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Assignees</div>
                        <div className="font-medium text-fg">{Array.isArray(task.assignees) ? task.assignees.length : 0}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Step</div>
                        <div className="font-medium text-fg">{String(ti.nodeId || '').replace('_',' ').toUpperCase()}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted" />
                      <span className="text-muted">Created:</span>
                      <span>{formatDate(task.created_at)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {ti.grnId && (
                      <button onClick={() => navigate(`/procurement/grn/grn-details/${ti.grnId}`, { state: { from: 'approvals' } })} className="btn btn-secondary w-full">
                        <Eye className="h-4 w-4 mr-2" />
                        View GRN Details
                      </button>
                    )}
                    <div className="flex gap-3">
                      <button onClick={() => handleApprove(task)} disabled={isAnyLoading} className="btn btn-success flex-1 disabled:opacity-50">
                        {tLoading ? <Loader className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                        {tLoading ? 'Approving...' : 'Approve'}
                      </button>
                      <button onClick={() => { setSelectedTask(task); setShowRejectionModal(true); setError(null); }} disabled={isAnyLoading} className="btn btn-danger flex-1 disabled:opacity-50">
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showRejectionModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-default">
              <h3 className="text-lg font-semibold text-fg">Reject GRN</h3>
              <button onClick={() => { setShowRejectionModal(false); setSelectedTask(null); setRejectionReason(''); setError(null); }} className="text-muted hover:text-fg">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted mb-4">Provide a reason for rejecting this GRN.</p>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Enter rejection reason..." className="input w-full" rows={4} />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-default">
              <button onClick={() => { setShowRejectionModal(false); setSelectedTask(null); setRejectionReason(''); setError(null); }} className="btn btn-secondary" disabled={actionLoading[selectedTask.id]}>Cancel</button>
              <button onClick={() => handleReject(selectedTask)} className="btn btn-danger" disabled={!rejectionReason.trim() || actionLoading[selectedTask.id]}>
                {actionLoading[selectedTask.id] ? (<><Loader className="animate-spin h-4 w-4 mr-2" />Rejecting...</>) : (<><XCircle className="h-4 w-4 mr-2" />Reject</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GRNApprovalTasksPage;


