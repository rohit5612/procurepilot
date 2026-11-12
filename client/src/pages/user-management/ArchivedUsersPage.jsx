import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Mail, 
  Phone, 
  Building, 
  Shield,
  Archive,
  Eye,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { formatDate } from '../../utils/date';

const API_BASE_URL = 'http://localhost:5000';

const ArchivedUsersPage = () => {
  const { user } = useAuth();
  const accessToken = localStorage.getItem('accessToken');
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    thisWeek: 0
  });

  const fetchArchivedUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(
        `${API_BASE_URL}/api/users/archived?page=${currentPage}&limit=10&search=${encodeURIComponent(searchTerm)}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Invalid response format');
      }

      const data = await response.json();
      setArchivedUsers(data.archivedUsers || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error('Error fetching archived users:', err);
      setError('Failed to fetch archived users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/archived/stats`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchArchivedUsers();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm]);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchArchivedUsers();
  };

  const handleRefresh = () => {
    fetchArchivedUsers();
    fetchStats();
  };

  const formatDateFriendly = (dateString) => formatDate(dateString, 'N/A');

  const getStatusBadge = (status) => {
    const statusColors = {
      'active': 'badge-success',
      'inactive': 'bg-muted text-fg',
      'suspended': 'badge-danger',
      'pending': 'badge-info'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'}
      </span>
    );
  };

  const getArchiveReasonBadge = (reason) => {
    const reasonColors = {
      'User requested deletion': 'bg-accent',
      'Admin initiated deletion': 'bg-accent',
      'Account violation': 'badge-danger',
      'Migrated from soft-deleted user': 'bg-accent'
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${reasonColors[reason] || 'bg-gray-100 text-gray-800'}`}>
        {reason || 'No reason provided'}
      </span>
    );
  };

  if (loading && archivedUsers.length === 0) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card p-6 rounded-lg shadow border border-default">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              ))}
            </div>
            <div className="bg-card rounded-lg shadow border border-default">
              <div className="h-16 bg-muted rounded-t-lg"></div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-card border-b border-default"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-fg flex items-center gap-3">
              <Archive className="h-8 w-8" style={{ color: 'var(--color-muted-foreground)' }} />
              Archived Users
            </h1>
            <p className="mt-2 text-muted">
              View permanently deleted users and their archival information
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Archive className="h-6 w-6" style={{ color: 'var(--color-muted-foreground)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      Total Archived Users
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.total}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-6 w-6" style={{ color: 'var(--color-muted-foreground)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      Archived This Month
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.thisMonth}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <RefreshCw className="h-6 w-6" style={{ color: 'var(--color-muted-foreground)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      Archived This Week
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.thisWeek}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-card shadow rounded-lg mb-6 border border-default">
          <div className="p-6">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-muted-foreground)' }} />
                  <input
                    type="text"
                    placeholder="Search by name, email, or username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border rounded-md leading-5 bg-card placeholder:text-muted focus:outline-none focus:ring-1 ring-primary border-default sm:text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white"
                style={{ background: 'var(--color-ring)' }}
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-muted border border-default rounded-md p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-destructive)' }} />
              <div className="ml-3">
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-destructive)' }}>
                  Error
                </h3>
                <div className="mt-2 text-sm" style={{ color: 'var(--color-destructive)' }}>
                  {error}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archived Users Table */}
        <div className="bg-card shadow rounded-lg overflow-hidden border border-default">
          <div className="px-6 py-4 border-b border-default">
            <h3 className="text-lg leading-6 font-medium text-fg">
              Archived Users ({totalCount})
            </h3>
          </div>
          
          {archivedUsers.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="mx-auto h-12 w-12" style={{ color: 'var(--color-muted-foreground)' }} />
              <h3 className="mt-2 text-sm font-medium text-fg">No archived users</h3>
              <p className="mt-1 text-sm text-muted">
                {searchTerm ? 'No users found matching your search criteria.' : 'No users have been archived yet.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Status at Archive
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Archive Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Archived By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Archive Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-default">
                  {archivedUsers.map((user) => (
                    <tr key={user.id} className="hover-bg-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-5 w-5" style={{ color: 'var(--color-muted-foreground)' }} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-fg">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-sm text-muted">
                              ID: {user.original_user_id}
                            </div>
                            {user.employee_id && (
                              <div className="text-sm text-muted">
                                Employee ID: {user.employee_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-fg">
                          <div className="flex items-center mb-1">
                            <Mail className="h-4 w-4 mr-2" style={{ color: 'var(--color-muted-foreground)' }} />
                            {user.email}
                          </div>
                          {user.mobile_number && (
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2" style={{ color: 'var(--color-muted-foreground)' }} />
                              {user.mobile_number}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.status)}
                        {user.is_protected && (
                          <div className="mt-1">
                            <Shield className="h-4 w-4 inline mr-1" style={{ color: 'var(--color-ring)' }} />
                            <span className="text-xs" style={{ color: 'var(--color-ring)' }}>Protected</span>
                          </div>
                        )}
                        {user.is_superuser && (
                          <div className="mt-1">
                            <Shield className="h-4 w-4 inline mr-1" style={{ color: 'var(--color-destructive)' }} />
                            <span className="text-xs" style={{ color: 'var(--color-destructive)' }}>Superuser</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getArchiveReasonBadge(user.archive_reason)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                        {user.archived_by_user || 'System'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {formatDateFriendly(user.archived_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDetails(true);
                          }}
                          className="text-primary hover-text-primary flex items-center"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-default sm:px-6 mt-6 rounded-lg shadow">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md bg-card hover-bg-muted disabled:opacity-50 disabled:cursor-not-allowed border-default"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md bg-card hover-bg-muted disabled:opacity-50 disabled:cursor-not-allowed border-default"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted">
                  Showing page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span> pages
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border bg-card text-sm font-medium hover-bg-muted disabled:opacity-50 disabled:cursor-not-allowed border-default"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border bg-card text-sm font-medium hover-bg-muted disabled:opacity-50 disabled:cursor-not-allowed border-default"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* User Details Modal */}
        {showDetails && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-fg">
                    Archived User Details
                  </h3>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-muted hover-text-primary"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-fg">Full Name</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.first_name} {selectedUser.last_name}</p>
                    </div>
                    <div>
                      <label className="block text sm font-medium text-fg">Email</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Username</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.username}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Mobile Number</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.mobile_number || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Employee ID</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.employee_id || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Designation</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.designation || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Date of Birth</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.date_of_birth || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Status at Archive</label>
                      <div className="mt-1">{getStatusBadge(selectedUser.status)}</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Archive Reason</label>
                    <p className="mt-1 text-sm text-fg">{selectedUser.archive_reason || 'No reason provided'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-fg">Archive Notes</label>
                    <p className="mt-1 text-sm text-fg">{selectedUser.archive_notes || 'No notes provided'}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-fg">Archived By</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.archived_by_user || 'System'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Archive Date</label>
                      <p className="mt-1 text-sm text-fg">{formatDateFriendly(selectedUser.archived_at)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Original User ID</label>
                      <p className="mt-1 text-sm text-fg">{selectedUser.original_user_id}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-fg">Created Date</label>
                      <p className="mt-1 text-sm text-fg">{formatDateFriendly(selectedUser.created_at)}</p>
                    </div>
                  </div>

                  {selectedUser.archived_user_roles && selectedUser.archived_user_roles.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-fg mb-2">Role History</label>
                      <div className="bg-muted rounded-md p-3">
                        {selectedUser.archived_user_roles.map((role, index) => (
                          <div key={index} className="flex items-center justify-between py-1">
                            <span className="text-sm text-fg">
                              {role.role_name} ({role.department_name})
                            </span>
                            <span className="text-xs text-muted">
                              {formatDateFriendly(role.assigned_at)} - {role.unassigned_at ? formatDateFriendly(role.unassigned_at) : 'Active'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-muted border border-default rounded-md p-4">
                    <div className="flex">
                      <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-ring)' }} />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium" style={{ color: 'var(--color-ring)' }}>
                          Important Note
                        </h3>
                        <div className="mt-2 text-sm" style={{ color: 'var(--color-ring)' }}>
                          This user has been permanently deleted from the system. The data shown above is for audit purposes only and cannot be restored.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowDetails(false)}
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                  >
                    Close
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

export default ArchivedUsersPage;
