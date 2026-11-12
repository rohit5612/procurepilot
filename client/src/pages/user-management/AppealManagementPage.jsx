import React, { useState, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Filter,
  Eye,
  MessageSquare,
  User,
  Calendar,
  Mail
} from 'lucide-react';
import { formatDate } from '../../utils/date';

const AppealManagementPage = () => {
  const [appeals, setAppeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({});
  const [selectedAppeal, setSelectedAppeal] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Review form
  const [reviewData, setReviewData] = useState({
    status: 'approved',
    notes: ''
  });

  useEffect(() => {
    fetchAppeals();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchAppeals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const params = new URLSearchParams({
        page: currentPage,
        limit: 10,
        search: searchTerm,
        status: statusFilter
      });

      const response = await fetch(`http://localhost:5000/api/user-appeals?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch appeals');
      }

      const data = await response.json();
      setAppeals(data.data);
      setStats(data.stats);
      setTotalPages(Math.ceil(data.stats.total_appeals / 10));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAppeal = async () => {
    try {
      setReviewing(true);
      const token = localStorage.getItem('accessToken');

      const response = await fetch(`http://localhost:5000/api/user-appeals/${selectedAppeal.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(reviewData)
      });

      if (!response.ok) {
        throw new Error('Failed to review appeal');
      }

      // Refresh appeals list
      await fetchAppeals();
      setShowReviewModal(false);
      setSelectedAppeal(null);
      setReviewData({ status: 'approved', notes: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing(false);
    }
  };

  const openReviewModal = (appeal) => {
    setSelectedAppeal(appeal);
    setReviewData({ status: 'approved', notes: '' });
    setShowReviewModal(true);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'badge-info', icon: Clock },
      approved: { color: 'badge-success', icon: CheckCircle },
      rejected: { color: 'badge-danger', icon: XCircle }
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDateTime = (dateString) => formatDate(dateString);

  if (loading && appeals.length === 0) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'var(--color-ring)' }}></div>
          <p className="mt-4 text-muted">Loading appeals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-fg mb-2">Appeal Management</h1>
          <p className="text-muted">Review and manage user appeals for suspended accounts</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card rounded-lg shadow p-6 border border-default">
            <div className="flex items-center">
              <div className="p-2 rounded-lg" style={{ background: 'var(--color-accent)' }}>
                <MessageSquare className="w-6 h-6" style={{ color: 'var(--color-accent-foreground)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Total Appeals</p>
                <p className="text-2xl font-bold text-fg">{stats.total_appeals || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border border-default">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-muted">
                <Clock className="w-6 h-6" style={{ color: 'var(--color-ring)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Pending</p>
                <p className="text-2xl font-bold text-fg">{stats.pending_appeals || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border border-default">
            <div className="flex items-center">
              <div className="p-2 rounded-lg" style={{ background: 'var(--color-chart-1)' }}>
                <CheckCircle className="w-6 h-6" style={{ color: 'var(--color-primary-foreground)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Approved</p>
                <p className="text-2xl font-bold text-fg">{stats.approved_appeals || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg shadow p-6 border border-default">
            <div className="flex items-center">
              <div className="p-2 rounded-lg bg-danger">
                <XCircle className="w-6 h-6" style={{ color: 'var(--color-destructive-foreground)' }} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-muted">Rejected</p>
                <p className="text-2xl font-bold text-fg">{stats.rejected_appeals || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card rounded-lg shadow mb-6 border border-default">
          <div className="p-6 border-b border-default">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
                  <input
                    type="text"
                    placeholder="Search by name, email, or appeal reason..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border rounded-lg focus:ring-1 ring-primary focus:border-transparent bg-card border-default"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-4 py-2 border rounded-lg focus:ring-1 ring-primary focus:border-transparent bg-card border-default"
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

        {/* Appeals Table */}
        <div className="bg-card rounded-lg shadow overflow-hidden border border-default">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-default">
              <thead className="bg-muted">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Appeal Reason
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-default">
                {appeals.map((appeal) => (
                  <tr key={appeal.id} className="hover-bg-muted">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                            <User className="w-5 h-5" style={{ color: 'var(--color-muted-foreground)' }} />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-fg">
                            {appeal.first_name} {appeal.last_name}
                          </div>
                          <div className="text-sm text-muted">{appeal.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-fg max-w-xs truncate">
                        {appeal.appeal_reason}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(appeal.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDateTime(appeal.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => openReviewModal(appeal)}
                        disabled={appeal.status !== 'pending'}
                        className={`inline-flex items-center px-3 py-1 border text-sm leading-4 font-medium rounded-md ${
                          appeal.status === 'pending'
                            ? 'bg-accent'
                            : 'bg-muted cursor-not-allowed'
                        }`}
                        style={{ color: appeal.status === 'pending' ? 'var(--color-accent-foreground)' : 'var(--color-muted-foreground)', borderColor: 'var(--color-border)' }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        {appeal.status === 'pending' ? 'Review' : 'Reviewed'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-default sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md bg-card hover-bg-muted disabled:opacity-50 border-default"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md bg-card hover-bg-muted disabled:opacity-50 border-default"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-muted">
                    Showing page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border bg-card text-sm font-medium hover-bg-muted disabled:opacity-50 border-default"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border bg-card text-sm font-medium hover-bg-muted disabled:opacity-50 border-default"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Review Modal */}
        {showReviewModal && selectedAppeal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-fg">Review Appeal</h3>
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="text-muted hover-text-primary"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                {/* Appeal Details */}
                <div className="bg-muted rounded-lg p-4 mb-6">
                  <h4 className="font-medium text-fg mb-3">Appeal Details</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-fg">User:</span>
                      <p className="text-fg">{selectedAppeal.first_name} {selectedAppeal.last_name}</p>
                      <p className="text-muted">{selectedAppeal.email}</p>
                    </div>
                    <div>
                      <span className="font-medium text-fg">Submitted:</span>
                      <p className="text-fg">{formatDateTime(selectedAppeal.created_at)}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-fg">Appeal Reason:</span>
                      <p className="text-fg">{selectedAppeal.appeal_reason}</p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-fg">Details:</span>
                      <p className="text-fg whitespace-pre-wrap">{selectedAppeal.appeal_details}</p>
                    </div>
                  </div>
                </div>

                {/* Review Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-fg mb-2">
                      Decision
                    </label>
                    <select
                      value={reviewData.status}
                      onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-1 ring-primary focus:border-transparent bg-card border-default"
                    >
                      <option value="approved">Approve</option>
                      <option value="rejected">Reject</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg mb-2">
                      Admin Notes (Optional)
                    </label>
                    <textarea
                      value={reviewData.notes}
                      onChange={(e) => setReviewData({ ...reviewData, notes: e.target.value })}
                      rows={4}
                      placeholder="Add any notes about your decision..."
                      className="w-full px-3 py-2 border rounded-lg focus:ring-1 ring-primary focus:border-transparent bg-card border-default"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2 rounded-lg text-fg hover-bg-muted border border-default"
                    disabled={reviewing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReviewAppeal}
                    disabled={reviewing}
                    className={`px-4 py-2 rounded-lg text-white disabled:opacity-50`}
                    style={{ background: reviewData.status === 'approved' ? 'var(--color-chart-1)' : 'var(--color-destructive)' }}
                  >
                    {reviewing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline"></div>
                        Processing...
                      </>
                    ) : (
                      `${reviewData.status === 'approved' ? 'Approve' : 'Reject'} Appeal`
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppealManagementPage;
