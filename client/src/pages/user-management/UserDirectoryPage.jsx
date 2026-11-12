import { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Eye, 
  Edit, 
  MoreVertical,
  UserCheck,
  UserX,
  UserMinus,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { formatDate } from '../../utils/date';
import PageToolbar from '../../components/layout/PageToolbar';

const UserDirectoryPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSuspendedDialog, setShowSuspendedDialog] = useState(false);
  const [showProtectedDialog, setShowProtectedDialog] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showStatusConfirmation, setShowStatusConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState(null);
  const [suspensionData, setSuspensionData] = useState({
    reason: '',
    notes: ''
  });

  const limit = 10;

  useEffect(() => {
    fetchUsers();
  }, [currentPage, searchTerm, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      const params = new URLSearchParams({
        page: currentPage,
        limit,
        search: searchTerm,
        status: statusFilter !== 'all' ? statusFilter : '',
        approved: 'true' // Only fetch approved users
      });

      const response = await fetch(`http://localhost:5000/api/users/directory?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
      setTotalPages(Math.ceil(data.total / limit));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdateClick = (userId, newStatus, userName) => {
    setPendingStatusUpdate({ userId, newStatus, userName });
    setShowStatusConfirmation(true);
  };

  const handleStatusUpdateConfirm = async () => {
    if (!pendingStatusUpdate) return;
    
    const { userId, newStatus } = pendingStatusUpdate;
    
    try {
      setUpdatingStatus(true);
      setError(null); // Clear any previous errors
      const token = localStorage.getItem('accessToken');
      
      // Prepare request body
      const requestBody = { status: newStatus };
      
      // Add suspension data if suspending
      if (newStatus === 'suspended') {
        requestBody.reason = suspensionData.reason;
        requestBody.notes = suspensionData.notes;
      }
      
      const response = await fetch(`http://localhost:5000/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update user status');
      }

      // Update the user in the local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, status: newStatus } : user
        )
      );

      // Close modals if open
      setShowViewModal(false);
      setShowEditModal(false);
      setShowSuspendedDialog(false);
      setShowProtectedDialog(false);
      setShowStatusConfirmation(false);
      setSelectedUser(null);
    } catch (err) {
      console.error('Status update error:', err);
      
      // Show more specific error message
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Authentication failed. Please log in again.');
      } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
        setError('You do not have permission to perform this action.');
      } else if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
        setError('Server error occurred. Please try again.');
      } else {
        setError(err.message);
      }
      
      // Refresh the user list to get the latest status
      await fetchUsers();
    } finally {
      setUpdatingStatus(false);
      setPendingStatusUpdate(null);
    }
  };

  const handleStatusUpdateCancel = () => {
    setShowStatusConfirmation(false);
    setPendingStatusUpdate(null);
    setSuspensionData({ reason: '', notes: '' });
  };

  const handleDeleteConfirm = async () => {
    try {
      setUpdatingStatus(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5000/api/users/${selectedUser.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'User account permanently deleted by administrator'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to archive and delete user');
      }

      // Refresh the user list to get the latest data
      await fetchUsers();
      
      setShowDeleteConfirmation(false);
      setSelectedUser(null);
      setSuccessMessage(`${selectedUser.first_name} ${selectedUser.last_name} has been archived and permanently deleted.`);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
    } catch (err) {
      console.error('Delete user error:', err);
      
      // Show more specific error message
      if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        setError('Authentication failed. Please log in again.');
      } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
        setError('You do not have permission to perform this action.');
      } else if (err.message.includes('500') || err.message.includes('Internal Server Error')) {
        setError('Server error occurred. Please try again.');
      } else {
        setError(err.message);
      }
      
      // Refresh the user list to get the latest status
      await fetchUsers();
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { color: 'badge-success', icon: UserCheck, label: 'Active' },
      inactive: { color: 'bg-muted text-fg', icon: UserX, label: 'Inactive' },
      suspended: { color: 'badge-danger', icon: UserMinus, label: 'Suspended' }
    };

    const config = statusConfig[status] || statusConfig.inactive;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    
    // If user is protected, show protected dialog
    if (user.is_protected) {
      setShowProtectedDialog(true);
      return;
    }
    
    // If user is suspended, show suspended dialog instead of edit modal
    if (user.status === 'suspended') {
      setShowSuspendedDialog(true);
    } else {
      setShowEditModal(true);
    }
  };

  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setShowDeleteConfirmation(true);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchUsers();
  };

  const handleFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  if (loading && users.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="spinner w-8 h-8"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageToolbar description="Manage approved users and their account status">
        <button
          type="button"
          onClick={fetchUsers}
          disabled={loading}
          className="btn btn-secondary flex items-center"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageToolbar>

      {/* Search and Filter */}
      <div className="mb-6 bg-card rounded-lg shadow p-4 border border-default">
        <div className="flex flex-col md:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
              <input
                type="text"
                placeholder="Search by name, email, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
          </form>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" style={{ color: 'var(--color-muted-foreground)' }} />
            <select
              value={statusFilter}
              onChange={handleFilterChange}
              className="input"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-danger/10 border border-default rounded-lg flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2" style={{ color: 'var(--color-destructive)' }} />
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 p-4 bg-muted border border-default rounded-lg flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" style={{ color: 'var(--color-chart-1)' }} />
          <p className="text-sm text-fg">{successMessage}</p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card rounded-lg shadow overflow-hidden border border-default">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y border-default">
            <thead className="bg-muted">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Department & Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Account Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y border-default">
              {users.map((user) => (
                <tr key={user.id} className="hover-bg-muted">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                          <span className="text-sm font-medium" style={{ color: 'var(--color-accent-foreground)' }}>
                            {user.first_name?.charAt(0)}{user.last_name?.charAt(0)}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-fg">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-muted">
                          {user.email}
                        </div>
                        <div className="text-xs text-muted">
                          @{user.username}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-fg">
                      {user.department_name || 'Not Assigned'}
                    </div>
                    <div className="text-sm text-muted">
                      {user.role_name || 'No Role'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(user.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                    {user.last_login 
                      ? formatDate(user.last_login)
                      : 'Never'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleViewUser(user)}
                        className="text-primary hover-text-primary p-1"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditUser(user)}
                        disabled={user.is_protected}
                        className={`p-1 ${
                          user.is_protected 
                            ? 'text-muted cursor-not-allowed' 
                            : 'text-primary hover-text-primary'
                        }`}
                        title={user.is_protected ? 'Protected Account - Cannot Edit' : 'Edit User'}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(user)}
                        disabled={user.is_protected || user.is_superuser}
                        className={`p-1 ${
                          user.is_protected || user.is_superuser
                            ? 'text-muted cursor-not-allowed' 
                            : 'text-danger'
                        }`}
                        title={
                          user.is_protected 
                            ? 'Protected Account - Cannot Delete' 
                            : user.is_superuser
                            ? 'Superuser Account - Cannot Delete'
                            : 'Delete User'
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {users.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12" style={{ color: 'var(--color-muted-foreground)' }} />
            <h3 className="mt-2 text-sm font-medium text-fg">No users found</h3>
            <p className="mt-1 text-sm text-muted">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'No approved users in the directory yet.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-fg">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* View User Modal */}
      {showViewModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">User Details</h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Personal Information</h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Full Name</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.first_name} {selectedUser.last_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.email}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Username</dt>
                    <dd className="text-sm text-gray-900">@{selectedUser.username}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Mobile Number</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.mobile_number || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Employee ID</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.employee_id || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Designation</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.designation || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Date of Birth</dt>
                    <dd className="text-sm text-gray-900">
                      {selectedUser.date_of_birth 
                        ? formatDate(selectedUser.date_of_birth)
                        : 'Not provided'
                      }
                    </dd>
                  </div>
                </dl>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Account Information</h3>
                <dl className="space-y-2">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Account Status</dt>
                    <dd className="text-sm">{getStatusBadge(selectedUser.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Department</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.department_name || 'Not Assigned'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Role</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.role_name || 'No Role'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Email Verified</dt>
                    <dd className="text-sm text-gray-900">
                      {selectedUser.email_verified ? 'Yes' : 'No'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Last Login</dt>
                    <dd className="text-sm text-gray-900">
                      {selectedUser.last_login 
                        ? new Date(selectedUser.last_login).toLocaleString()
                        : 'Never'
                      }
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Login Count</dt>
                    <dd className="text-sm text-gray-900">{selectedUser.login_count || 0}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Member Since</dt>
                    <dd className="text-sm text-gray-900">
                      {formatDate(selectedUser.created_at)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  handleEditUser(selectedUser);
                }}
                className="btn btn-primary"
              >
                Edit User
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Edit User Status</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-4">
                Update account status for <strong>{selectedUser.first_name} {selectedUser.last_name}</strong>
              </p>
              
              <div className="space-y-3">
                {/* Show different options based on current status */}
                {selectedUser.status === 'active' ? (
                  <>
                    <button
                      onClick={() => handleStatusUpdateClick(selectedUser.id, 'inactive', `${selectedUser.first_name} ${selectedUser.last_name}`)}
                      disabled={updatingStatus}
                      className="w-full p-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left transition-colors"
                    >
                      <div className="flex items-center">
                        <UserX className="w-5 h-5 mr-3" />
                        <div>
                          <div className="font-medium">Deactivate Account</div>
                          <div className="text-sm opacity-75">User cannot login temporarily</div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleStatusUpdateClick(selectedUser.id, 'suspended', `${selectedUser.first_name} ${selectedUser.last_name}`)}
                      disabled={updatingStatus}
                      className="w-full p-3 rounded-lg border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 text-left transition-colors"
                    >
                      <div className="flex items-center">
                        <UserMinus className="w-5 h-5 mr-3" />
                        <div>
                          <div className="font-medium">Suspend Account</div>
                          <div className="text-sm opacity-75">User account is suspended due to violations</div>
                        </div>
                      </div>
                    </button>
                  </>
                ) : selectedUser.status === 'inactive' ? (
                  <>
                    <button
                      onClick={() => handleStatusUpdateClick(selectedUser.id, 'active', `${selectedUser.first_name} ${selectedUser.last_name}`)}
                      disabled={updatingStatus}
                      className="w-full p-3 rounded-lg border-2 border-gray-200 hover:border-green-300 hover:bg-green-50 text-left transition-colors"
                    >
                      <div className="flex items-center">
                        <UserCheck className="w-5 h-5 mr-3" />
                        <div>
                          <div className="font-medium">Activate Account</div>
                          <div className="text-sm opacity-75">User can login and access the system</div>
                        </div>
                      </div>
                    </button>
                    
                    <button
                      onClick={() => handleStatusUpdateClick(selectedUser.id, 'suspended', `${selectedUser.first_name} ${selectedUser.last_name}`)}
                      disabled={updatingStatus}
                      className="w-full p-3 rounded-lg border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 text-left transition-colors"
                    >
                      <div className="flex items-center">
                        <UserMinus className="w-5 h-5 mr-3" />
                        <div>
                          <div className="font-medium">Suspend Account</div>
                          <div className="text-sm opacity-75">User account is suspended due to violations</div>
                        </div>
                      </div>
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn btn-secondary"
                disabled={updatingStatus}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

             {/* Suspended User Dialog */}
       {showSuspendedDialog && selectedUser && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold text-gray-900">Suspended User</h2>
               <button
                 onClick={() => setShowSuspendedDialog(false)}
                 className="text-gray-400 hover:text-gray-600"
               >
                 <span className="sr-only">Close</span>
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>
             
             <div className="mb-6">
               <div className="flex items-center justify-center mb-4">
                 <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                   <UserMinus className="w-8 h-8 text-red-600" />
                 </div>
               </div>
               
               <div className="text-center">
                 <h3 className="text-lg font-medium text-gray-900 mb-2">
                   {selectedUser.first_name} {selectedUser.last_name}
                 </h3>
                 <p className="text-sm text-gray-600 mb-4">
                   This user account has been suspended and cannot access the system.
                 </p>
                 <p className="text-xs text-gray-500 mb-4">
                   Suspended accounts require administrative intervention to be reactivated.
                 </p>
                 
                 <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                   <p className="text-sm text-blue-800">
                     <strong>Appeal Process:</strong> Users can submit appeals through the public appeal form.
                   </p>
                   <a 
                     href={`/appeal/${selectedUser.id}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="text-blue-600 hover:text-blue-800 underline text-sm mt-1 inline-block"
                   >
                     View Appeal Form →
                   </a>
                 </div>
                 
                 <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                   <p className="text-sm text-yellow-800">
                     <strong>Note:</strong> Suspended accounts can only be reactivated through the appeal process.
                   </p>
                 </div>
               </div>
             </div>
             
             <div className="flex justify-end">
               <button
                 onClick={() => setShowSuspendedDialog(false)}
                 className="btn btn-secondary"
               >
                 Close
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Protected User Dialog */}
       {showProtectedDialog && selectedUser && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold text-gray-900">Protected Account</h2>
               <button
                 onClick={() => setShowProtectedDialog(false)}
                 className="text-gray-400 hover:text-gray-600"
               >
                 <span className="sr-only">Close</span>
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>
             
             <div className="mb-6">
               <div className="flex items-center justify-center mb-4">
                 <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                   <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                   </svg>
                 </div>
               </div>
               
               <div className="text-center">
                 <h3 className="text-lg font-medium text-gray-900 mb-2">
                   {selectedUser.first_name} {selectedUser.last_name}
                 </h3>
                 <p className="text-sm text-gray-600 mb-4">
                   This is a protected administrator account and cannot be modified.
                 </p>
                 <p className="text-xs text-gray-500">
                   Protected accounts are essential for system security and cannot be edited or deleted.
                 </p>
               </div>
             </div>
             
             <div className="flex justify-end">
               <button
                 onClick={() => setShowProtectedDialog(false)}
                 className="btn btn-secondary"
               >
                 Close
               </button>
             </div>
           </div>
         </div>
       )}

             {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Confirm Permanent Deletion</h2>
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setSelectedUser(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
              </div>
              
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {selectedUser.first_name} {selectedUser.last_name}
                </h3>
                                  <p className="text-sm text-gray-600 mb-4">
                    Are you sure you want to permanently delete this user? This action cannot be undone.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-red-800">
                      <strong>Warning:</strong> This will:
                    </p>
                    <ul className="text-sm text-red-700 list-disc list-inside mt-2">
                      <li>Permanently delete the user's account</li>
                      <li>Archive all user data for audit purposes</li>
                      <li>Remove all role assignments</li>
                      <li>Require re-registration if access is needed again</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-blue-800">
                      <strong>Data Archival:</strong> The user's data will be securely archived for audit purposes before deletion.
                    </p>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Consider deactivating or suspending the account instead if temporary restriction is needed.
                    </p>
                  </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setSelectedUser(null);
                }}
                className="btn btn-secondary"
                disabled={updatingStatus}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={updatingStatus}
                className="btn btn-danger"
              >
                {updatingStatus ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Confirmation Dialog */}
      {showStatusConfirmation && pendingStatusUpdate && (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-xl font-bold text-gray-900">Confirm Status Update</h2>
               <button
                 onClick={handleStatusUpdateCancel}
                 className="text-gray-400 hover:text-gray-600"
               >
                 <span className="sr-only">Close</span>
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                 </svg>
               </button>
             </div>
             
             <div className="mb-6">
               <div className="flex items-center justify-center mb-4">
                 <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                   pendingStatusUpdate.newStatus === 'active' ? 'bg-green-100' :
                   pendingStatusUpdate.newStatus === 'inactive' ? 'bg-gray-100' :
                   'bg-red-100'
                 }`}>
                   {pendingStatusUpdate.newStatus === 'active' ? (
                     <UserCheck className="w-8 h-8 text-green-600" />
                   ) : pendingStatusUpdate.newStatus === 'inactive' ? (
                     <UserX className="w-8 h-8 text-gray-600" />
                   ) : (
                     <UserMinus className="w-8 h-8 text-red-600" />
                   )}
                 </div>
               </div>
               
               <div className="text-center">
                 <h3 className="text-lg font-medium text-gray-900 mb-2">
                   {pendingStatusUpdate.userName}
                 </h3>
                 <p className="text-sm text-gray-600 mb-4">
                   Are you sure you want to {pendingStatusUpdate.newStatus === 'active' ? 'activate' : 
                   pendingStatusUpdate.newStatus === 'inactive' ? 'deactivate' : 'suspend'} this user account?
                 </p>
                 <p className="text-xs text-gray-500">
                   {pendingStatusUpdate.newStatus === 'active' ? 
                     'The user will be able to login and access the system.' :
                   pendingStatusUpdate.newStatus === 'inactive' ? 
                     'The user will not be able to login temporarily.' :
                     'The user account will be suspended due to violations.'}
                 </p>
               </div>
               
               {/* Suspension Form Fields */}
               {pendingStatusUpdate.newStatus === 'suspended' && (
                 <div className="mt-6 space-y-4">
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Suspension Reason *
                     </label>
                     <input
                       type="text"
                       value={suspensionData.reason}
                       onChange={(e) => setSuspensionData({ ...suspensionData, reason: e.target.value })}
                       placeholder="Enter reason for suspension"
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                       required
                     />
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700 mb-2">
                       Additional Notes (Optional)
                     </label>
                     <textarea
                       value={suspensionData.notes}
                       onChange={(e) => setSuspensionData({ ...suspensionData, notes: e.target.value })}
                       placeholder="Add any additional notes or details"
                       rows={3}
                       className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                     />
                   </div>
                   
                   <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                     <p className="text-sm text-yellow-800">
                       <strong>Note:</strong> The user will receive an email notification about the suspension and instructions for the appeal process.
                     </p>
                   </div>
                 </div>
               )}
             </div>
             
             <div className="flex justify-end space-x-3">
               <button
                 onClick={handleStatusUpdateCancel}
                 className="btn btn-secondary"
                 disabled={updatingStatus}
               >
                 Cancel
               </button>
               <button
                 onClick={handleStatusUpdateConfirm}
                 className={`btn ${
                   pendingStatusUpdate.newStatus === 'active' ? 'btn-success' :
                   pendingStatusUpdate.newStatus === 'inactive' ? 'btn-warning' :
                   'btn-danger'
                 }`}
                 disabled={updatingStatus || (pendingStatusUpdate.newStatus === 'suspended' && !suspensionData.reason.trim())}
               >
                 {updatingStatus ? 'Updating...' : 
                   pendingStatusUpdate.newStatus === 'active' ? 'Activate' :
                   pendingStatusUpdate.newStatus === 'inactive' ? 'Deactivate' :
                   'Suspend'}
               </button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
};

export default UserDirectoryPage;
