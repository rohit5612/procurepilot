import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
  Edit, 
  Trash2, 
  Send,
  MoreVertical,
  Calendar,
  User,
  Building,
  IndianRupee,
  FileText,
  Plus
} from 'lucide-react';
import RequisitionStatus from './RequisitionStatus.jsx';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import { formatDate } from '../../utils/date';

const RequisitionList = ({ requisitions, loading, onAction, pagination, onPageChange, approvableIds = new Set(), canApproveAtAll = false }) => {
  const [actionLoading, setActionLoading] = useState({});
  const { add } = useToastContext() || { add: () => {} };

  const handleAction = async (action, requisitionId, data = {}) => {
    try {
      setActionLoading(prev => ({ ...prev, [`${action}-${requisitionId}`]: true }));
      await onAction(action, requisitionId, data);
      if (action === 'submit') add('Requisition submitted', 'success');
      if (action === 'approve') add('Requisition approved', 'success');
      if (action === 'reject') add('Requisition rejected', 'error');
      if (action === 'withdraw') add('Requisition withdrawn', 'success');
    } catch (error) {
      add(error?.message || 'Action failed', 'error', 4000);
    } finally {
      setActionLoading(prev => ({ ...prev, [`${action}-${requisitionId}`]: false }));
    }
  };


  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (requisitions.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center py-12">
          <FileText size={48} className="text-muted mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-fg mb-2">No Requisitions Found</h3>
          <p className="text-muted mb-6">Get started by creating your first purchase requisition</p>
          <Link
            to="/procurement/pr/create-requisition"
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} className="mr-1" />
            Create
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">Requisitions</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Requisition
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Requester
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Department
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Total Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {requisitions.map((requisition) => (
              <tr key={requisition.id} className="hover-bg-muted">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-fg">
                      {requisition.title}
                    </div>
                    <div className="text-sm text-muted">
                      #{requisition.requisition_number}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <User size={16} className="text-muted mr-2" />
                    <div className="text-sm text-fg">
                      {requisition.requester_name || 'N/A'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Building size={16} className="text-muted mr-2" />
                    <div className="text-sm text-fg">
                      {requisition.department_name || 'N/A'}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <RequisitionStatus status={requisition.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <IndianRupee size={16} className="text-muted mr-1" />
                    <div className="text-sm text-fg">
                      {formatCurrency(requisition.total_amount)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <Calendar size={16} className="text-muted mr-2" />
                    <div className="text-sm text-fg">
                      {formatDate(requisition.created_at)}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/procurement/pr/requisition-details/${requisition.id}`}
                      className="btn btn-secondary btn-sm"
                      title="View Details"
                    >
                      <Eye size={14} />
                    </Link>
                    
                    {requisition.status === 'draft' && (
                      <>
                        <Link
                          to={`/procurement/pr/requisition-edit/${requisition.id}`}
                          className="btn btn-secondary btn-sm"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </Link>
                        <button
                          onClick={() => handleAction('withdraw', requisition.id)}
                          disabled={actionLoading[`withdraw-${requisition.id}`]}
                          className="btn btn-danger btn-sm"
                          title="Withdraw"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    
                    {requisition.status === 'draft' && (
                      <button
                        onClick={() => handleAction('submit', requisition.id)}
                        disabled={actionLoading[`submit-${requisition.id}`]}
                        className="btn btn-success btn-sm"
                        title="Submit for Approval"
                      >
                        <Send size={14} />
                      </button>
                    )}
                    {(requisition.status === 'submitted' || requisition.status === 'pending_approval') && canApproveAtAll && approvableIds.has(requisition.id) && (
                      <>
                        <button
                          onClick={() => handleAction('approve', requisition.id)}
                          disabled={actionLoading[`approve-${requisition.id}`]}
                          className="btn btn-success btn-sm"
                          title="Approve"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction('reject', requisition.id)}
                          disabled={actionLoading[`reject-${requisition.id}`]}
                          className="btn btn-danger btn-sm"
                          title="Reject"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="card-body border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-muted">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RequisitionList;
