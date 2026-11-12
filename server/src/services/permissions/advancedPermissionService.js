/**
 * Advanced Permission Service - Phase 4 Implementation
 * Multi-layer permission checking with Redis caching and data isolation
 */

import { query } from '../../database/connection.js';
import { writeAuditLog } from '../system/auditLogWriter.js';
import redisManager, { CacheKeys, CacheTTL } from '../../config/redis.js';
import { PermissionService } from './permissionService.js';

export class AdvancedPermissionService extends PermissionService {
  
  /**
   * Get user permissions with Redis caching
   */
  static async getUserPermissions(userId, useCache = true) {
    const cacheKey = CacheKeys.userPermissions(userId);
    
    // Try to get from cache first
    if (useCache) {
      const cachedPermissions = await redisManager.get(cacheKey);
      if (cachedPermissions) {
        return cachedPermissions;
      }
    }

    // Get from database
    const permissions = await super.getUserPermissions(userId);
    
    // Cache the result
    if (useCache && permissions) {
      await redisManager.set(cacheKey, permissions, CacheTTL.PERMISSIONS);
    }
    
    return permissions;
  }

  /**
   * Get superuser permissions with Redis caching
   */
  static async getSuperuserPermissions(useCache = true) {
    const cacheKey = CacheKeys.superuserPermissions();
    
    // Try to get from cache first
    if (useCache) {
      const cachedPermissions = await redisManager.get(cacheKey);
      if (cachedPermissions) {
        return cachedPermissions;
      }
    }

    // Get from database
    const permissions = await super.getSuperuserPermissions();
    
    // Cache the result (longer TTL for superuser permissions)
    if (useCache && permissions) {
      await redisManager.set(cacheKey, permissions, CacheTTL.SUPERUSER);
    }
    
    return permissions;
  }

  /**
   * Advanced data access validation
   * Checks if user can access specific resource based on data scope and ownership
   */
  static async checkDataAccess(userId, resourceType, resourceId, action, additionalContext = {}) {
    try {
      // Parse resource type (format: module.feature)
      const [module, feature] = resourceType.split('.');
      if (!module || !feature) {
        return { hasAccess: false, reason: 'Invalid resource type format' };
      }

      // Check basic permission first
      const hasPermission = await this.hasPermission(userId, module, feature, action);
      if (!hasPermission) {
        return { hasAccess: false, reason: 'Permission denied' };
      }

      // Get user's data scope for this resource
      const dataScope = await this.getDataScope(userId, module, feature);
      
      // If scope is 'all', user has access to everything
      if (dataScope === 'all') {
        return { hasAccess: true, dataScope };
      }

      // If no specific resource ID, just check permission (for list operations)
      if (!resourceId) {
        return { hasAccess: true, dataScope };
      }

      // For specific resource access, validate ownership/department scope
      const accessValidation = await this._validateResourceAccess(
        userId, 
        resourceType, 
        resourceId, 
        dataScope, 
        additionalContext
      );

      return accessValidation;
    } catch (error) {
      console.error('Error checking data access:', error);
      return { hasAccess: false, reason: 'Access validation error' };
    }
  }

  /**
   * Validate resource access based on data scope
   */
  static async _validateResourceAccess(userId, resourceType, resourceId, dataScope, context) {
    try {
      const [module, feature] = resourceType.split('.');
      
      // Build dynamic query based on resource type
      let resourceQuery;
      let queryParams = [resourceId];

      switch (resourceType) {
        case 'user_management.users':
          resourceQuery = `
            SELECT u.id, u.created_by, ur.role_id, r.department_id
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.id = $1 AND u.deleted_at IS NULL
          `;
          break;

        case 'user_management.departments':
          resourceQuery = `
            SELECT id, created_by
            FROM departments 
            WHERE id = $1 AND is_active = true
          `;
          break;

        case 'user_management.roles':
          resourceQuery = `
            SELECT id, department_id, created_by
            FROM roles 
            WHERE id = $1 AND is_active = true
          `;
          break;

        case 'procurement.purchase_orders':
          resourceQuery = `
            SELECT po.id, po.created_by, po.department_id, po.status
            FROM purchase_orders po
            WHERE po.id = $1 AND po.deleted_at IS NULL
          `;
          break;

        case 'inventory.items':
          resourceQuery = `
            SELECT i.id, i.created_by, i.department_id
            FROM items i
            WHERE i.id = $1 AND i.deleted_at IS NULL
          `;
          break;

        default:
          // Generic fallback for other resource types
          resourceQuery = `
            SELECT id, created_by, department_id
            FROM ${this._getTableName(resourceType)}
            WHERE id = $1
          `;
      }

      const resourceResult = await query(resourceQuery, queryParams);
      
      if (resourceResult.rows.length === 0) {
        return { hasAccess: false, reason: 'Resource not found' };
      }

      const resource = resourceResult.rows[0];
      
      // Get user's department info
      const userResult = await query(`
        SELECT u.id, ur.role_id, r.department_id, r.role_level
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
      `, [userId]);

      if (userResult.rows.length === 0) {
        return { hasAccess: false, reason: 'User not found' };
      }

      const user = userResult.rows[0];

      // Apply data scope rules
      switch (dataScope) {
        case 'own':
          // User can only access their own records
          if (resource.created_by === userId) {
            return { hasAccess: true, dataScope, ownership: 'own' };
          }
          return { hasAccess: false, reason: 'Access limited to own records' };

        case 'department':
          // User can access records within their department
          if (resource.department_id === user.department_id) {
            return { hasAccess: true, dataScope, ownership: 'department' };
          }
          // Also allow access to own records even if in different department context
          if (resource.created_by === userId) {
            return { hasAccess: true, dataScope, ownership: 'own' };
          }
          return { hasAccess: false, reason: 'Access limited to department records' };

        case 'all':
          // This case should be handled earlier, but including for completeness
          return { hasAccess: true, dataScope, ownership: 'all' };

        default:
          return { hasAccess: false, reason: 'Invalid data scope' };
      }
    } catch (error) {
      console.error('Error validating resource access:', error);
      return { hasAccess: false, reason: 'Resource validation error' };
    }
  }

  /**
   * Get table name from resource type
   */
  static _getTableName(resourceType) {
    const tableMap = {
      'user_management.users': 'users',
      'user_management.departments': 'departments',
      'user_management.roles': 'roles',
      'procurement.purchase_orders': 'purchase_orders',
      'procurement.suppliers': 'suppliers',
      'inventory.items': 'items',
      'inventory.warehouses': 'warehouses',
      'inventory.stock_movements': 'stock_movements'
    };
    
    return tableMap[resourceType] || 'unknown_table';
  }

  /**
   * Get available modules for user with caching
   */
  static async getAvailableModules(userId, useCache = true) {
    const cacheKey = CacheKeys.userModules(userId);
    
    // Try cache first
    if (useCache) {
      const cachedModules = await redisManager.get(cacheKey);
      if (cachedModules) {
        return cachedModules;
      }
    }

    try {
      // Check if superuser
      const superuserCheck = await query(
        'SELECT is_superuser FROM users WHERE id = $1',
        [userId]
      );

      if (superuserCheck.rows.length > 0 && superuserCheck.rows[0].is_superuser) {
        // Superuser gets all active modules
        const result = await query(`
          SELECT name, display_name, description, icon, color, module_order
          FROM modules 
          WHERE is_active = true
          ORDER BY module_order
        `);
        
        const modules = result.rows;
        if (useCache) {
          await redisManager.set(cacheKey, modules, CacheTTL.MODULES);
        }
        return modules;
      }

      // Regular user - get department modules
      const result = await query(`
        SELECT DISTINCT m.name, m.display_name, m.description, m.icon, m.color, m.module_order
        FROM modules m
        JOIN department_modules dm ON m.id = dm.module_id
        JOIN departments d ON dm.department_id = d.id
        JOIN roles r ON d.id = r.department_id
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = $1 
          AND ur.is_active = true 
          AND r.is_active = true 
          AND d.is_active = true 
          AND dm.is_active = true 
          AND m.is_active = true
        ORDER BY m.module_order
      `, [userId]);

      const modules = result.rows;
      if (useCache) {
        await redisManager.set(cacheKey, modules, CacheTTL.MODULES);
      }
      return modules;
    } catch (error) {
      console.error('Error getting available modules:', error);
      return [];
    }
  }

  /**
   * Refresh user permissions and clear cache
   */
  static async refreshUserPermissions(userId) {
    try {
      // Clear all related cache entries
      await redisManager.del(CacheKeys.userPermissions(userId));
      await redisManager.del(CacheKeys.userModules(userId));
      await redisManager.delPattern(`${CacheKeys.userDataScope(userId, '*')}`);
      await redisManager.delPattern(`${CacheKeys.userSession(userId)}*`);

      // Get fresh permissions
      const permissions = await this.getUserPermissions(userId, false);
      
      // Pre-populate cache with fresh data
      await redisManager.set(CacheKeys.userPermissions(userId), permissions, CacheTTL.PERMISSIONS);
      
      return permissions;
    } catch (error) {
      console.error('Error refreshing user permissions:', error);
      throw error;
    }
  }

  /**
   * Refresh all permissions cache (useful when roles or modules change)
   */
  static async refreshAllPermissions() {
    try {
      // Clear all permission-related caches
      await redisManager.delPattern('perm:*');
      await redisManager.delPattern('modules:*');
      await redisManager.delPattern('scope:*');
      
      console.log('All permissions cache cleared');
      return true;
    } catch (error) {
      console.error('Error refreshing all permissions:', error);
      return false;
    }
  }

  /**
   * Get data scope with caching
   */
  static async getDataScope(userId, module, feature, useCache = true) {
    const cacheKey = CacheKeys.userDataScope(userId, `${module}.${feature}`);
    
    // Try cache first
    if (useCache) {
      const cachedScope = await redisManager.get(cacheKey);
      if (cachedScope) {
        return cachedScope;
      }
    }

    // Get from database
    const scope = await super.getDataScope(userId, module, feature);
    
    // Cache the result
    if (useCache && scope) {
      await redisManager.set(cacheKey, scope, CacheTTL.DATA_SCOPE);
    }
    
    return scope;
  }

  /**
   * Bulk permission check for multiple resources
   */
  static async bulkCheckPermissions(userId, checks) {
    const results = {};
    
    // Process checks in parallel for better performance
    const promises = checks.map(async (check) => {
      const { id, module, feature, action, resourceId } = check;
      const resourceType = `${module}.${feature}`;
      
      const result = await this.checkDataAccess(userId, resourceType, resourceId, action);
      return { id, result };
    });

    const checkResults = await Promise.all(promises);
    
    // Convert to object with check IDs as keys
    checkResults.forEach(({ id, result }) => {
      results[id] = result;
    });

    return results;
  }

  /**
   * Generate data filter conditions for database queries based on user's data scope
   */
  static async getDataFilterConditions(userId, resourceType, tableAlias = '') {
    try {
      const [module, feature] = resourceType.split('.');
      const dataScope = await this.getDataScope(userId, module, feature);
      
      const prefix = tableAlias ? `${tableAlias}.` : '';
      
      switch (dataScope) {
        case 'own':
          return {
            condition: `${prefix}created_by = $1`,
            params: [userId],
            paramIndex: 1
          };
          
        case 'department':
          // Get user's department
          const userDept = await query(`
            SELECT r.department_id
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
            JOIN roles r ON ur.role_id = r.id
            WHERE u.id = $1
          `, [userId]);
          
          if (userDept.rows.length === 0) {
            return {
              condition: `${prefix}created_by = $1`,
              params: [userId],
              paramIndex: 1
            };
          }
          
          return {
            condition: `(${prefix}department_id = $1 OR ${prefix}created_by = $2)`,
            params: [userDept.rows[0].department_id, userId],
            paramIndex: 2
          };
          
        case 'all':
          return {
            condition: '1=1', // No filter - access to all data
            params: [],
            paramIndex: 0
          };
          
        default:
          return {
            condition: `${prefix}created_by = $1`,
            params: [userId],
            paramIndex: 1
          };
      }
    } catch (error) {
      console.error('Error generating data filter conditions:', error);
      return {
        condition: `${prefix}created_by = $1`,
        params: [userId],
        paramIndex: 1
      };
    }
  }

  /**
   * Log permission access for audit purposes
   */
  static async logPermissionAccess(userId, action, resourceType, resourceId, result, additionalData = {}) {
    try {
      // Map to safe audit_action values to avoid enum issues
      const auditAction = result.hasAccess ? 'permission_granted' : 'permission_revoked';

      await writeAuditLog({
        userId: userId || null,
        action: auditAction,
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        oldValues: null,
        newValues: null,
        ipAddress: null,
        userAgent: null,
        requestMethod: null,
        requestPath: null,
        requestQuery: null,
        description: result.reason || 'Permission check completed',
        success: !!result.hasAccess,
        errorMessage: null,
        metadata: {
          dataScope: result.dataScope,
          ownership: result.ownership,
          originalAction: action,
          ...additionalData
        }
      });
    } catch (error) {
      console.error('Error logging permission access:', error);
      // Don't throw error here to avoid breaking the main flow
    }
  }
}

export default AdvancedPermissionService;
