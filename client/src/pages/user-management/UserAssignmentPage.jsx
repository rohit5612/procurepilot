import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissionRefresh } from '../../hooks/usePermissionRefresh';
import { 
  UserCheck, 
  ArrowRight, 
  Users, 
  Target, 
  Plus,
  Search,
  Filter,
  Edit,
  UserX,
  ArrowLeftRight,
  Eye,
  CheckCircle,
  AlertCircle,
  Building,
  Shield,
  Calendar,
  User,
  X
} from 'lucide-react';
import { formatDate } from '../../utils/date';

const API_BASE_URL = 'http://localhost:5000';

const UserAssignmentPage = () => {
  const { user } = useAuth();
  const { manualRefresh } = usePermissionRefresh();
  const accessToken = localStorage.getItem('accessToken');
  
  const [availableUsers, setAvailableUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [statistics, setStatistics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  
  const [assignmentForm, setAssignmentForm] = useState({
    userId: '',
    departmentId: '',
    roleId: '',
    notes: ''
  });
  
  const [transferForm, setTransferForm] = useState({
    userId: '',
    newDepartmentId: '',
    newRoleId: '',
    transferReason: ''
  });

  // Fetch all required data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!accessToken) {
        throw new Error('No access token found. Please log in again.');
      }
      
      console.log('Fetching data with token:', accessToken?.substring(0, 20) + '...');
      
      const [usersRes, deptRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/users/assignment/available`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${API_BASE_URL}/api/departments`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${API_BASE_URL}/api/users/assignment/statistics`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      console.log('Response status:', { 
        users: usersRes.status, 
        departments: deptRes.status, 
        stats: statsRes.status 
      });

      if (!usersRes.ok || !deptRes.ok || !statsRes.ok) {
        // Get error details
        const usersError = !usersRes.ok ? await usersRes.text() : null;
        const deptError = !deptRes.ok ? await deptRes.text() : null;
        const statsError = !statsRes.ok ? await statsRes.text() : null;
        
        console.error('API Errors:', { usersError, deptError, statsError });
        throw new Error(`API Error - Users: ${usersRes.status}, Deps: ${deptRes.status}, Stats: ${statsRes.status}`);
      }

      const [usersData, deptData, statsData] = await Promise.all([
        usersRes.json(),
        deptRes.json(),
        statsRes.json()
      ]);

      console.log('Received data:', { 
        usersCount: usersData?.data?.length || 0,
        deptsCount: deptData?.data?.length || 0,
        stats: statsData?.data
      });

      const available = Array.isArray(usersData.data) ? usersData.data : [];
      const departmentsList = Array.isArray(deptData.data) ? deptData.data : [];
      const statsPayload = statsData?.data || {};

      // Derive cards: total_users = assigned + unassigned(available), recent_transfers from overview
      const overview = statsPayload.overview || {};
      const assignedUsers = Number(overview.total_assigned_users || 0);
      const recentTransfers = Number(overview.total_transfers || 0);
      const unassignedUsers = available.length;
      const totalUsers = assignedUsers + unassignedUsers;

      setAvailableUsers(available);
      setDepartments(departmentsList);
      setStatistics({
        total_users: totalUsers,
        assigned_users: assignedUsers,
        unassigned_users: unassignedUsers,
        recent_transfers: recentTransfers,
        overview,
        by_department: statsPayload.by_department || [],
        generated_at: statsPayload.generated_at
      });
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Failed to load user assignment data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles for selected department
  const fetchRolesForDepartment = async (departmentId) => {
    if (!departmentId) {
      setRoles([]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/roles/department/${departmentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      setRoles(data.data || []);
    } catch (err) {
      console.error('Error fetching roles:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (assignmentForm.departmentId) {
      fetchRolesForDepartment(assignmentForm.departmentId);
    }
  }, [assignmentForm.departmentId]);

  useEffect(() => {
    if (transferForm.newDepartmentId) {
      fetchRolesForDepartment(transferForm.newDepartmentId);
    }
  }, [transferForm.newDepartmentId]);

  // Handle user assignment
  const handleAssignUser = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/assignment/assign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: parseInt(assignmentForm.userId),
          departmentId: parseInt(assignmentForm.departmentId),
          roleId: parseInt(assignmentForm.roleId),
          notes: assignmentForm.notes
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign user');
      }

      await fetchData();
      setShowAssignModal(false);
      setAssignmentForm({ userId: '', departmentId: '', roleId: '', notes: '' });
      
      // Trigger permission refresh for the assigned user
      await manualRefresh();
      
      alert('User assigned successfully!');
    } catch (err) {
      console.error('Error assigning user:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Handle user transfer
  const handleTransferUser = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/assignment/${transferForm.userId}/transfer`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          departmentId: parseInt(transferForm.newDepartmentId),
          roleId: parseInt(transferForm.newRoleId),
          transferReason: transferForm.transferReason,
          notes: transferForm.notes || ''
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to transfer user');
      }

      await fetchData();
      setShowTransferModal(false);
      setTransferForm({ userId: '', newDepartmentId: '', newRoleId: '', transferReason: '' });
      
      // Trigger permission refresh for the transferred user
      await manualRefresh();
      
      alert('User transferred successfully!');
    } catch (err) {
      console.error('Error transferring user:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Handle user unassignment
  const handleUnassignUser = async (userId) => {
    if (!confirm('Are you sure you want to unassign this user?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/assignment/${userId}/unassign`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: 'Manual unassignment'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to unassign user');
      }

      await fetchData();
      
      // Trigger permission refresh for the unassigned user
      await manualRefresh();
      
      alert('User unassigned successfully!');
    } catch (err) {
      console.error('Error unassigning user:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // Open assignment modal
  const openAssignModal = (user = null) => {
    if (user) {
      setAssignmentForm({
        userId: user.id,
        departmentId: '',
        roleId: '',
        notes: ''
      });
    } else {
      setAssignmentForm({ userId: '', departmentId: '', roleId: '', notes: '' });
    }
    setShowAssignModal(true);
  };

  // Open transfer modal
  const openTransferModal = (user) => {
    setSelectedUser(user);
    setTransferForm({
      userId: user.id,
      newDepartmentId: '',
      newRoleId: '',
      transferReason: ''
    });
    setShowTransferModal(true);
  };

  // Get assignment status badge
  const getStatusBadge = (user) => {
    if (user.can_assign) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          Available
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertCircle className="w-3 h-3 mr-1" />
          Assigned
        </span>
      );
    }
  };

  // Filter users
  const filteredUsers = availableUsers.filter(user => {
    const matchesSearch = user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = !selectedDepartment || 
                             (user.current_department_id && user.current_department_id.toString() === selectedDepartment);
    
    const matchesStatus = selectedStatus === 'all' ||
                         (selectedStatus === 'available' && user.can_assign) ||
                         (selectedStatus === 'assigned' && !user.can_assign);
    
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--color-ring)' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-destructive)' }} />
        <h3 className="text-lg font-medium text-fg mb-2">Error Loading Data</h3>
        <p className="text-muted mb-4">{error}</p>
        <div className="text-sm text-muted mb-4">
          <p>Please check:</p>
          <ul className="list-disc list-inside mt-2">
            <li>You are logged in as a user with assignment permissions</li>
            <li>There are approved users in the system</li>
            <li>The server is running and accessible</li>
          </ul>
        </div>
        <div className="flex space-x-3 justify-center">
          <button
            onClick={fetchData}
            className="text-white px-4 py-2 rounded-md"
            style={{ background: 'var(--color-ring)' }}
          >
            Try Again
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('accessToken');
              window.location.href = '/auth/login';
            }}
            className="text-white px-4 py-2 rounded-md"
            style={{ background: 'var(--color-muted-foreground)' }}
          >
            Re-login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">User Assignment</h1>
          <p className="text-muted">Assign approved users to departments and roles</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => openAssignModal()}
            className="text-white px-4 py-2 rounded-md flex items-center"
            style={{ background: 'var(--color-ring)' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Assign User
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="text-white px-4 py-2 rounded-md flex items-center"
            style={{ background: 'var(--color-muted-foreground)' }}
          >
            <Users className="h-4 w-4 mr-2" />
            Bulk Assignment
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8" style={{ color: 'var(--color-ring)' }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted truncate">Total Users</dt>
                  <dd className="text-lg font-medium text-fg">{statistics.total_users || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-8 w-8" style={{ color: 'var(--color-chart-1)' }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted truncate">Assigned Users</dt>
                  <dd className="text-lg font-medium text-fg">{statistics.assigned_users || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8" style={{ color: 'var(--color-chart-2)' }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted truncate">Unassigned Users</dt>
                  <dd className="text-lg font-medium text-fg">{statistics.unassigned_users || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowLeftRight className="h-8 w-8" style={{ color: 'var(--color-chart-3)' }} />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-muted truncate">Recent Transfers</dt>
                  <dd className="text-lg font-medium text-fg">{statistics.recent_transfers || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-lg shadow border border-default">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg mb-1">Search Users</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-muted-foreground)' }} />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 block w-full border rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card border-default"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-1">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="block w-full border rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card border-default"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-fg mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full border rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card border-default"
            >
              <option value="all">All Status</option>
              <option value="available">Available for Assignment</option>
              <option value="assigned">Already Assigned</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchData}
              className="px-4 py-2 rounded-md flex items-center hover-bg-muted"
              style={{ background: 'var(--color-muted)', color: 'var(--color-foreground)' }}
            >
              <Filter className="h-4 w-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card shadow overflow-hidden sm:rounded-md border border-default">
        <div className="px-4 py-5 sm:px-6 border-b border-default">
          <h3 className="text-lg leading-6 font-medium text-fg">
            Users ({filteredUsers.length})
          </h3>
        </div>
        
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4" style={{ color: 'var(--color-muted-foreground)' }} />
            <h3 className="text-lg font-medium text-fg mb-2">No users found</h3>
            <p className="text-muted mb-4">
              {availableUsers.length === 0 
                ? "No approved users available in the system" 
                : "Try adjusting your search criteria"
              }
            </p>
            
            {/* Debug information */}
            <div className="text-xs text-muted mt-4 p-3 bg-muted rounded">
              <p>Debug Info:</p>
              <p>Total users loaded: {availableUsers.length}</p>
              <p>Departments loaded: {departments.length}</p>
              <p>Current filters: Search="{searchTerm}", Dept="{selectedDepartment}", Status="{selectedStatus}"</p>
              {availableUsers.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer">Show user data</summary>
                  <pre className="text-left mt-2 text-xs">
                    {JSON.stringify(availableUsers.slice(0, 3), null, 2)}
                  </pre>
                </details>
              )}
            </div>
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
                    Current Assignment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-default">
                {filteredUsers.map((user) => (
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
                          <div className="text-sm text-muted">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.current_department_name ? (
                        <div>
                          <div className="flex items-center text-sm text-fg">
                            <Building className="h-4 w-4 mr-1" style={{ color: 'var(--color-muted-foreground)' }} />
                            {user.current_department_name}
                          </div>
                          {user.current_role_name && (
                            <div className="flex items-center text-sm text-muted">
                              <Shield className="h-4 w-4 mr-1" style={{ color: 'var(--color-muted-foreground)' }} />
                              {user.current_role_name}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted">Not assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(user)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" style={{ color: 'var(--color-muted-foreground)' }} />
                        {formatDate(user.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {user.is_superuser ? (
                          <span className="text-muted text-xs">Protected User</span>
                        ) : user.can_assign ? (
                          <button
                            onClick={() => openAssignModal(user)}
                            className="text-primary hover-text-primary"
                            title="Assign User"
                          >
                            <UserCheck className="h-4 w-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => openTransferModal(user)}
                              className="text-primary hover-text-primary"
                              title="Transfer User"
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleUnassignUser(user.id)}
                              className="text-danger"
                              title="Unassign User"
                            >
                              <UserX className="h-4 w-4" />
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
        )}
      </div>

      {/* Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">Assign User</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleAssignUser}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-fg mb-2">User</label>
                  <select
                    value={assignmentForm.userId}
                    onChange={(e) => setAssignmentForm({...assignmentForm, userId: e.target.value})}
                    required
                    className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                  >
                    <option value="">Select User</option>
                    {availableUsers.filter(u => u.can_assign && !u.is_superuser).map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.first_name} {user.last_name} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-fg mb-2">Department</label>
                  <select
                    value={assignmentForm.departmentId}
                    onChange={(e) => setAssignmentForm({...assignmentForm, departmentId: e.target.value, roleId: ''})}
                    required
                    className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.display_name}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-fg mb-2">Role</label>
                  <select
                    value={assignmentForm.roleId}
                    onChange={(e) => setAssignmentForm({...assignmentForm, roleId: e.target.value})}
                    required
                    disabled={!assignmentForm.departmentId}
                    className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm disabled:bg-muted bg-card"
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.display_name} (Level {role.role_level})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-fg mb-2">Notes (Optional)</label>
                  <textarea
                    value={assignmentForm.notes}
                    onChange={(e) => setAssignmentForm({...assignmentForm, notes: e.target.value})}
                    rows={3}
                    className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                    placeholder="Assignment notes..."
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="py-2 px-4 rounded-md shadow-sm text-sm font-medium text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="border border-transparent rounded-md shadow-sm py-2 px-4 text-sm font-medium text-white"
                    style={{ background: 'var(--color-ring)' }}
                  >
                    Assign User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">Transfer User</h3>
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="mb-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-fg">
                  <strong>User:</strong> {selectedUser.first_name} {selectedUser.last_name}
                </p>
                <p className="text-sm text-fg">
                  <strong>Current:</strong> {selectedUser.current_department_name} - {selectedUser.current_role_name}
                </p>
              </div>
              
              <form onSubmit={handleTransferUser}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-fg mb-2">New Department</label>
                  <select
                    value={transferForm.newDepartmentId}
                    onChange={(e) => setTransferForm({...transferForm, newDepartmentId: e.target.value, newRoleId: ''})}
                    required
                    className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.display_name}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-fg mb-2">New Role</label>
                  <select
                    value={transferForm.newRoleId}
                    onChange={(e) => setTransferForm({...transferForm, newRoleId: e.target.value})}
                    required
                    disabled={!transferForm.newDepartmentId}
                    className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm disabled:bg-muted bg-card"
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.display_name} (Level {role.role_level})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-fg mb-2">Transfer Reason</label>
                  <textarea
                    value={transferForm.transferReason}
                    onChange={(e) => setTransferForm({...transferForm, transferReason: e.target.value})}
                    rows={3}
                    required
                    className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                    placeholder="Reason for transfer..."
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="py-2 px-4 rounded-md shadow-sm text-sm font-medium text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="border border-transparent rounded-md shadow-sm py-2 px-4 text-sm font-medium text-white"
                    style={{ background: 'var(--color-ring)' }}
                  >
                    Transfer User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAssignmentPage;
