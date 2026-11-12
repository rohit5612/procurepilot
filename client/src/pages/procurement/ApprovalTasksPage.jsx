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
  Loader
} from 'lucide-react';
import { procurementAPI } from '../../utils/api';
import {
  fetchRequisitionApprovalTasks,
  approveRequisitionTask,
  rejectRequisitionTask
} from '../../utils/procurementApproval';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import PageToolbar from '../../components/layout/PageToolbar';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { formatDate } from '../../utils/date';

const ApprovalTasksPage = () => {
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

  useEffect(() => {
    fetchApprovalTasks();
  }, []);

  const fetchApprovalTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const queue = await fetchRequisitionApprovalTasks(user);
      setTasks(queue);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching approval tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (task) => {
    try {
      setActionLoading(prev => ({ ...prev, [task.id]: true }));
      setError(null);

      await approveRequisitionTask(task, 'Approved via approval tasks dashboard');
      await fetchApprovalTasks();
      const info = getTaskInfo(task);
      add('Approved successfully', 'success');
      open('Approved', `${info.requisitionNumber || info.title || 'Item'} approved successfully.`);
    } catch (err) {
      setError(err.message);
      console.error('Error approving task:', err);
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

      await rejectRequisitionTask(task, rejectionReason);
      setShowRejectionModal(false);
      setRejectionReason('');
      setSelectedTask(null);
      await fetchApprovalTasks();
      const info = getTaskInfo(task);
      add('Rejected successfully', 'error');
      open('Rejected', `${info.requisitionNumber || info.title || 'Item'} rejected.`);
    } catch (err) {
      setError(err.message);
      console.error('Error rejecting task:', err);
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '₹0.00';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const getTaskInfo = (task) => {
    const instanceData = task.instance_data || {};
    const config = task.config || {};
    
    return {
      title: instanceData.title || 'Purchase Requisition',
      description: instanceData.description || '',
      requisitionId: instanceData.requisitionId || instanceData.requisition_id,
      requisitionNumber: instanceData.requisitionNumber || instanceData.requisition_number,
      totalAmount: instanceData.totalAmount || instanceData.total_amount || 0,
      requesterId: instanceData.requesterId || instanceData.requester_id,
      requesterName: instanceData.requesterName || instanceData.requester_name,
      departmentId: instanceData.departmentId || instanceData.department_id,
      departmentName: instanceData.departmentName || instanceData.department_name,
      siteId: instanceData.siteId || instanceData.site_id,
      siteName: instanceData.siteName || instanceData.site_name,
      projectId: instanceData.projectId || instanceData.project_id,
      projectName: instanceData.projectName || instanceData.project_name,
      nodeType: task.node_type || 'approval',
      nodeId: task.node_id || 'unknown'
    };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageToolbar description="Review and approve pending requisitions" />
        <div className="card">
          <div className="card-body">
            <div className="flex items-center justify-center py-12">
              <Loader className="animate-spin h-8 w-8 text-primary mr-3" />
              <span className="text-muted">Loading approval tasks...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageToolbar description="Review and approve pending requisitions">
        <button
          type="button"
          onClick={fetchApprovalTasks}
          disabled={loading}
          className="btn btn-secondary"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageToolbar>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-12">
            <CheckCircle className="h-16 w-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-fg mb-2">No Pending Approvals</h3>
            <p className="text-muted">You have no pending approval tasks at this time.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {tasks.map((task) => {
            const taskInfo = getTaskInfo(task);
            const isLoading = actionLoading[task.id];
            
            return (
              <div key={task.id} className="card hover:shadow-md transition-shadow">
                <div className="card-header">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-fg">
                        {taskInfo.requisitionNumber || 'N/A'}
                      </h3>
                      <p className="text-sm text-muted">{taskInfo.title}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Pending
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="card-body">
                  <div className="space-y-4 mb-4">
                    {/* Key PR Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-muted rounded-lg">
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Requested By</div>
                        <div className="font-medium text-fg">{taskInfo.requesterName || 'Unknown'}</div>
                        <div className="text-xs text-muted">{taskInfo.departmentName || 'N/A'}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Total Amount</div>
                        <div className="font-bold text-lg text-primary">{formatCurrency(taskInfo.totalAmount)}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Site</div>
                        <div className="font-medium text-fg">{taskInfo.siteName || 'N/A'}</div>
                        <div className="text-xs text-muted">{taskInfo.siteId ? `ID: ${taskInfo.siteId}` : ''}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-xs text-muted uppercase tracking-wide">Project</div>
                        <div className="font-medium text-fg">{taskInfo.projectName || 'N/A'}</div>
                        <div className="text-xs text-muted">{taskInfo.projectId ? `ID: ${taskInfo.projectId}` : ''}</div>
                      </div>
                    </div>

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
                    {taskInfo.requisitionId && (
                      <button
                        onClick={() => {
                          navigate(`/procurement/pr/requisition-details/${taskInfo.requisitionId}`, { state: { from: 'approvals' } });
                        }}
                        className="btn btn-secondary w-full"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Full Requisition Details
                      </button>
                    )}
                    
                    {/* Approval Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(task)}
                        disabled={isLoading}
                        className="btn btn-success flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <Loader className="animate-spin h-4 w-4 mr-2" />
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        {isLoading ? 'Approving...' : 'Approve'}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="card max-w-md w-full">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-fg">Reject Approval Task</h3>
            </div>
            
            <div className="card-body">
              <div className="mb-4">
                <p className="text-sm text-muted mb-2">
                  You are about to reject the approval task for:
                </p>
                <p className="font-medium text-fg">
                  {getTaskInfo(selectedTask).title}
                </p>
              </div>
              
              <div className="form-group">
                <label className="form-label required">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Please provide a detailed reason for rejection..."
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionReason('');
                    setSelectedTask(null);
                    setError(null);
                  }}
                  className="btn btn-secondary"
                  disabled={actionLoading[selectedTask.id]}
                >
                  Cancel
                </button>
                
                <button
                  onClick={() => handleReject(selectedTask)}
                  disabled={!rejectionReason.trim() || actionLoading[selectedTask.id]}
                  className="btn btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading[selectedTask.id] ? (
                    <>
                      <Loader className="animate-spin h-4 w-4 mr-2" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApprovalTasksPage;