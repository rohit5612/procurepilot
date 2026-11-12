/**
 * Permission-based middleware for feature-level access control
 * Enhanced with Redis caching for better performance
 */

import { AdvancedPermissionService } from '../../services/permissions/advancedPermissionService.js';

/**
 * Check if user has required permission with Redis caching
 */
export const hasPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Superuser has all permissions
    if (req.user.isSuperuser) {
      return next();
    }

    const { permissions } = req.user;
    
    // Debug logging for permission issues
    console.log(`🔍 Permission check for ${requiredPermission}:`, {
      userId: req.user.userId,
      email: req.user.email,
      hasPermissions: !!permissions,
      hasFeatures: !!permissions?.features,
      modules: permissions?.modules || [],
      userAgent: req.headers['user-agent']?.includes('Mozilla') ? 'browser' : 'other'
    });
    
    if (!permissions || !permissions.features) {
      console.log(`❌ No permissions configured for user ${req.user.userId}`);
      return res.status(403).json({
        success: false,
        message: 'No permissions configured'
      });
    }

    // Parse required permission (format: module.feature.action)
    const [module, feature, action] = requiredPermission.split('.');
    
    if (!module || !feature || !action) {
      return res.status(400).json({
        success: false,
        message: 'Invalid permission format'
      });
    }

    // Check module access
    if (!permissions.modules.includes(module)) {
      console.log(`❌ Module access denied for ${req.user.userId}: ${module}`, {
        availableModules: permissions.modules
      });
      return res.status(403).json({
        success: false,
        message: `Access denied to module: ${module}`
      });
    }

    // Check feature permission
    const featureKey = `${module}.${feature}`;
    const featurePermissions = permissions.features[featureKey];
    
    console.log(`🔍 Feature check: ${featureKey}`, {
      required: action,
      available: featurePermissions,
      hasPermission: featurePermissions?.includes(action)
    });
    
    if (!featurePermissions || !featurePermissions.includes(action)) {
      console.log(`❌ Permission denied for ${req.user.userId}: ${requiredPermission}`, {
        featureKey,
        availablePermissions: featurePermissions,
        allFeatures: Object.keys(permissions.features)
      });
      return res.status(403).json({
        success: false,
        message: `Permission denied: ${requiredPermission}`
      });
    }

    console.log(`✅ Permission granted for ${req.user.userId}: ${requiredPermission}`);

    // Attach permission context to request
    req.permissionContext = {
      module,
      feature,
      action,
      dataScope: permissions.dataScopes[featureKey] || 'department'
    };

    next();
  };
};

/**
 * Check if user has any of the required permissions (OR logic)
 */
export const hasAnyPermission = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Superuser has all permissions
    if (req.user.isSuperuser) {
      return next();
    }

    const { permissions } = req.user;
    
    if (!permissions || !permissions.features) {
      return res.status(403).json({
        success: false,
        message: 'No permissions configured'
      });
    }

    // Check if user has any of the required permissions
    const hasAccess = requiredPermissions.some(permission => {
      const [module, feature, action] = permission.split('.');
      
      if (!module || !feature || !action) return false;
      
      // Check module access
      if (!permissions.modules.includes(module)) return false;
      
      // Check feature permission
      const featureKey = `${module}.${feature}`;
      const featurePermissions = permissions.features[featureKey];
      
      return featurePermissions && featurePermissions.includes(action);
    });

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required: ${requiredPermissions.join(' OR ')}`
      });
    }

    next();
  };
};

/**
 * Check if user has all required permissions (AND logic)
 */
export const hasAllPermissions = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Superuser has all permissions
    if (req.user.isSuperuser) {
      return next();
    }

    const { permissions } = req.user;
    
    if (!permissions || !permissions.features) {
      return res.status(403).json({
        success: false,
        message: 'No permissions configured'
      });
    }

    // Check if user has all required permissions
    const missingPermissions = requiredPermissions.filter(permission => {
      const [module, feature, action] = permission.split('.');
      
      if (!module || !feature || !action) return true;
      
      // Check module access
      if (!permissions.modules.includes(module)) return true;
      
      // Check feature permission
      const featureKey = `${module}.${feature}`;
      const featurePermissions = permissions.features[featureKey];
      
      return !featurePermissions || !featurePermissions.includes(action);
    });

    if (missingPermissions.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Missing permissions: ${missingPermissions.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Check if user has module access
 */
export const hasModuleAccess = (moduleName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Superuser has all permissions
    if (req.user.isSuperuser) {
      return next();
    }

    const { permissions } = req.user;
    
    if (!permissions || !permissions.modules || !permissions.modules.includes(moduleName)) {
      return res.status(403).json({
        success: false,
        message: `Access denied to module: ${moduleName}`
      });
    }

    next();
  };
};

/**
 * Data scope middleware - filters data based on user's scope
 */
export const dataScope = (resourceType) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Superuser has access to all data
    if (req.user.isSuperuser) {
      req.dataScope = 'all';
      return next();
    }

    const { permissions } = req.user;
    const scope = permissions?.dataScopes?.[resourceType] || 'department';

    // Attach data scope to request for use in controllers
    req.dataScope = scope;
    req.scopeContext = {
      userId: req.user.id,
      departmentId: req.user.departmentId,
      scope: scope
    };

    next();
  };
};
