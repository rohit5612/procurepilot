import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Building2, 
  Plus, 
  Settings, 
  Search, 
  Edit, 
  Trash2, 
  Check,
  X,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

const DepartmentManagementPage = () => {
  const { user } = useAuth();
  const accessToken = localStorage.getItem('accessToken');
  
  const [departments, setDepartments] = useState([]);
  const [availableModules, setAvailableModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    departmentCode: '',
    parentDepartmentId: null,
    moduleIds: []
  });
  
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    withModules: 0
  });

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/api/departments`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setDepartments(data.data || []);
      
      const total = data.data.length;
      const active = data.data.filter(dept => dept.is_active).length;
      const withModules = data.data.filter(dept => dept.modules && dept.modules.length > 0).length;
      
      setStats({ total, active, withModules });
    } catch (err) {
      console.error('Error fetching departments:', err);
      setError('Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableModules = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/departments/modules`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      setAvailableModules(data.data || []);
    } catch (err) {
      console.error('Error fetching modules:', err);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchAvailableModules();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleModuleToggle = (moduleId) => {
    setFormData(prev => ({
      ...prev,
      moduleIds: prev.moduleIds.includes(moduleId)
        ? prev.moduleIds.filter(id => id !== moduleId)
        : [...prev.moduleIds, moduleId]
    }));
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.name || formData.name.length < 2 || formData.name.length > 50) {
      alert('Department name must be between 2 and 50 characters');
      return;
    }
    
    if (!formData.displayName || formData.displayName.length < 2 || formData.displayName.length > 100) {
      alert('Display name must be between 2 and 100 characters');
      return;
    }
    
    if (formData.departmentCode && !/^[A-Z0-9_]+$/.test(formData.departmentCode.toUpperCase())) {
      alert('Department code can only contain uppercase letters, numbers, and underscores');
      return;
    }
    
    try {
      // Prepare data according to backend validation rules
      const departmentData = {
        name: formData.name,
        displayName: formData.displayName,
        description: formData.description || undefined,
        departmentCode: formData.departmentCode ? formData.departmentCode.toUpperCase() : undefined,
        parentDepartmentId: formData.parentDepartmentId ? parseInt(formData.parentDepartmentId) : undefined,
        moduleIds: formData.moduleIds.map(id => parseInt(id))
      };

      const response = await fetch(`${API_BASE_URL}/api/departments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(departmentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create department');
      }

      await fetchDepartments();
      
      setFormData({
        name: '',
        displayName: '',
        description: '',
        departmentCode: '',
        parentDepartmentId: null,
        moduleIds: []
      });
      setShowCreateModal(false);
      
      alert('Department created successfully!');
    } catch (err) {
      console.error('Error creating department:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateDepartment = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.displayName || formData.displayName.length < 2 || formData.displayName.length > 100) {
      alert('Display name must be between 2 and 100 characters');
      return;
    }
    
    if (formData.departmentCode && !/^[A-Z0-9_]+$/.test(formData.departmentCode.toUpperCase())) {
      alert('Department code can only contain uppercase letters, numbers, and underscores');
      return;
    }
    
    try {
      // Prepare data according to backend validation rules
      const departmentData = {
        displayName: formData.displayName,
        description: formData.description || undefined,
        departmentCode: formData.departmentCode ? formData.departmentCode.toUpperCase() : undefined,
        parentDepartmentId: formData.parentDepartmentId ? parseInt(formData.parentDepartmentId) : undefined,
        isActive: true
      };

      const response = await fetch(`${API_BASE_URL}/api/departments/${selectedDepartment.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(departmentData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update department');
      }

      await fetchDepartments();
      setShowEditModal(false);
      setSelectedDepartment(null);
      
      alert('Department updated successfully!');
    } catch (err) {
      console.error('Error updating department:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAssignModules = async () => {
    try {
      // Ensure moduleIds are integers
      const moduleIds = formData.moduleIds.map(id => parseInt(id));

      const response = await fetch(`${API_BASE_URL}/api/departments/${selectedDepartment.id}/modules`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          moduleIds: moduleIds
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to assign modules');
      }

      await fetchDepartments();
      setShowModuleModal(false);
      setSelectedDepartment(null);
      
      alert('Modules assigned successfully!');
    } catch (err) {
      console.error('Error assigning modules:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeactivateDepartment = async (departmentId) => {
    if (!confirm('Are you sure you want to deactivate this department? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/departments/${departmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to deactivate department');
      }

      await fetchDepartments();
      alert('Department deactivated successfully!');
    } catch (err) {
      console.error('Error deactivating department:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const openEditModal = (department) => {
    setSelectedDepartment(department);
    setFormData({
      name: department.name,
      displayName: department.display_name,
      description: department.description || '',
      departmentCode: department.department_code || '',
      parentDepartmentId: department.parent_department_id,
      moduleIds: department.modules ? department.modules.map(m => m.id) : []
    });
    setShowEditModal(true);
  };

  const openModuleModal = (department) => {
    setSelectedDepartment(department);
    setFormData(prev => ({
      ...prev,
      moduleIds: department.modules ? department.modules.map(m => m.id) : []
    }));
    setShowModuleModal(true);
  };

  const filteredDepartments = departments.filter(dept => {
    const matchesSearch = dept.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dept.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (dept.department_code && dept.department_code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesFilter = filterActive === 'all' || 
                         (filterActive === 'active' && dept.is_active) ||
                         (filterActive === 'inactive' && !dept.is_active);
    
    return matchesSearch && matchesFilter;
  });

  const parentDepartments = departments.filter(dept => dept.id !== selectedDepartment?.id);

  if (loading && departments.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg shadow">
              <div className="h-16 bg-gray-200 rounded-t-lg"></div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-white border-b border-gray-200"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-fg flex items-center gap-3">
              <Building2 className="h-8 w-8" style={{ color: 'var(--color-muted-foreground)' }} />
              Department Management
            </h1>
            <p className="mt-2 text-muted">
              Create and manage organizational departments and their module access
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white"
            style={{ background: 'var(--color-ring)' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Department
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Building2 className="h-6 w-6" style={{ color: 'var(--color-muted-foreground)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      Total Departments
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
                  <Check className="h-6 w-6" style={{ color: 'var(--color-chart-1)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      Active Departments
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.active}
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
                  <Settings className="h-6 w-6" style={{ color: 'var(--color-ring)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      With Module Access
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.withModules}
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
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-muted-foreground)' }} />
                  <input
                    type="text"
                    placeholder="Search departments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border rounded-md leading-5 bg-card placeholder:text-muted focus:outline-none focus:ring-1 ring-primary border-default sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  className="block px-3 py-2 border rounded-md leading-5 bg-card focus:outline-none focus:ring-1 ring-primary border-default sm:text-sm"
                >
                  <option value="all">All Departments</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterActive('all');
                  }}
                  className="inline-flex items-center px-3 py-2 rounded-md shadow-sm text-sm font-medium text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>
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

        {/* Departments Table */}
        <div className="bg-card shadow rounded-lg overflow-hidden border border-default">
          <div className="px-6 py-4 border-b border-default">
            <h3 className="text-lg leading-6 font-medium text-fg">
              Departments ({filteredDepartments.length})
            </h3>
          </div>
          
          {filteredDepartments.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="mx-auto h-12 w-12" style={{ color: 'var(--color-muted-foreground)' }} />
              <h3 className="mt-2 text-sm font-medium text-fg">No departments found</h3>
              <p className="mt-1 text-sm text-muted">
                {searchTerm ? 'No departments match your search criteria.' : 'Get started by creating a new department.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Parent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Modules
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Users
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-default">
                  {filteredDepartments.map((dept) => (
                    <tr key={dept.id} className="hover-bg-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                              <Building2 className="h-5 w-5" style={{ color: 'var(--color-accent-foreground)' }} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-fg">
                              {dept.display_name}
                            </div>
                            <div className="text-sm text-muted">
                              {dept.name}
                            </div>
                            {dept.description && (
                              <div className="text-sm text-muted truncate max-w-xs">
                                {dept.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                        {dept.department_code || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                        {dept.parent_department_name || 'None'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {dept.modules && dept.modules.length > 0 ? (
                            dept.modules.slice(0, 2).map((module) => (
                              <span
                                key={module.id}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent"
                                style={{ color: 'var(--color-accent-foreground)' }}
                              >
                                {module.display_name}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-muted">No modules</span>
                          )}
                          {dept.modules && dept.modules.length > 2 && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-fg">
                              +{dept.modules.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                        {dept.user_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${dept.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {dept.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => openEditModal(dept)}
                            className="text-primary hover-text-primary"
                            title="Edit Department"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openModuleModal(dept)}
                            className="text-primary hover-text-primary"
                            title="Assign Modules"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeactivateDepartment(dept.id)}
                            className="text-danger"
                            title="Deactivate Department"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Department Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Create New Department
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateDepartment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">Department Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                      placeholder="e.g., procurement"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-fg">Display Name *</label>
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                      placeholder="e.g., Procurement Department"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                    placeholder="Department description..."
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                     <label className="block text-sm font-medium text-fg">Department Code</label>
                     <input
                       type="text"
                       name="departmentCode"
                       value={formData.departmentCode}
                       onChange={handleInputChange}
                       className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                       placeholder="e.g., PROC"
                     />
                     <p className="mt-1 text-xs text-muted">Uppercase letters, numbers, and underscores only</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-fg">Parent Department</label>
                    <select
                      name="parentDepartmentId"
                      value={formData.parentDepartmentId || ''}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                    >
                      <option value="">No Parent</option>
                      {parentDepartments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white"
                    style={{ background: 'var(--color-ring)' }}
                  >
                    Create Department
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {showEditModal && selectedDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Edit Department
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateDepartment} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">Department Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      disabled
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 bg-muted text-muted sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-muted">Department name cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-fg">Display Name *</label>
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                     <label className="block text-sm font-medium text-fg">Department Code</label>
                     <input
                       type="text"
                       name="departmentCode"
                       value={formData.departmentCode}
                       onChange={handleInputChange}
                       className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                     />
                     <p className="mt-1 text-xs text-muted">Uppercase letters, numbers, and underscores only</p>
                   </div>
                  <div>
                    <label className="block text-sm font-medium text-fg">Parent Department</label>
                    <select
                      name="parentDepartmentId"
                      value={formData.parentDepartmentId || ''}
                      onChange={handleInputChange}
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                    >
                      <option value="">No Parent</option>
                      {parentDepartments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.display_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white"
                    style={{ background: 'var(--color-ring)' }}
                  >
                    Update Department
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Module Assignment Modal */}
      {showModuleModal && selectedDepartment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Assign Modules to {selectedDepartment.display_name}
                </h3>
                <button
                  onClick={() => setShowModuleModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Select the modules that this department should have access to. 
                  Template roles will be automatically generated for each assigned module.
                </p>
                
                <div className="space-y-3">
                  {availableModules.map((module) => (
                    <div key={module.id} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`module-${module.id}`}
                        checked={formData.moduleIds.includes(module.id)}
                        onChange={() => handleModuleToggle(module.id)}
                        className="h-4 w-4 focus:ring-1 ring-primary border-default rounded"
                      />
                      <label htmlFor={`module-${module.id}`} className="ml-3 flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-muted flex items-center justify-center mr-3">
                          <span className="text-sm font-medium text-muted">
                            {module.display_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-fg">
                            {module.display_name}
                          </div>
                          <div className="text-sm text-muted">
                            {module.description}
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModuleModal(false)}
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignModules}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white"
                    style={{ background: 'var(--color-ring)' }}
                  >
                    Assign Modules
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentManagementPage;
