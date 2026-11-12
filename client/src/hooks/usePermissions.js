import { useAuth } from '../contexts/AuthContext';

export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (permissionKey) => {
    // Superuser has all permissions
    if (user?.isSuperuser) {
      return true;
    }

    // User must be fully assigned to have any permissions
    if (!user?.isFullyAssigned) {
      return false;
    }

    // Check if user has specific permission
    const permissions = user?.permissions?.features || {};

    // Parse permission key like "user_management.user_approval.read"
    const parts = permissionKey.split('.');
    if (parts.length !== 3) {
      return false;
    }

    const [module, feature, action] = parts;
    const featureKey = `${module}.${feature}`;

    // Check if user has the specific feature permissions
    const featurePermissions = permissions[featureKey];
    if (!featurePermissions || !Array.isArray(featurePermissions)) {
      return false;
    }

    // Check if user has the specific action permission
    return featurePermissions.includes(action);
  };

  const hasAnyFeaturePermissionForModule = (moduleName) => {
    // Superuser has all permissions
    if (user?.isSuperuser) {
      return true;
    }

    // User must be fully assigned to have any permissions
    if (!user?.isFullyAssigned) {
      return false;
    }

    const features = user?.permissions?.features || {};
    const modulePrefix = `${moduleName}.`;
    for (const [featureKey, actions] of Object.entries(features)) {
      if (featureKey.startsWith(modulePrefix) && Array.isArray(actions) && actions.length > 0) {
        return true;
      }
    }
    return false;
  };

  const hasModuleAccess = (moduleName) => {
    // Superuser has access to all modules
    if (user?.isSuperuser) {
      return true;
    }

    // User must be fully assigned to have any module access
    if (!user?.isFullyAssigned) {
      return false;
    }

    const modules = user?.permissions?.modules || [];
    return modules.includes(moduleName);
  };

  const getRoleLevel = () => {
    return user?.roleLevel || 99; // 99 = lowest priority if no role
  };

  const isAtLeastLevel = (requiredLevel) => {
    // Superuser (level 0) has highest access
    if (user?.isSuperuser) {
      return true;
    }

    // User must be fully assigned
    if (!user?.isFullyAssigned) {
      return false;
    }

    // Lower numbers = higher access (0=superadmin, 1=admin, etc.)
    return getRoleLevel() <= requiredLevel;
  };

  return {
    hasPermission,
    hasModuleAccess,
    hasAnyFeaturePermissionForModule,
    getRoleLevel,
    isAtLeastLevel,
    isFullyAssigned: user?.isFullyAssigned || user?.isSuperuser,
    isSuperuser: user?.isSuperuser,
    userRole: user?.roleName,
    userDepartment: user?.departmentName
  };
};

export default usePermissions;
