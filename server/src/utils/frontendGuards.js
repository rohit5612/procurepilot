/**
 * Frontend Permission Guards Structure - Phase 4 Implementation
 * Templates and utilities for frontend permission-based rendering
 */

/**
 * Generate React component template for permission guards
 */
export const generatePermissionGuardTemplate = () => {
  return `
// ProtectedRoute.jsx - Route-level permission guard
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { usePermissions } from '../hooks/usePermissions';
import LoadingSpinner from './LoadingSpinner';
import AccessDenied from './AccessDenied';

const ProtectedRoute = ({ 
  children, 
  permission, 
  moduleAccess, 
  requireSuperuser = false,
  fallback = null 
}) => {
  const { user, isLoading: authLoading } = useAuth();
  const { hasPermission, hasModuleAccess, isLoading: permLoading } = usePermissions();
  const location = useLocation();

  // Show loading while checking authentication and permissions
  if (authLoading || permLoading) {
    return <LoadingSpinner />;
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check superuser requirement
  if (requireSuperuser && !user.isSuperuser) {
    return fallback || <AccessDenied message="Superuser access required" />;
  }

  // Check module access
  if (moduleAccess && !hasModuleAccess(moduleAccess)) {
    return fallback || <AccessDenied message={\`Access denied to module: \${moduleAccess}\`} />;
  }

  // Check specific permission
  if (permission && !hasPermission(permission)) {
    return fallback || <AccessDenied message={\`Permission denied: \${permission}\`} />;
  }

  return children;
};

export default ProtectedRoute;

// PermissionGate.jsx - Component-level permission gate
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

const PermissionGate = ({ 
  permission, 
  moduleAccess,
  dataScope = null,
  resourceId = null,
  requireSuperuser = false,
  children, 
  fallback = null,
  showLoader = false 
}) => {
  const { 
    hasPermission, 
    hasModuleAccess, 
    checkDataAccess,
    isLoading,
    user 
  } = usePermissions();

  if (isLoading && showLoader) {
    return <div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div>;
  }

  // Check superuser requirement
  if (requireSuperuser && !user?.isSuperuser) {
    return fallback;
  }

  // Check module access
  if (moduleAccess && !hasModuleAccess(moduleAccess)) {
    return fallback;
  }

  // Check specific permission
  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  // Check data-level access if specified
  if (dataScope && resourceId) {
    const hasDataAccess = checkDataAccess(permission, resourceId, dataScope);
    if (!hasDataAccess) {
      return fallback;
    }
  }

  return children;
};

export default PermissionGate;

// usePermissions.js - Permission management hook
import { useState, useEffect, useContext, createContext } from 'react';
import { useAuth } from './useAuth';
import { permissionService } from '../services/permissionService';

const PermissionsContext = createContext();

export const PermissionsProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [permissions, setPermissions] = useState(null);
  const [modules, setModules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load user permissions
  useEffect(() => {
    if (user && token) {
      loadUserPermissions();
    } else {
      setPermissions(null);
      setModules([]);
      setIsLoading(false);
    }
  }, [user, token]);

  const loadUserPermissions = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [userPermissions, userModules] = await Promise.all([
        permissionService.getUserPermissions(user.id),
        permissionService.getUserModules(user.id)
      ]);

      setPermissions(userPermissions);
      setModules(userModules);
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setError(err.message);
      setPermissions(null);
      setModules([]);
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (permission) => {
    if (!permissions || !permission) return false;
    if (user?.isSuperuser) return true;

    const [module, feature, action] = permission.split('.');
    
    // Check module access
    if (!permissions.modules.includes(module)) return false;
    
    // Check feature permission
    const featureKey = \`\${module}.\${feature}\`;
    const featurePermissions = permissions.features[featureKey];
    
    return featurePermissions && featurePermissions.includes(action);
  };

  const hasModuleAccess = (moduleName) => {
    if (!permissions || !moduleName) return false;
    if (user?.isSuperuser) return true;
    
    return permissions.modules.includes(moduleName);
  };

  const getDataScope = (permission) => {
    if (!permissions || !permission) return 'own';
    if (user?.isSuperuser) return 'all';

    const [module, feature] = permission.split('.');
    const featureKey = \`\${module}.\${feature}\`;
    
    return permissions.dataScopes[featureKey] || 'own';
  };

  const checkDataAccess = async (permission, resourceId, expectedScope) => {
    if (!permission || !resourceId) return false;
    if (user?.isSuperuser) return true;

    try {
      const result = await permissionService.checkDataAccess(
        user.id,
        permission,
        resourceId
      );
      
      return result.hasAccess && result.dataScope === expectedScope;
    } catch (error) {
      console.error('Data access check failed:', error);
      return false;
    }
  };

  const refreshPermissions = async () => {
    if (user) {
      await loadUserPermissions();
    }
  };

  const value = {
    permissions,
    modules,
    isLoading,
    error,
    user,
    hasPermission,
    hasModuleAccess,
    getDataScope,
    checkDataAccess,
    refreshPermissions
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};

// permissionService.js - Frontend permission API service
class PermissionService {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  }

  async getUserPermissions(userId) {
    const response = await fetch(\`\${this.baseURL}/permissions/check/\${userId}\`, {
      headers: {
        'Authorization': \`Bearer \${localStorage.getItem('accessToken')}\`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user permissions');
    }

    const data = await response.json();
    return data.data.result;
  }

  async getUserModules(userId) {
    const response = await fetch(\`\${this.baseURL}/permissions/modules/\${userId}\`, {
      headers: {
        'Authorization': \`Bearer \${localStorage.getItem('accessToken')}\`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user modules');
    }

    const data = await response.json();
    return data.data.modules;
  }

  async checkDataAccess(userId, permission, resourceId) {
    const [module, feature, action] = permission.split('.');
    
    const response = await fetch(
      \`\${this.baseURL}/permissions/check/\${userId}?module=\${module}&feature=\${feature}&action=\${action}&resourceId=\${resourceId}\`,
      {
        headers: {
          'Authorization': \`Bearer \${localStorage.getItem('accessToken')}\`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to check data access');
    }

    const data = await response.json();
    return data.data.result;
  }

  async refreshUserPermissions(userId) {
    const response = await fetch(\`\${this.baseURL}/permissions/refresh/user/\${userId}\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${localStorage.getItem('accessToken')}\`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to refresh user permissions');
    }

    return response.json();
  }

  async bulkCheckPermissions(checks) {
    const response = await fetch(\`\${this.baseURL}/permissions/bulk-check\`, {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${localStorage.getItem('accessToken')}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ checks })
    });

    if (!response.ok) {
      throw new Error('Failed to perform bulk permission check');
    }

    const data = await response.json();
    return data.data.results;
  }
}

export const permissionService = new PermissionService();

// NavigationGuard.jsx - Navigation menu with permission filtering
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

const NavigationGuard = () => {
  const { hasModuleAccess, hasPermission, modules, user } = usePermissions();

  const navigationItems = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: 'dashboard',
      requireSuperuser: false
    },
    {
      name: 'User Management',
      href: '/user-management',
      icon: 'users',
      module: 'user_management',
      children: [
        {
          name: 'User Approval',
          href: '/user-management/approval',
          permission: 'user_management.user_approval.read'
        },
        {
          name: 'User Directory',
          href: '/user-management/directory',
          permission: 'user_management.user_directory.read'
        },
        {
          name: 'Department Management',
          href: '/user-management/departments',
          permission: 'user_management.department_management.read'
        },
        {
          name: 'Role Management',
          href: '/user-management/roles',
          permission: 'user_management.role_management.read'
        },
        {
          name: 'User Assignment',
          href: '/user-management/assignment',
          permission: 'user_management.user_assignment.read'
        }
      ]
    },
    {
      name: 'Procurement',
      href: '/procurement',
      icon: 'shopping-cart',
      module: 'procurement',
      children: [
        {
          name: 'Purchase Orders',
          href: '/procurement/purchase-orders',
          permission: 'procurement.purchase_orders.read'
        },
        {
          name: 'Suppliers',
          href: '/procurement/suppliers',
          permission: 'procurement.suppliers.read'
        }
      ]
    },
    {
      name: 'Inventory',
      href: '/inventory',
      icon: 'package',
      module: 'inventory',
      children: [
        {
          name: 'Items',
          href: '/inventory/items',
          permission: 'inventory.items.read'
        },
        {
          name: 'Warehouses',
          href: '/inventory/warehouses',
          permission: 'inventory.warehouses.read'
        }
      ]
    },
    {
      name: 'System',
      href: '/system',
      icon: 'settings',
      requireSuperuser: true,
      children: [
        {
          name: 'Audit Logs',
          href: '/system/audit',
          requireSuperuser: true
        },
        {
          name: 'System Settings',
          href: '/system/settings',
          requireSuperuser: true
        }
      ]
    }
  ];

  const filterNavigationItem = (item) => {
    // Check superuser requirement
    if (item.requireSuperuser && !user?.isSuperuser) {
      return false;
    }

    // Check module access
    if (item.module && !hasModuleAccess(item.module)) {
      return false;
    }

    // Check specific permission
    if (item.permission && !hasPermission(item.permission)) {
      return false;
    }

    return true;
  };

  const filteredNavigation = navigationItems
    .filter(filterNavigationItem)
    .map(item => ({
      ...item,
      children: item.children ? item.children.filter(filterNavigationItem) : []
    }))
    .filter(item => !item.children || item.children.length > 0);

  return (
    <nav className="space-y-1">
      {filteredNavigation.map((item) => (
        <div key={item.name}>
          <a
            href={item.href}
            className="group flex items-center px-2 py-2 text-sm font-medium rounded-md"
          >
            {item.icon && <span className="mr-3">{item.icon}</span>}
            {item.name}
          </a>
          {item.children && (
            <div className="ml-6 space-y-1">
              {item.children.map((child) => (
                <a
                  key={child.name}
                  href={child.href}
                  className="group flex items-center px-2 py-2 text-sm rounded-md"
                >
                  {child.name}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};

export default NavigationGuard;

// ActionButton.jsx - Action button with permission check
import React from 'react';
import { usePermissions } from '../hooks/usePermissions';

const ActionButton = ({ 
  permission,
  moduleAccess,
  requireSuperuser = false,
  onClick,
  children,
  className = '',
  disabled = false,
  ...props 
}) => {
  const { hasPermission, hasModuleAccess, user } = usePermissions();

  // Check if action is allowed
  const isAllowed = () => {
    if (requireSuperuser && !user?.isSuperuser) return false;
    if (moduleAccess && !hasModuleAccess(moduleAccess)) return false;
    if (permission && !hasPermission(permission)) return false;
    return true;
  };

  if (!isAllowed()) {
    return null; // Hide button if no permission
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`\${className} \${disabled ? 'opacity-50 cursor-not-allowed' : ''}\`}
      {...props}
    >
      {children}
    </button>
  );
};

export default ActionButton;
`;
};

/**
 * Generate permission-based routing configuration
 */
export const generateRoutingConfig = () => {
  return `
// routes/PermissionRoutes.jsx - Permission-based routing
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

// Import your page components
import Dashboard from '../pages/Dashboard';
import UserManagement from '../pages/UserMgmt';
import UserApproval from '../pages/userManagement/ApprovalDashboard';
import UserDirectory from '../pages/userManagement/UserDirectory';
import DepartmentManagement from '../pages/userManagement/DepartmentManagement';
import RoleManagement from '../pages/userManagement/RoleManagement';
import UserAssignment from '../pages/userManagement/UserAssignment';

const PermissionRoutes = () => {
  return (
    <Routes>
      {/* Public Dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />

      {/* User Management Module */}
      <Route path="/user-management" element={
        <ProtectedRoute moduleAccess="user_management">
          <UserManagement />
        </ProtectedRoute>
      } />

      <Route path="/user-management/approval" element={
        <ProtectedRoute permission="user_management.user_approval.read">
          <UserApproval />
        </ProtectedRoute>
      } />

      <Route path="/user-management/directory" element={
        <ProtectedRoute permission="user_management.user_directory.read">
          <UserDirectory />
        </ProtectedRoute>
      } />

      <Route path="/user-management/departments" element={
        <ProtectedRoute permission="user_management.department_management.read">
          <DepartmentManagement />
        </ProtectedRoute>
      } />

      <Route path="/user-management/roles" element={
        <ProtectedRoute permission="user_management.role_management.read">
          <RoleManagement />
        </ProtectedRoute>
      } />

      <Route path="/user-management/assignment" element={
        <ProtectedRoute permission="user_management.user_assignment.read">
          <UserAssignment />
        </ProtectedRoute>
      } />

      {/* System Administration */}
      <Route path="/system/*" element={
        <ProtectedRoute requireSuperuser={true}>
          <SystemRoutes />
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default PermissionRoutes;
`;
};

/**
 * Generate permission utility functions
 */
export const generatePermissionUtils = () => {
  return `
// utils/permissionUtils.js - Permission utility functions
export const PermissionUtils = {
  
  // Parse permission string
  parsePermission: (permission) => {
    const parts = permission.split('.');
    return {
      module: parts[0],
      feature: parts[1],
      action: parts[2],
      isValid: parts.length === 3
    };
  },

  // Check if user can perform action on resource
  canPerformAction: (userPermissions, permission, dataScope = 'own') => {
    if (!userPermissions || !permission) return false;
    
    const { module, feature, action, isValid } = PermissionUtils.parsePermission(permission);
    if (!isValid) return false;

    // Check module access
    if (!userPermissions.modules.includes(module)) return false;

    // Check feature permission
    const featureKey = \`\${module}.\${feature}\`;
    const featurePermissions = userPermissions.features[featureKey];
    
    if (!featurePermissions || !featurePermissions.includes(action)) return false;

    // Check data scope
    const userDataScope = userPermissions.dataScopes[featureKey];
    return PermissionUtils.checkDataScopeAccess(userDataScope, dataScope);
  },

  // Check data scope access
  checkDataScopeAccess: (userScope, requiredScope) => {
    const scopeHierarchy = {
      'all': 3,
      'department': 2,
      'own': 1
    };

    const userLevel = scopeHierarchy[userScope] || 0;
    const requiredLevel = scopeHierarchy[requiredScope] || 0;

    return userLevel >= requiredLevel;
  },

  // Get user's effective permissions for a module
  getModulePermissions: (userPermissions, moduleName) => {
    if (!userPermissions || !moduleName) return {};

    const moduleFeatures = {};
    
    Object.entries(userPermissions.features).forEach(([featureKey, permissions]) => {
      if (featureKey.startsWith(\`\${moduleName}.\`)) {
        const feature = featureKey.split('.')[1];
        moduleFeatures[feature] = {
          permissions,
          dataScope: userPermissions.dataScopes[featureKey]
        };
      }
    });

    return moduleFeatures;
  },

  // Filter data based on user's data scope
  filterDataByScope: (data, userScope, userId, userDepartmentId) => {
    if (!data || !Array.isArray(data)) return data;

    switch (userScope) {
      case 'all':
        return data;
      
      case 'department':
        return data.filter(item => 
          item.departmentId === userDepartmentId || 
          item.createdBy === userId
        );
      
      case 'own':
        return data.filter(item => item.createdBy === userId);
      
      default:
        return [];
    }
  },

  // Generate permission-based query filters
  generateQueryFilters: (userPermissions, permission, userId, userDepartmentId) => {
    const dataScope = userPermissions.dataScopes[permission];
    
    switch (dataScope) {
      case 'all':
        return {}; // No filters
      
      case 'department':
        return {
          $or: [
            { departmentId: userDepartmentId },
            { createdBy: userId }
          ]
        };
      
      case 'own':
        return { createdBy: userId };
      
      default:
        return { createdBy: userId }; // Most restrictive by default
    }
  },

  // Check if user can access specific resource
  canAccessResource: (userPermissions, permission, resource, userId, userDepartmentId) => {
    if (!PermissionUtils.canPerformAction(userPermissions, permission)) {
      return false;
    }

    const dataScope = userPermissions.dataScopes[permission];
    
    switch (dataScope) {
      case 'all':
        return true;
      
      case 'department':
        return resource.departmentId === userDepartmentId || resource.createdBy === userId;
      
      case 'own':
        return resource.createdBy === userId;
      
      default:
        return false;
    }
  }
};

export default PermissionUtils;
`;
};

export default {
  generatePermissionGuardTemplate,
  generateRoutingConfig,
  generatePermissionUtils
};
