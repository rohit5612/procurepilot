/**
 * Advanced Permission Middleware - Phase 4 Implementation
 * Multi-layer permission checking with data access validation and caching
 */

import AdvancedPermissionService from '../../services/permissions/advancedPermissionService.js';
import redisManager from '../../config/redis.js';
import { writeAuditLog } from '../../services/system/auditLogWriter.js';

/**
 * Enhanced permission middleware with data access validation
 */
export const hasPermissionWithDataAccess = (requiredPermission, options = {}) => {
  const {
    checkDataAccess = true,
    resourceIdParam = 'id',
    resourceType = null,
    logAccess = true
  } = options;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Superuser has all permissions
      if (req.user.isSuperuser) {
        req.permissionContext = {
          hasAccess: true,
          dataScope: 'all',
          ownership: 'all',
          isSuperuser: true
        };
        return next();
      }

      // Parse required permission (format: module.feature.action)
      const [module, feature, action] = requiredPermission.split('.');
      
      if (!module || !feature || !action) {
        return res.status(400).json({
          success: false,
          message: 'Invalid permission format'
        });
      }

      // Determine resource type
      const effectiveResourceType = resourceType || `${module}.${feature}`;
      
      // Get resource ID from request parameters
      const resourceId = req.params[resourceIdParam] || req.body.id || req.query.id;

      // Check data access
      const accessResult = await AdvancedPermissionService.checkDataAccess(
        req.user.id,
        effectiveResourceType,
        resourceId,
        action,
        {
          method: req.method,
          path: req.path,
          query: req.query,
          body: req.body
        }
      );

      if (!accessResult.hasAccess) {
        // Log failed access attempt
        if (logAccess) {
          await AdvancedPermissionService.logPermissionAccess(
            req.user.id,
            action,
            effectiveResourceType,
            resourceId,
            accessResult,
            { method: req.method, path: req.path }
          );
        }

        return res.status(403).json({
          success: false,
          message: accessResult.reason || 'Access denied',
          code: 'PERMISSION_DENIED'
        });
      }

      // Attach permission context to request
      req.permissionContext = {
        module,
        feature,
        action,
        dataScope: accessResult.dataScope,
        ownership: accessResult.ownership,
        hasAccess: true,
        resourceType: effectiveResourceType,
        resourceId
      };

      // Log successful access if enabled
      if (logAccess && resourceId) {
        await AdvancedPermissionService.logPermissionAccess(
          req.user.id,
          action,
          effectiveResourceType,
          resourceId,
          accessResult,
          { method: req.method, path: req.path }
        );
      }

      next();
    } catch (error) {
      console.error('Advanced permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Permission validation error'
      });
    }
  };
};

/**
 * Data scope filter middleware - adds WHERE conditions to query based on user's data scope
 */
export const applyScopeFilter = (resourceType, options = {}) => {
  const {
    tableAlias = '',
    paramStartIndex = 1,
    skipIfSuperuser = true
  } = options;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Skip filtering for superuser if specified
      if (skipIfSuperuser && req.user.isSuperuser) {
        req.scopeFilter = {
          condition: '1=1',
          params: [],
          paramIndex: paramStartIndex
        };
        return next();
      }

      // Get data filter conditions based on user's scope
      const filterConditions = await AdvancedPermissionService.getDataFilterConditions(
        req.user.id,
        resourceType,
        tableAlias
      );

      // Adjust parameter indices if needed
      const adjustedConditions = {
        ...filterConditions,
        paramIndex: paramStartIndex + filterConditions.params.length - 1
      };

      req.scopeFilter = adjustedConditions;
      next();
    } catch (error) {
      console.error('Scope filter middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Scope filter error'
      });
    }
  };
};

/**
 * Bulk permission check middleware for operations affecting multiple resources
 */
export const bulkPermissionCheck = (permissionTemplate, options = {}) => {
  const {
    resourceListParam = 'ids',
    resourceType = null,
    logAccess = true
  } = options;

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Superuser has all permissions
      if (req.user.isSuperuser) {
        req.bulkPermissionContext = {
          hasAccess: true,
          accessibleResources: 'all',
          deniedResources: [],
          isSuperuser: true
        };
        return next();
      }

      // Get resource IDs from request
      const resourceIds = req.body[resourceListParam] || req.query[resourceListParam] || [];
      
      if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
        req.bulkPermissionContext = {
          hasAccess: true,
          accessibleResources: [],
          deniedResources: [],
          isEmpty: true
        };
        return next();
      }

      // Parse permission template
      const [module, feature, action] = permissionTemplate.split('.');
      const effectiveResourceType = resourceType || `${module}.${feature}`;

      // Create bulk permission checks
      const checks = resourceIds.map(id => ({
        id: `resource_${id}`,
        module,
        feature,
        action,
        resourceId: id
      }));

      // Perform bulk permission check
      const results = await AdvancedPermissionService.bulkCheckPermissions(req.user.id, checks);

      // Separate accessible and denied resources
      const accessibleResources = [];
      const deniedResources = [];

      Object.entries(results).forEach(([checkId, result]) => {
        const resourceId = checkId.replace('resource_', '');
        if (result.hasAccess) {
          accessibleResources.push({
            id: resourceId,
            dataScope: result.dataScope,
            ownership: result.ownership
          });
        } else {
          deniedResources.push({
            id: resourceId,
            reason: result.reason
          });
        }
      });

      // Log bulk access attempt
      if (logAccess) {
        await AdvancedPermissionService.logPermissionAccess(
          req.user.id,
          `bulk_${action}`,
          effectiveResourceType,
          null,
          {
            hasAccess: accessibleResources.length > 0,
            reason: `Bulk operation: ${accessibleResources.length} accessible, ${deniedResources.length} denied`
          },
          {
            method: req.method,
            path: req.path,
            resourceCount: resourceIds.length,
            accessibleCount: accessibleResources.length,
            deniedCount: deniedResources.length
          }
        );
      }

      req.bulkPermissionContext = {
        hasAccess: accessibleResources.length > 0,
        accessibleResources,
        deniedResources,
        totalRequested: resourceIds.length
      };

      next();
    } catch (error) {
      console.error('Bulk permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Bulk permission validation error'
      });
    }
  };
};

/**
 * Module access middleware with caching
 */
export const hasModuleAccessCached = (moduleName) => {
  return async (req, res, next) => {
    try {
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

      // Get available modules for user (with caching)
      const availableModules = await AdvancedPermissionService.getAvailableModules(req.user.id);
      const hasAccess = availableModules.some(module => module.name === moduleName);

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied to module: ${moduleName}`,
          code: 'MODULE_ACCESS_DENIED'
        });
      }

      next();
    } catch (error) {
      console.error('Module access middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Module access validation error'
      });
    }
  };
};

/**
 * Rate limiting middleware with Redis
 */
export const rateLimitPermission = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 100,
    skipSuccessfulGET = true,
    keyGenerator = null
  } = options;

  return async (req, res, next) => {
    try {
      // Skip rate limiting for superuser
      if (req.user && req.user.isSuperuser) {
        return next();
      }

      // Generate rate limit key
      const key = keyGenerator 
        ? keyGenerator(req) 
        : req.user 
          ? `rate:user:${req.user.id}:${req.method}:${req.path}`
          : `rate:ip:${req.ip}:${req.method}:${req.path}`;

      // Skip GET requests if they don't modify data and option is enabled
      if (skipSuccessfulGET && req.method === 'GET') {
        return next();
      }

      // Check current request count
      const currentCount = await redisManager.incr(key, Math.ceil(windowMs / 1000));

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests,
        'X-RateLimit-Remaining': Math.max(0, maxRequests - currentCount),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs)
      });

      // Check if limit exceeded
      if (currentCount > maxRequests) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }

      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // Continue without rate limiting if Redis fails
      next();
    }
  };
};

/**
 * Permission audit middleware - logs all permission checks for compliance
 */
export const auditPermissions = (options = {}) => {
  const {
    auditLevel = 'basic', // 'basic', 'detailed', 'full'
    excludeMethods = ['GET'],
    excludePaths = ['/health', '/api/']
  } = options;

  return async (req, res, next) => {
    try {
      // Skip audit for excluded paths
      if (excludePaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      // Skip audit for excluded methods (unless detailed audit)
      if (auditLevel === 'basic' && excludeMethods.includes(req.method)) {
        return next();
      }

      const startTime = Date.now();
      
      // Capture original response methods
      const originalSend = res.send;
      const originalJson = res.json;

      // Override response methods to capture audit data
      res.send = function(data) {
        logAuditEntry(req, res, startTime, data, auditLevel);
        return originalSend.call(this, data);
      };

      res.json = function(data) {
        logAuditEntry(req, res, startTime, data, auditLevel);
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      console.error('Audit middleware error:', error);
      next();
    }
  };
};

/**
 * Log audit entry helper function
 */
async function logAuditEntry(req, res, startTime, responseData, auditLevel) {
  try {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;

    const auditData = {
      userId: req.user?.id || null,
      method: req.method,
      path: req.path,
      query: auditLevel === 'full' ? req.query : Object.keys(req.query),
      statusCode: res.statusCode,
      duration,
      success,
      userAgent: req.get('User-Agent'),
      ip: req.ip
    };

    // Add permission context if available
    if (req.permissionContext) {
      auditData.permission = {
        module: req.permissionContext.module,
        feature: req.permissionContext.feature,
        action: req.permissionContext.action,
        dataScope: req.permissionContext.dataScope,
        ownership: req.permissionContext.ownership
      };
    }

    // Add detailed data for non-basic audit levels
    if (auditLevel === 'detailed' || auditLevel === 'full') {
      auditData.requestBody = req.body;
      if (auditLevel === 'full') {
        auditData.responseBody = responseData;
      }
    }

    // Choose a safe, enum-friendly action based on method and path
    let auditAction = 'data_accessed';
    const method = req.method.toUpperCase();
    const pathLower = req.path.toLowerCase();

    if (pathLower.includes('export')) {
      auditAction = 'data_exported';
    } else if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      auditAction = 'data_updated';
    } else if (method === 'DELETE') {
      auditAction = 'data_deleted';
    }

    // Insert audit log via centralized writer
    await writeAuditLog({
      userId: auditData.userId || null,
      sessionId: null,
      action: auditAction,
      resourceType: 'api_endpoint',
      resourceId: null,
      oldValues: null,
      newValues: null,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestPath: req.path,
      requestQuery: req.query,
      description: `API ${req.method} ${req.path}`,
      success,
      errorMessage: success ? null : (responseData && responseData.message) ? responseData.message : null,
      metadata: {
        ...auditData,
        durationMs: duration
      }
    });
  } catch (error) {
    console.error('Error logging audit entry:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

export default {
  hasPermissionWithDataAccess,
  applyScopeFilter,
  bulkPermissionCheck,
  hasModuleAccessCached,
  rateLimitPermission,
  auditPermissions
};
