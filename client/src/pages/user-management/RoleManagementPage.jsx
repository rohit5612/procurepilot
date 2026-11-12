import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Shield, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Copy,
  Users,
  Settings,
  X,
  AlertTriangle,
  RefreshCw,
  Filter,
  Eye,
  Check,
  Star,
  Building,
  ArrowLeft,
  Grid3X3,
  ChevronDown,
  ChevronRight,
  CheckSquare
} from 'lucide-react';
import {
  sortPermissionModules,
  ROLE_LEVELS,
  MODULE_DISPLAY_LABELS
} from '../../utils/procurePilotAccess';

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000';

const RoleManagementPage = () => {
  const { user } = useAuth();
  const accessToken = localStorage.getItem('accessToken');
  
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [departmentStats, setDepartmentStats] = useState([]);
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [roleTypeFilter, setRoleTypeFilter] = useState('all');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showPermissionMatrixModal, setShowPermissionMatrixModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [availablePermissions, setAvailablePermissions] = useState(null);
  const [permissionMatrix, setPermissionMatrix] = useState({});
  const [expandedModules, setExpandedModules] = useState({});
  const [expandedFeatures, setExpandedFeatures] = useState({});
  
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    departmentId: '',
    roleLevel: 1,
    permissions: []
  });
  
  const [stats, setStats] = useState({
    total: 0,
    template: 0,
    custom: 0,
    active: 0
  });

  const fetchRoles = async (departmentId = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (departmentId) {
        params.append('departmentId', departmentId);
      }
      
      const response = await fetch(`${API_BASE_URL}/api/roles?${params}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRoles(data.data || []);
      
      // Calculate stats
      const total = data.data.length;
      const template = data.data.filter(role => role.role_type === 'template').length;
      const custom = data.data.filter(role => role.role_type === 'custom').length;
      const active = data.data.filter(role => role.is_active).length;
      
      setStats({ total, template, custom, active });
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/departments`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      setDepartments(data.data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchDepartmentStats = async () => {
    try {
      // Fetch all roles to calculate department stats
      const response = await fetch(`${API_BASE_URL}/api/roles`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      const allRoles = data.data || [];

      // Calculate stats for each department
      const stats = departments.map(dept => {
        const deptRoles = allRoles.filter(role => role.department_id === dept.id);
        const templateRoles = deptRoles.filter(role => role.role_type === 'template').length;
        const customRoles = deptRoles.filter(role => role.role_type === 'custom').length;
        const totalRoles = deptRoles.length;
        const activeRoles = deptRoles.filter(role => role.is_active).length;

        return {
          departmentId: dept.id,
          departmentName: dept.display_name,
          totalRoles,
          templateRoles,
          customRoles,
          activeRoles
        };
      });

      setDepartmentStats(stats);
    } catch (err) {
      console.error('Error fetching department stats:', err);
    }
  };

  const fetchAvailablePermissions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/roles/permissions/available`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      const payload = data.data || {};
      if (payload.modules) {
        payload.modules = sortPermissionModules(payload.modules);
      }
      setAvailablePermissions(payload);
    } catch (err) {
      console.error('Error fetching available permissions:', err);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (departments.length > 0) {
      fetchDepartmentStats();
    }
  }, [departments]);

  useEffect(() => {
    if (selectedDepartment) {
      fetchRoles(selectedDepartment.id);
    } else {
      setRoles([]);
      setStats({ total: 0, template: 0, custom: 0, active: 0 });
    }
  }, [selectedDepartment]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    
    try {
      // Convert roleLevel to number and ensure departmentId is also a number
      const requestData = {
        ...formData,
        roleLevel: parseInt(formData.roleLevel, 10),
        departmentId: parseInt(formData.departmentId, 10)
      };

      const response = await fetch(`${API_BASE_URL}/api/roles`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create role');
      }

      await fetchRoles(selectedDepartment?.id);
      await fetchDepartmentStats();
      
      setFormData({
        name: '',
        displayName: '',
        description: '',
        departmentId: '',
        roleLevel: 1,
        permissions: []
      });
      setShowCreateModal(false);
      
      alert('Role created successfully!');
    } catch (err) {
      console.error('Error creating role:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    
    try {
      // Only send the fields that the backend expects for updates
      const requestData = {
        displayName: formData.displayName,
        description: formData.description,
        roleLevel: parseInt(formData.roleLevel, 10)
      };

      const response = await fetch(`${API_BASE_URL}/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update role');
      }

      await fetchRoles(selectedDepartment?.id);
      await fetchDepartmentStats();
      setShowEditModal(false);
      setSelectedRole(null);
      
      alert('Role updated successfully!');
    } catch (err) {
      console.error('Error updating role:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete role');
      }

      await fetchRoles(selectedDepartment?.id);
      await fetchDepartmentStats();
      alert('Role deleted successfully!');
    } catch (err) {
      console.error('Error deleting role:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const openEditModal = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name,
      displayName: role.display_name,
      description: role.description || '',
      departmentId: role.department_id,
      roleLevel: role.role_level,
      permissions: role.permissions || []
    });
    setShowEditModal(true);
  };

  const openPermissionsModal = (role) => {
    setSelectedRole(role);
    setShowPermissionsModal(true);
  };

  const openPermissionMatrixModal = async (role) => {
    setSelectedRole(role);
    
    // Fetch available permissions if not already loaded
    if (!availablePermissions) {
      await fetchAvailablePermissions();
    }
    
    // Initialize permission matrix from current role permissions
    const matrix = {};
    if (role.permissions && role.permissions.length > 0) {
      role.permissions.forEach(permission => {
        const moduleName = permission.module_name;
        const featureName = permission.feature_name;
        
        if (!matrix[moduleName]) {
          matrix[moduleName] = {};
        }
        
        matrix[moduleName][featureName] = {
          permissions: permission.permissions || [],
          dataScope: permission.data_scope || 'department',
          canApprove: permission.can_approve || false,
          canExport: permission.can_export || false,
          canBulkAction: permission.can_bulk_action || false
        };
      });
    }
    
    setPermissionMatrix(matrix);
    setShowPermissionMatrixModal(true);
  };

  const selectDepartment = (department) => {
    setSelectedDepartment(department);
    setFormData(prev => ({
      ...prev,
      departmentId: department.id
    }));
  };

  const goBackToDepartments = () => {
    setSelectedDepartment(null);
    setSearchTerm('');
    setRoleTypeFilter('all');
  };

  const handleSpecialPermissionChange = (moduleName, featureName, permissionType, value) => {
    setPermissionMatrix(prev => {
      const newMatrix = { ...prev };
      
      if (!newMatrix[moduleName]) {
        newMatrix[moduleName] = {};
      }
      
      if (!newMatrix[moduleName][featureName]) {
        newMatrix[moduleName][featureName] = {
          permissions: [],
          dataScope: 'department',
          canApprove: false,
          canExport: false,
          canBulkAction: false
        };
      }
      
      // Handle boolean permissions (canApprove, canExport, canBulkAction)
      newMatrix[moduleName][featureName][permissionType] = value;
      
      return newMatrix;
    });
  };

  const handleDataScopeChange = (moduleName, featureName, dataScope) => {
    setPermissionMatrix(prev => {
      const newMatrix = { ...prev };
      
      if (!newMatrix[moduleName]) {
        newMatrix[moduleName] = {};
      }
      
      if (!newMatrix[moduleName][featureName]) {
        newMatrix[moduleName][featureName] = {
          permissions: [],
          dataScope: 'department',
          canApprove: false,
          canExport: false,
          canBulkAction: false
        };
      }
      
      newMatrix[moduleName][featureName].dataScope = dataScope;
      return newMatrix;
    });
  };

  const toggleModule = (moduleName) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

  const toggleFeature = (moduleName, featureName) => {
    const key = `${moduleName}.${featureName}`;
    setExpandedFeatures(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const grantAllFeaturePermissions = (moduleName, featureName, feature) => {
    setPermissionMatrix(prev => {
      const newMatrix = { ...prev };
      
      if (!newMatrix[moduleName]) {
        newMatrix[moduleName] = {};
      }
      
      newMatrix[moduleName][featureName] = {
        permissions: [...feature.available_permissions],
        dataScope: 'department',
        canApprove: true,
        canExport: true,
        canBulkAction: true
      };
      
      return newMatrix;
    });
  };

  const handleSavePermissions = async () => {
    try {
      // Convert matrix to API format
      const permissions = [];
      
      Object.keys(permissionMatrix).forEach(moduleName => {
        Object.keys(permissionMatrix[moduleName]).forEach(featureName => {
          const featureData = permissionMatrix[moduleName][featureName];
          
          if (featureData.permissions.length > 0 || featureData.canApprove || featureData.canExport || featureData.canBulkAction) {
            permissions.push({
              featureId: availablePermissions.modules[moduleName].features[featureName].id,
              permissions: featureData.permissions,
              dataScope: featureData.dataScope,
              canApprove: featureData.canApprove,
              canExport: featureData.canExport,
              canBulkAction: featureData.canBulkAction
            });
          }
        });
      });

      const response = await fetch(`${API_BASE_URL}/api/roles/${selectedRole.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permissions
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update permissions');
      }

      await fetchRoles(selectedDepartment?.id);
      setShowPermissionMatrixModal(false);
      alert('Permissions updated successfully!');
    } catch (err) {
      console.error('Error updating permissions:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const filteredRoles = roles.filter(role => {
    const matchesSearch = role.display_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         role.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = roleTypeFilter === 'all' || role.role_type === roleTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const getRoleLevelLabel = (level) => {
    switch (level) {
      case 0: return 'Superadmin';
      case 1: return 'Admin';
      case 2: return 'Department Head';
      case 3: return 'Manager';
      case 4: return 'Senior User';
      case 5: return 'Basic User';
      default: return `Level ${level}`;
    }
  };

  const getRoleLevelColor = (level) => {
    switch (level) {
      case 0: return 'bg-accent';
      case 1: return 'badge-danger';
      case 2: return 'bg-accent';
      case 3: return 'bg-accent';
      case 4: return 'badge-success';
      case 5: return 'bg-muted text-fg';
      default: return 'bg-muted text-fg';
    }
  };

  if (loading && departments.length === 0) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="bg-card p-6 rounded-lg shadow border border-default">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Department Cards View
  if (!selectedDepartment) {
    return (
    <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
            <h1 className="text-3xl font-bold text-fg flex items-center gap-3">
              <Shield className="h-8 w-8" style={{ color: 'var(--color-muted-foreground)' }} />
                Role Management
              </h1>
            <p className="mt-2 text-muted">
                Select a department to manage its roles and permissions
              </p>
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

          {/* Department Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((department) => {
              const deptStats = departmentStats.find(stat => stat.departmentId === department.id) || {
                totalRoles: 0,
                templateRoles: 0,
                customRoles: 0,
                activeRoles: 0
              };

              return (
                <div
                  key={department.id}
                  onClick={() => selectDepartment(department)}
                  className="bg-card rounded-lg shadow-sm border border-default p-6 cursor-pointer hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                        <Building className="h-5 w-5" style={{ color: 'var(--color-accent-foreground)' }} />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-fg">
                          {department.display_name}
                        </h3>
                        <p className="text-sm text-muted">
                          {department.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">Total Roles:</span>
                      <span className="text-sm font-medium text-fg">{deptStats.totalRoles}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">Template Roles:</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-ring)' }}>{deptStats.templateRoles}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">Custom Roles:</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-chart-2)' }}>{deptStats.customRoles}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted">Active Roles:</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--color-chart-1)' }}>{deptStats.activeRoles}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-default">
                    <div className="flex items-center text-primary text-sm font-medium">
                      <span>Manage Roles</span>
                      <ArrowLeft className="h-4 w-4 ml-1 rotate-180" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {departments.length === 0 && (
            <div className="text-center py-12">
              <Building className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No departments found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Create departments first to manage roles.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Roles View for Selected Department
  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={goBackToDepartments}
              className="p-2 rounded-lg bg-card shadow-sm border border-default hover-bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5" style={{ color: 'var(--color-muted-foreground)' }} />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-fg flex items-center gap-3">
                <Building className="h-8 w-8" style={{ color: 'var(--color-ring)' }} />
                {selectedDepartment.display_name} - Roles
              </h1>
              <p className="mt-2 text-muted">
                Manage roles and permissions for {selectedDepartment.display_name}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 rounded-md shadow-sm text-sm font-medium text-white"
            style={{ background: 'var(--color-ring)' }}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Role
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-card overflow-hidden shadow rounded-lg border border-default">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Shield className="h-6 w-6" style={{ color: 'var(--color-muted-foreground)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      Total Roles
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
                      Template Roles
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.template}
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
                      Custom Roles
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.custom}
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
                  <Users className="h-6 w-6" style={{ color: 'var(--color-chart-2)' }} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted truncate">
                      Active Roles
                    </dt>
                    <dd className="text-lg font-medium text-fg">
                      {stats.active}
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
                    placeholder="Search roles..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2 border rounded-md leading-5 bg-card placeholder:text-muted focus:outline-none focus:ring-1 ring-primary border-default sm:text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={roleTypeFilter}
                  onChange={(e) => setRoleTypeFilter(e.target.value)}
                  className="block px-3 py-2 border rounded-md leading-5 bg-card focus:outline-none focus:ring-1 ring-primary border-default sm:text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="template">Template</option>
                  <option value="custom">Custom</option>
                </select>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setRoleTypeFilter('all');
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

        {/* Roles Table */}
        <div className="bg-card shadow rounded-lg overflow-hidden border border-default">
          <div className="px-6 py-4 border-b border-default">
            <h3 className="text-lg leading-6 font-medium text-fg">
              Roles ({filteredRoles.length})
            </h3>
          </div>
          
          {filteredRoles.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="mx-auto h-12 w-12" style={{ color: 'var(--color-muted-foreground)' }} />
              <h3 className="mt-2 text-sm font-medium text-fg">No roles found</h3>
              <p className="mt-1 text-sm text-muted">
                {searchTerm ? 'No roles match your search criteria.' : 'Get started by creating a new role.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-default">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                      Type
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
                  {filteredRoles.map((role) => (
                    <tr key={role.id} className="hover-bg-muted">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'var(--color-accent)' }}>
                              <Shield className="h-5 w-5" style={{ color: 'var(--color-accent-foreground)' }} />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-fg flex items-center gap-2">
                              {role.display_name}
                              {role.is_default && <Star className="h-4 w-4" style={{ color: 'var(--color-ring)' }} />}
                            </div>
                            <div className="text-sm text-muted">
                              {role.name}
                            </div>
                            {role.description && (
                              <div className="text-sm text-muted truncate max-w-xs">
                                {role.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRoleLevelColor(role.role_level)}`}>
                          {getRoleLevelLabel(role.role_level)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          role.role_type === 'template' 
                            ? 'bg-accent' 
                            : 'bg-muted text-fg'
                        }`}>
                          {role.role_type === 'template' ? 'Template' : 'Custom'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-fg">
                        {role.user_count || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          role.is_active 
                            ? 'badge-success' 
                            : 'badge-danger'
                        }`}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                                             <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                         <div className="flex items-center space-x-2">
                           <button
                             onClick={() => openPermissionsModal(role)}
                            className="text-primary hover-text-primary"
                             title="View Permissions"
                           >
                             <Eye className="h-4 w-4" />
                           </button>
                           {role.role_type === 'custom' && (
                             <>
                               <button
                                 onClick={() => openPermissionMatrixModal(role)}
                                className="text-primary hover-text-primary"
                                 title="Permission Matrix"
                               >
                                 <Grid3X3 className="h-4 w-4" />
                               </button>
                               <button
                                 onClick={() => openEditModal(role)}
                                className="text-primary hover-text-primary"
                                 title="Edit Role"
                               >
                                 <Edit className="h-4 w-4" />
                               </button>
                               <button
                                 onClick={() => handleDeleteRole(role.id)}
                                className="text-danger"
                                 title="Delete Role"
                               >
                                 <Trash2 className="h-4 w-4" />
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
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Create New Role for {selectedDepartment.display_name}
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleCreateRole} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">Role Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                      placeholder="e.g., senior_manager"
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
                      placeholder="e.g., Senior Manager"
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
                    placeholder="Role description..."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-fg">Role Level</label>
                  <select
                    name="roleLevel"
                    value={formData.roleLevel}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                  >
                    {ROLE_LEVELS.map((r) => (
                      <option key={r.level} value={r.level}>{r.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted">
                    {ROLE_LEVELS.find((r) => r.level === Number(formData.roleLevel))?.hint}
                  </p>
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
                    Create Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Edit Role
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateRole} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-fg">Role Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      disabled
                      className="mt-1 block w-full border border-default rounded-md px-3 py-2 bg-muted text-muted sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-muted">Role name cannot be changed</p>
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
                
                <div>
                  <label className="block text-sm font-medium text-fg">Role Level</label>
                  <select
                    name="roleLevel"
                    value={formData.roleLevel}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border border-default rounded-md px-3 py-2 focus:outline-none ring-primary sm:text-sm bg-card"
                  >
                    {ROLE_LEVELS.map((r) => (
                      <option key={r.level} value={r.level}>{r.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted">
                    {ROLE_LEVELS.find((r) => r.level === Number(formData.roleLevel))?.hint}
                  </p>
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
                    Update Role
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {showPermissionsModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-card border-default">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-fg">
                  Permissions for {selectedRole.display_name}
                </h3>
                <button
                  onClick={() => setShowPermissionsModal(false)}
                  className="text-muted hover-text-primary"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  View the permissions assigned to this role. Template roles have predefined permissions based on their level.
                </p>
                
                <div className="space-y-6">
                  {selectedRole.permissions && selectedRole.permissions.length > 0 ? (
                    (() => {
                      // Group permissions by module
                      const permissionsByModule = {};
                      selectedRole.permissions.forEach((permission) => {
                        const moduleName = permission.module_name;
                        if (!permissionsByModule[moduleName]) {
                          permissionsByModule[moduleName] = [];
                        }
                        permissionsByModule[moduleName].push(permission);
                      });

                      return Object.keys(permissionsByModule).map((moduleName) => (
                        <div key={moduleName} className="border border-default rounded-lg">
                          <div className="bg-muted px-4 py-3 border-b border-default">
                            <h4 className="text-lg font-medium text-fg">
                              {moduleName}
                            </h4>
                          </div>
                          
                          <div className="p-4">
                            <div className="space-y-4">
                              {permissionsByModule[moduleName].map((permission) => (
                                <div key={permission.feature_id} className="border border-default rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-3">
                                    <div>
                                      <h5 className="text-md font-medium text-fg">
                                        {permission.feature_display_name}
                                      </h5>
                                      <p className="text-sm text-muted">
                                        {permission.feature_name}
                                      </p>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-3">
                                    {/* Basic Permissions */}
                                    {permission.permissions && permission.permissions.length > 0 && (
                                      <div>
                                        <h6 className="text-sm font-medium text-fg mb-2">
                                          Basic Permissions
                                        </h6>
                                        <div className="flex flex-wrap gap-2">
                                          {permission.permissions.map((perm) => (
                                            <span
                                              key={perm}
                                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium badge-success"
                                            >
                                              {perm}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Data Scope */}
                                    <div>
                                      <h6 className="text-sm font-medium text-fg mb-2">
                                        Data Scope
                                      </h6>
                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                                        {permission.data_scope}
                                      </span>
                                    </div>
                                    
                                    {/* Special Permissions */}
                                    {(permission.can_approve || permission.can_export || permission.can_bulk_action) && (
                                      <div>
                                        <h6 className="text-sm font-medium text-fg mb-2">
                                          Special Permissions
                                        </h6>
                                        <div className="flex flex-wrap gap-2">
                                          {permission.can_approve && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent">
                                              Can Approve
                                            </span>
                                          )}
                                          {permission.can_export && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent">
                                              Can Export
                                            </span>
                                          )}
                                          {permission.can_bulk_action && (
                                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-accent">
                                              Bulk Actions
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ));
                    })()
                  ) : (
                    <div className="text-center py-8">
                      <Shield className="mx-auto h-12 w-12" style={{ color: 'var(--color-muted-foreground)' }} />
                      <h3 className="mt-2 text-sm font-medium text-fg">No permissions assigned</h3>
                      <p className="mt-1 text-sm text-muted">
                        This role doesn't have any specific permissions assigned.
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPermissionsModal(false)}
                    className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
                 </div>
       )}

       {/* Permission Matrix Modal */}
       {showPermissionMatrixModal && selectedRole && availablePermissions && (
         <div className="fixed inset-0 bg-black bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-5/6 lg:w-4/5 xl:w-3/4 shadow-lg rounded-md bg-card border-default max-h-[90vh] overflow-y-auto">
             <div className="mt-3">
               <div className="flex items-center justify-between mb-6">
                 <div>
                   <h3 className="text-xl font-medium text-fg">
                     Permission Matrix - {selectedRole.display_name}
                   </h3>
                   <p className="text-sm text-muted mt-1">
                     ProcurePilot catalog only — role level drives default policy authority (L1–L5).
                   </p>
                   {selectedRole?.role_level != null && (
                     <p className="text-xs text-primary mt-2">
                       {ROLE_LEVELS.find((r) => r.level === Number(selectedRole.role_level))?.label}
                       {' — '}
                       {ROLE_LEVELS.find((r) => r.level === Number(selectedRole.role_level))?.hint}
                     </p>
                   )}
                 </div>
                 <button
                   onClick={() => setShowPermissionMatrixModal(false)}
                   className="text-muted hover-text-primary"
                 >
                   <X className="h-6 w-6" />
                 </button>
               </div>
               
              <div className="space-y-4">
                {Object.keys(availablePermissions.modules).map(moduleName => {
                  const module = availablePermissions.modules[moduleName];
                  const isModuleExpanded = expandedModules[moduleName];
                  
                  return (
                    <div key={moduleName} className="border border-default rounded-lg overflow-hidden">
                      {/* Module Header - Collapsible */}
                      <button
                        onClick={() => toggleModule(moduleName)}
                        className="w-full bg-muted hover:bg-muted/80 px-4 py-3 border-b border-default flex items-center justify-between transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isModuleExpanded ? (
                            <ChevronDown className="h-5 w-5 text-fg" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-fg" />
                          )}
                          <div className="text-left">
                            <h4 className="text-lg font-medium text-fg">
                              {MODULE_DISPLAY_LABELS[moduleName] || module.display_name}
                            </h4>
                            <p className="text-xs text-muted">
                              {moduleName}
                            </p>
                          </div>
                        </div>
                        <div className="text-sm text-muted">
                          {Object.keys(module.features).length} features
                        </div>
                      </button>
                      
                      {/* Module Content - Features List */}
                      {isModuleExpanded && (
                        <div className="bg-card">
                          {Object.keys(module.features).map(featureName => {
                            const feature = module.features[featureName];
                            const featureKey = `${moduleName}.${featureName}`;
                            const isFeatureExpanded = expandedFeatures[featureKey];
                            const currentPermissions = permissionMatrix[moduleName]?.[featureName] || {
                              permissions: [],
                              dataScope: 'department',
                              canApprove: false,
                              canExport: false,
                              canBulkAction: false
                            };
                            
                            return (
                              <div key={featureName} className="border-b border-default last:border-b-0">
                                {/* Feature Header - Collapsible */}
                                <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                                  <button
                                    onClick={() => toggleFeature(moduleName, featureName)}
                                    className="flex items-center gap-3 flex-1 text-left"
                                  >
                                    {isFeatureExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-fg" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-fg" />
                                    )}
                                    <div>
                                      <h5 className="text-sm font-medium text-fg">
                                        {feature.display_name}
                                      </h5>
                                      <p className="text-xs text-muted">
                                        {featureName}
                                      </p>
                                    </div>
                                  </button>
                                  
                                  {/* Grant All Button */}
                                  <button
                                    onClick={() => grantAllFeaturePermissions(moduleName, featureName, feature)}
                                    className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md text-white hover:opacity-90 transition-opacity"
                                    style={{ background: 'var(--color-ring)' }}
                                    title="Grant all permissions for this feature"
                                  >
                                    <CheckSquare className="h-3 w-3" />
                                    Grant All
                                  </button>
                                </div>
                                
                                {/* Feature Content - Permission Checkboxes */}
                                {isFeatureExpanded && (
                                  <div className="px-4 py-4 bg-muted/30 space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      {/* Basic Permissions */}
                                      <div>
                                        <h6 className="text-sm font-semibold text-fg mb-3 flex items-center gap-2">
                                          <Shield className="h-4 w-4" />
                                          Basic Permissions
                                        </h6>
                                        <div className="space-y-2">
                                          {feature.available_permissions.map(permission => (
                                            <label key={permission} className="flex items-center gap-2 cursor-pointer hover:bg-card/50 p-2 rounded transition-colors">
                                              <input
                                                type="checkbox"
                                                checked={currentPermissions.permissions.includes(permission)}
                                                onChange={(e) => {
                                                  const newMatrix = { ...permissionMatrix };
                                                  
                                                  if (!newMatrix[moduleName]) {
                                                    newMatrix[moduleName] = {};
                                                  }
                                                  
                                                  if (!newMatrix[moduleName][featureName]) {
                                                    newMatrix[moduleName][featureName] = {
                                                      permissions: [],
                                                      dataScope: 'department',
                                                      canApprove: false,
                                                      canExport: false,
                                                      canBulkAction: false
                                                    };
                                                  }
                                                  
                                                  if (e.target.checked) {
                                                    if (!newMatrix[moduleName][featureName].permissions.includes(permission)) {
                                                      newMatrix[moduleName][featureName].permissions.push(permission);
                                                    }
                                                  } else {
                                                    newMatrix[moduleName][featureName].permissions = 
                                                      newMatrix[moduleName][featureName].permissions.filter(p => p !== permission);
                                                  }
                                                  
                                                  setPermissionMatrix(newMatrix);
                                                }}
                                                className="h-4 w-4 rounded focus:ring-2 ring-primary border-default"
                                                style={{ accentColor: 'var(--color-ring)' }}
                                              />
                                              <span className="text-sm text-fg capitalize font-medium">
                                                {permission}
                                              </span>
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      {/* Advanced Settings */}
                                      <div className="space-y-4">
                                        {/* Special Permissions */}
                                        <div>
                                          <h6 className="text-sm font-semibold text-fg mb-3 flex items-center gap-2">
                                            <Star className="h-4 w-4" />
                                            Special Permissions
                                          </h6>
                                          <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-card/50 p-2 rounded transition-colors">
                                              <input
                                                type="checkbox"
                                                checked={currentPermissions.canApprove}
                                                onChange={(e) => handleSpecialPermissionChange(
                                                  moduleName, 
                                                  featureName, 
                                                  'canApprove', 
                                                  e.target.checked
                                                )}
                                                className="h-4 w-4 rounded focus:ring-2 ring-primary border-default"
                                                style={{ accentColor: 'var(--color-ring)' }}
                                              />
                                              <span className="text-sm text-fg font-medium">
                                                Can Approve
                                              </span>
                                            </label>
                                            
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-card/50 p-2 rounded transition-colors">
                                              <input
                                                type="checkbox"
                                                checked={currentPermissions.canExport}
                                                onChange={(e) => handleSpecialPermissionChange(
                                                  moduleName, 
                                                  featureName, 
                                                  'canExport', 
                                                  e.target.checked
                                                )}
                                                className="h-4 w-4 rounded focus:ring-2 ring-primary border-default"
                                                style={{ accentColor: 'var(--color-ring)' }}
                                              />
                                              <span className="text-sm text-fg font-medium">
                                                Can Export
                                              </span>
                                            </label>
                                            
                                            <label className="flex items-center gap-2 cursor-pointer hover:bg-card/50 p-2 rounded transition-colors">
                                              <input
                                                type="checkbox"
                                                checked={currentPermissions.canBulkAction}
                                                onChange={(e) => handleSpecialPermissionChange(
                                                  moduleName, 
                                                  featureName, 
                                                  'canBulkAction', 
                                                  e.target.checked
                                                )}
                                                className="h-4 w-4 rounded focus:ring-2 ring-primary border-default"
                                                style={{ accentColor: 'var(--color-ring)' }}
                                              />
                                              <span className="text-sm text-fg font-medium">
                                                Bulk Actions
                                              </span>
                                            </label>
                                          </div>
                                        </div>
                                        
                                        {/* Data Scope */}
                                        <div>
                                          <h6 className="text-sm font-semibold text-fg mb-3 flex items-center gap-2">
                                            <Building className="h-4 w-4" />
                                            Data Scope
                                          </h6>
                                          <select
                                            value={currentPermissions.dataScope}
                                            onChange={(e) => handleDataScopeChange(
                                              moduleName, 
                                              featureName, 
                                              e.target.value
                                            )}
                                            className="block w-full border border-default rounded-md px-3 py-2 focus:outline-none focus:ring-2 ring-primary text-sm bg-card"
                                          >
                                            <option value="own">Own Data Only</option>
                                            <option value="department">Department Data</option>
                                            <option value="all">All Data</option>
                                          </select>
                                          <p className="mt-1 text-xs text-muted">
                                            {currentPermissions.dataScope === 'own' && 'User can only access their own records'}
                                            {currentPermissions.dataScope === 'department' && 'User can access department-wide records'}
                                            {currentPermissions.dataScope === 'all' && 'User can access all records across departments'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
               
               <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-default">
                 <button
                   type="button"
                   onClick={() => setShowPermissionMatrixModal(false)}
                   className="inline-flex items-center px-4 py-2 shadow-sm text-sm font-medium rounded-md text-fg bg-muted hover-bg-muted focus:outline-none ring-primary border border-default"
                 >
                   Cancel
                 </button>
                 <button
                   type="button"
                   onClick={handleSavePermissions}
                   className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md shadow-sm text-white"
                   style={{ background: 'var(--color-ring)' }}
                 >
                   Save Permissions
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}
     </div>
   );
 };

export default RoleManagementPage;

