import { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Search, 
  Filter, 
  Eye,
  Check,
  X,
  Mail,
  Phone,
  Calendar,
  User,
  Building,
  FileText,
  ArrowUpDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../utils/date';

const UserApprovalPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveConfirmation, setShowApproveConfirmation] = useState(false);
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [statusSortDirection, setStatusSortDirection] = useState('asc'); // asc: pending->approved->rejected

  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, [currentPage, statusFilter, searchTerm, statusSortDirection]);

  const sortByApprovalStatus = (arr, direction = 'asc') => {
    const orderMap = { pending: 0, approved: 1, rejected: 2 };
    const factor = direction === 'desc' ? -1 : 1;
    return [...arr].sort((a, b) => {
      const aVal = orderMap[a.approval_status] ?? 999;
      const bVal = orderMap[b.approval_status] ?? 999;
      if (aVal === bVal) return 0;
      return aVal > bVal ? 1 * factor : -1 * factor;
    });
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`http://localhost:5000/api/user-approval/all?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const sorted = sortByApprovalStatus(data.data.users, statusSortDirection);
        setUsers(sorted);
        setTotalPages(data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:5000/api/user-approval/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleStatusSort = () => {
    const next = statusSortDirection === 'asc' ? 'desc' : 'asc';
    setStatusSortDirection(next);
  };

  const handleApprove = async (userId) => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5000/api/user-approval/approve/${userId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          approvedBy: currentUser.id
        })
      });

      if (response.ok) {
        setShowApproveConfirmation(false);
        setSelectedUser(null);
        fetchUsers();
        fetchStats();
      }
    } catch (error) {
      console.error('Error approving user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    try {
      setActionLoading(true);
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5000/api/user-approval/reject/${selectedUser.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rejectedBy: currentUser.id,
          rejectionReason
        })
      });

      if (response.ok) {
        closeAllModals();
        fetchUsers();
        fetchStats();
      }
    } catch (error) {
      console.error('Error rejecting user:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const openApproveConfirmation = (user) => {
    setSelectedUser(user);
    setShowApproveConfirmation(true);
  };

  const openRejectConfirmation = (user) => {
    setSelectedUser(user);
    setShowRejectConfirmation(true);
  };

  const openRejectModal = (user) => {
    setSelectedUser(user);
    setShowRejectModal(true);
  };

  const closeAllModals = () => {
    setShowApproveConfirmation(false);
    setShowRejectConfirmation(false);
    setShowRejectModal(false);
    setSelectedUser(null);
    setRejectionReason('');
  };

  const getStatusBadge = (status, emailVerified) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    
    switch (status) {
      case 'pending':
        return (
          <span className={`${baseClasses} badge-info`}>
            <Clock className="inline w-3 h-3 mr-1" />
            Pending Approval
          </span>
        );
      case 'approved':
        return (
          <span className={`${baseClasses} badge-success`}>
            <CheckCircle className="inline w-3 h-3 mr-1" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className={`${baseClasses} badge-danger`}>
            <XCircle className="inline w-3 h-3 mr-1" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getEmailStatusBadge = (verified) => {
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
    
    if (verified) {
      return (
        <span className={`${baseClasses} badge-success`}>
          <Mail className="inline w-3 h-3 mr-1" />
          Verified
        </span>
      );
    } else {
      return (
        <span className={`${baseClasses} bg-muted text-fg`}>
          <Mail className="inline w-3 h-3 mr-1" />
          Pending
        </span>
      );
    }
  };

  const formatDateTime = (dateString) => formatDate(dateString, 'N/A');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">User Approval Management</h1>
          <p className="text-muted">Manage pending user registrations and approvals</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-accent">
                <Users className="h-6 w-6" style={{ color: 'var(--color-accent-foreground)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Total Users</p>
                <p className="text-2xl font-bold text-fg">{stats.total_users || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-muted">
                <Clock className="h-6 w-6" style={{ color: 'var(--color-ring)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Pending Approval</p>
                <p className="text-2xl font-bold text-fg">{stats.pending_approval || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-chart-1)' }}>
                <CheckCircle className="h-6 w-6" style={{ color: 'var(--color-primary-foreground)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Approved</p>
                <p className="text-2xl font-bold text-fg">{stats.approved_users || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex items-center">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-danger">
                <XCircle className="h-6 w-6" style={{ color: 'var(--color-destructive-foreground)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Rejected</p>
                <p className="text-2xl font-bold text-fg">{stats.rejected_users || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-muted-foreground)' }} />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10 w-full"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="card-body">
          {loading ? (
            <div className="text-center py-8">
              <div className="spinner w-8 h-8 mx-auto"></div>
              <p className="text-muted mt-2">Loading users...</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-default">
                      <th className="text-left py-3 px-4 font-medium text-fg">User</th>
                      <th className="text-left py-3 px-4 font-medium text-fg">Contact</th>
                      <th className="text-left py-3 px-4 font-medium text-fg">Details</th>
                      <th className="text-left py-3 px-4 font-medium text-fg">
                        <button
                          type="button"
                          onClick={toggleStatusSort}
                          className="inline-flex items-center gap-1 hover-text-primary"
                          title={`Sort by status (${statusSortDirection === 'asc' ? 'Pending→Approved→Rejected' : 'Rejected→Approved→Pending'})`}
                        >
                          Status
                          <ArrowUpDown className="w-4 h-4" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-fg">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="border-b border-default hover-bg-muted">
                        <td className="py-4 px-4">
                          <div>
                            <p className="font-medium text-fg">{user.fullName}</p>
                            <p className="text-sm text-muted">@{user.username}</p>
                            <p className="text-xs text-muted">ID: {user.employee_id || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center text-sm">
                              <Mail className="w-4 h-4 mr-2" style={{ color: 'var(--color-muted-foreground)' }} />
                              {user.email}
                            </div>
                            {user.mobile_number && (
                              <div className="flex items-center text-sm">
                                <Phone className="w-4 h-4 mr-2" style={{ color: 'var(--color-muted-foreground)' }} />
                                {user.mobile_number}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-1">
                            {user.designation && (
                              <div className="flex items-center text-sm">
                                <User className="w-4 h-4 mr-2" style={{ color: 'var(--color-muted-foreground)' }} />
                                {user.designation}
                              </div>
                            )}
                            {user.date_of_birth && (
                              <div className="flex items-center text-sm">
                                <Calendar className="w-4 h-4 mr-2" style={{ color: 'var(--color-muted-foreground)' }} />
                                {formatDateTime(user.date_of_birth)}
                              </div>
                            )}
                            {user.aadhar_card && (
                              <div className="flex items-center text-sm">
                                <FileText className="w-4 h-4 mr-2" style={{ color: 'var(--color-muted-foreground)' }} />
                                Aadhar: {user.aadhar_card}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="space-y-2">
                            {getStatusBadge(user.approval_status, user.email_verified)}
                            {getEmailStatusBadge(user.email_verified)}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {user.approval_status === 'pending' ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => openApproveConfirmation(user)}
                                disabled={actionLoading}
                                className="btn btn-success btn-sm"
                              >
                                <Check className="w-4 h-4 mr-1" />
                                Approve
                              </button>
                              <button
                                onClick={() => openRejectConfirmation(user)}
                                disabled={actionLoading}
                                className="btn btn-danger btn-sm"
                              >
                                <X className="w-4 h-4 mr-1" />
                                Reject
                              </button>
                            </div>
                          ) : (
                            <div className="text-sm text-muted">
                              {user.approval_status === 'approved' && user.approvedBy && (
                                <p>Approved by {user.approvedBy}</p>
                              )}
                              {user.approval_status === 'rejected' && user.rejection_reason && (
                                <p>Rejected: {user.rejection_reason}</p>
                              )}
                              {user.approvalDate && (
                                <p className="text-xs text-muted">
                                  {formatDateTime(user.approvalDate)}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-secondary btn-sm"
                    >
                      Previous
                    </button>
                    <span className="flex items-center px-3 text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary btn-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveConfirmation && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md border border-default">
            <div className="flex items-center mb-4">
              <div className="p-2 rounded-lg mr-3" style={{ background: 'var(--color-chart-1)' }}>
                <CheckCircle className="w-6 h-6" style={{ color: 'var(--color-primary-foreground)' }} />
              </div>
              <h3 className="text-lg font-semibold text-fg">
                Confirm Approval
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-fg mb-3">
                Are you sure you want to approve this user?
              </p>
              <div className="bg-muted rounded-lg p-3">
                <p className="font-medium text-fg">{selectedUser.fullName}</p>
                <p className="text-sm text-muted">{selectedUser.email}</p>
                <p className="text-xs text-muted">@{selectedUser.username}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeAllModals}
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => handleApprove(selectedUser.id)}
                disabled={actionLoading}
                className="btn btn-success"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    Approve User
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Modal */}
      {showRejectConfirmation && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md border border-default">
            <div className="flex items-center mb-4">
              <div className="p-2 rounded-lg mr-3 bg-danger">
                <XCircle className="w-6 h-6" style={{ color: 'var(--color-destructive-foreground)' }} />
              </div>
              <h3 className="text-lg font-semibold text-fg">
                Confirm Rejection
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-fg mb-3">
                Are you sure you want to reject this user? This action will require them to provide a rejection reason.
              </p>
              <div className="bg-muted rounded-lg p-3">
                <p className="font-medium text-fg">{selectedUser.fullName}</p>
                <p className="text-sm text-muted">{selectedUser.email}</p>
                <p className="text-xs text-muted">@{selectedUser.username}</p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeAllModals}
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRejectConfirmation(false);
                  openRejectModal(selectedUser);
                }}
                disabled={actionLoading}
                className="btn btn-danger"
              >
                <X className="w-4 h-4 mr-1" />
                Continue to Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md border border-default">
            <h3 className="text-lg font-semibold text-fg mb-4">
              Reject User: {selectedUser?.fullName}
            </h3>
            <div className="mb-4">
              <label className="form-label">Rejection Reason</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="input"
                rows="3"
                placeholder="Enter reason for rejection..."
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={closeAllModals}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || actionLoading}
                className="btn btn-danger"
              >
                {actionLoading ? 'Rejecting...' : 'Reject User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserApprovalPage;
