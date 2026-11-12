import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Building,
  DollarSign,
  Loader,
  ShoppingCart
} from 'lucide-react';
import { userManagementAPI } from '../../utils/api';
import {
  fetchPurchaseOrderApprovalTasks,
  approvePurchaseOrderTask,
  rejectPurchaseOrderTask
} from '../../utils/procurementApproval';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { formatDate } from '../../utils/date';
import PageToolbar from '../../components/layout/PageToolbar';

const POApprovalTasksPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedTask, setSelectedTask] = useState(null);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [assigneeDetails, setAssigneeDetails] = useState({});
  const { add } = useToastContext() || { add: () => {} };
  const { open } = useDialog() || { open: () => {} };

  useEffect(() => {
    fetchApprovalTasks();
  }, []);

  const fetchApprovalTasks = async () => {
    try {
      setLoading(true);
      setError(null);

      const tasksData = await fetchPurchaseOrderApprovalTasks(user);
      setTasks(tasksData);
      
      // Fetch assignee details for all tasks
      const uniqueAssigneeIds = new Set();
      tasksData.forEach(task => {
        if (task.assignees && Array.isArray(task.assignees)) {
          task.assignees.forEach(id => uniqueAssigneeIds.add(id));
        }
      });
      
      if (uniqueAssigneeIds.size > 0) {
        await fetchAssigneeDetails(Array.from(uniqueAssigneeIds));
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching PO approval tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssigneeDetails = async (userIds) => {
    try {
      const details = {};
      for (const userId of userIds) {
        try {
          const response = await userManagementAPI.getBasicUserInfo(userId);
          if (response.ok) {
            const data = await response.json();
            const userData = data.data || data;
            details[userId] = {
              name: userData.full_name || `${userData.first_name} ${userData.last_name}` || userData.email || 'Unknown',
              email: userData.email || 'N/A'
            };
          }
        } catch (e) {
          console.error(`Failed to fetch user ${userId}:`, e);
          details[userId] = { name: `User ${userId}`, email: 'N/A' };
        }
      }
      setAssigneeDetails(details);
    } catch (err) {
      console.error('Error fetching assignee details:', err);
    }
  };

  const handleApprove = async (task) => {
    try {
      setActionLoading(prev => ({ ...prev, [task.id]: true }));
      setError(null);

      await approvePurchaseOrderTask(task, 'Approved via PO approval tasks dashboard');
      await fetchApprovalTasks();
      const info = getTaskInfo(task);
      add('PO approved', 'success');
      open('Approved', `${info.poNumber} approved successfully.`);
    } catch (err) {
      setError(err.message);
      console.error('Error approving PO:', err);
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
      setError(null);

      await rejectPurchaseOrderTask(task, rejectionReason);
      setShowRejectionModal(false);
      setSelectedTask(null);
      setRejectionReason('');
      await fetchApprovalTasks();
      const info = getTaskInfo(task);
      add('PO rejected', 'error');
      open('Rejected', `${info.poNumber} rejected.`);
    } catch (err) {
      setError(err.message);
      console.error('Error rejecting PO:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const getTaskInfo = (task) => {
    const context = task.context || {};
    return {
      poNumber: context.poNumber || `PO #${task.entity_id}`,
      title: context.title || 'N/A',
      supplierName: context.supplierName || 'N/A',
      totalAmount: context.totalAmount || 0,
      requesterName: context.requesterName || context.createdBy || 'Unknown',
      departmentName: context.departmentName || 'N/A',
      siteName: context.siteName || 'N/A',
      siteId: context.siteId || null,
      projectName: context.projectName || 'N/A',
      projectId: context.projectId || null,
      itemCount: context.itemCount || context.totalQuantity || 0,
      description: context.description || '',
      nodeId: task.node_id || 'Unknown',
      poId: task.entity_id
    };
  };

  const isLoading = Object.values(actionLoading).some(val => val);

  return (
    <div className="space-y-6">
      <PageToolbar description="Review and approve purchase orders">
        <button
          type="button"
          onClick={fetchApprovalTasks}
          disabled={loading}
          className="btn btn-secondary"
        >
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageToolbar>

      {/* Error Display */}
      {error && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={20} />
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="card">
          <div className="card-body">
            <div className="animate-pulse space-y-4">
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
              <div className="h-24 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <CheckCircle size={48} className="text-success mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-fg mb-2">No Pending Approvals</h3>
            <p className="text-muted">You don't have any purchase orders pending approval at the moment.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tasks.map((task) => {
            const taskInfo = getTaskInfo(task);
            const taskIsLoading = actionLoading[task.id];

            return (
              <div key={task.id} className="card hover:shadow-md transition-shadow">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-fg">
                        {taskInfo.poNumber}
                      </h3>
                      <p className="text-sm text-muted">{taskInfo.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 mr-1.5" />
                        Pending Approval
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="card-body">
                  <div className="space-y-4 mb-4">
                    {/* Key PO Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-muted rounded-lg">
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Created By</div>
                        <div className="font-medium text-fg">{taskInfo.requesterName}</div>
                        <div className="text-xs text-muted">{taskInfo.departmentName}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Total Amount</div>
                        <div className="font-bold text-lg text-primary">{formatCurrency(taskInfo.totalAmount)}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Supplier</div>
                        <div className="font-medium text-fg">{taskInfo.supplierName}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Items</div>
                        <div className="font-medium text-fg">{taskInfo.itemCount || 'N/A'}</div>
                      </div>
                    </div>

                    {/* Assigned Users */}
                    {task.assignees && task.assignees.length > 0 && (
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <User size={16} className="text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">Assigned to:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {task.assignees.map((assigneeId) => {
                            const assignee = assigneeDetails[assigneeId] || { name: `User ${assigneeId}`, email: 'Loading...' };
                            return (
                              <div key={assigneeId} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border border-blue-300">
                                <User size={12} className="text-blue-600" />
                                <span className="text-xs font-medium text-blue-900">{assignee.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Approval Step */}
                    <div className="text-center p-2 bg-blue-50 rounded-lg">
                      <div className="text-xs text-blue-600 uppercase tracking-wide font-medium">Approval Step</div>
                      <div className="font-semibold text-blue-800">{taskInfo.nodeId.replace('_', ' ').toUpperCase()}</div>
                    </div>

                    {/* Additional Details */}
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted" />
                      <span className="text-muted">Submitted:</span>
                      <span>{formatDate(task.created_at)}</span>
                    </div>

                    {/* Description */}
                    {taskInfo.description && (
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-sm text-fg">{taskInfo.description}</p>
                      </div>
                    )}

                    {/* Assignees Info */}
                    {task.assignees && task.assignees.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted" />
                        <span className="text-muted">Assigned to:</span>
                        <span>{task.assignees.length} user(s)</span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {/* View Details Button */}
                    {taskInfo.poId && (
                      <button
                        onClick={() => {
                          navigate(`/procurement/po/po-details/${taskInfo.poId}`, { state: { from: 'approvals' } });
                        }}
                        className="btn btn-secondary w-full"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Purchase Order Details
                      </button>
                    )}
                    
                    {/* Approval Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(task)}
                        disabled={isLoading}
                        className="btn btn-success flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {taskIsLoading ? (
                          <Loader className="animate-spin h-4 w-4 mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        {taskIsLoading ? 'Approving...' : 'Approve'}
                      </button>
                      
                      <button
                        onClick={() => {
                          setSelectedTask(task);
                          setShowRejectionModal(true);
                          setError(null);
                        }}
                        disabled={isLoading}
                        className="btn btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
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

      {/* Rejection Modal */}
      {showRejectionModal && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-default">
              <h3 className="text-lg font-semibold text-fg">Reject Purchase Order</h3>
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setSelectedTask(null);
                  setRejectionReason('');
                  setError(null);
                }}
                className="text-muted hover:text-fg"
              >
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-muted mb-4">
                Please provide a reason for rejecting this purchase order. This will be sent to the requester.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="input w-full"
                rows={4}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-default">
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setSelectedTask(null);
                  setRejectionReason('');
                  setError(null);
                }}
                className="btn btn-secondary"
                disabled={actionLoading[selectedTask.id]}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(selectedTask)}
                className="btn btn-danger"
                disabled={!rejectionReason.trim() || actionLoading[selectedTask.id]}
              >
                {actionLoading[selectedTask.id] ? (
                  <>
                    <Loader className="animate-spin h-4 w-4 mr-2" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject PO
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POApprovalTasksPage;

