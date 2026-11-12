/**
 * Permission Controller - Phase 4 Implementation
 * Manages permission refresh, cache invalidation, and permission system utilities
 */

import { AdvancedPermissionService } from '../../services/permissions/advancedPermissionService.js';
import { query } from '../../database/connection.js';
import redisManager from '../../config/redis.js';
import jwtService from '../../services/auth/jwtService.js';

export class PermissionController {
  
  /**
   * Refresh user permissions and clear cache
   */
  static async refreshUserPermissions(req, res) {
    try {
      const { userId } = req.params;
      const targetUserId = parseInt(userId);

      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      // Check if user exists
      const userCheck = await query(
        'SELECT id, email, is_superuser, department_id FROM users WHERE id = $1 AND deleted_at IS NULL',
        [targetUserId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userCheck.rows[0];

      // Refresh permissions
      const refreshedPermissions = await AdvancedPermissionService.refreshUserPermissions(targetUserId);

      // Get user role information for JWT
      const userRoleInfo = await query(`
        SELECT
          r.id as role_id,
          r.name as role_name,
          r.role_level as role_level,
          d.id as department_id,
          d.name as department_name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        JOIN departments d ON ur.department_id = d.id
        WHERE ur.user_id = $1 AND ur.is_active = true
        LIMIT 1
      `, [targetUserId]);

      let roleInfo = null;
      if (userRoleInfo.rows.length > 0) {
        roleInfo = userRoleInfo.rows[0];
      }

      // Generate new JWT token with updated permissions
      const tokenPayload = {
        userId: targetUserId,
        email: user.email,
        departmentId: roleInfo?.department_id || user.department_id,
        departmentName: roleInfo?.department_name || null,
        roleId: roleInfo?.role_id || null,
        roleName: roleInfo?.role_name || null,
        roleLevel: roleInfo?.role_level || null,
        permissions: refreshedPermissions,
        isSuperuser: user.is_superuser
      };

      const newToken = jwtService.generateAccessToken(tokenPayload);

      res.status(200).json({
        success: true,
        message: 'User permissions refreshed successfully',
        data: {
          userId: targetUserId,
          email: user.email,
          isSuperuser: user.is_superuser,
          permissions: refreshedPermissions,
          accessToken: newToken,
          refreshedAt: new Date().toISOString(),
          cacheEnabled: redisManager.isAvailable()
        }
      });
    } catch (error) {
      console.error('Error refreshing user permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh user permissions'
      });
    }
  }

  /**
   * Refresh permissions for the authenticated user (self)
   */
  static async refreshSelfPermissions(req, res) {
    try {
      const targetUserId = req.user.userId;

      // Check if user exists
      const userCheck = await query(
        'SELECT id, email, is_superuser FROM users WHERE id = $1 AND deleted_at IS NULL',
        [targetUserId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userCheck.rows[0];

      // Refresh permissions
      const refreshedPermissions = await AdvancedPermissionService.refreshUserPermissions(targetUserId);

      // Get user role information for JWT
      const userRoleInfo = await query(`
        SELECT
          r.id as role_id,
          r.name as role_name,
          r.role_level as role_level,
          d.id as department_id,
          d.name as department_name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        JOIN departments d ON ur.department_id = d.id
        WHERE ur.user_id = $1 AND ur.is_active = true
        LIMIT 1
      `, [targetUserId]);

      let roleInfo = null;
      if (userRoleInfo.rows.length > 0) {
        roleInfo = userRoleInfo.rows[0];
      }

      // Generate new JWT token with updated permissions
      const tokenPayload = {
        userId: targetUserId,
        email: user.email,
        departmentId: roleInfo?.department_id || user.department_id,
        departmentName: roleInfo?.department_name || null,
        roleId: roleInfo?.role_id || null,
        roleName: roleInfo?.role_name || null,
        roleLevel: roleInfo?.role_level || null,
        permissions: refreshedPermissions,
        isSuperuser: user.is_superuser
      };

      const newToken = jwtService.generateAccessToken(tokenPayload);

      res.status(200).json({
        success: true,
        message: 'User permissions refreshed successfully',
        data: {
          userId: targetUserId,
          email: user.email,
          isSuperuser: user.is_superuser,
          permissions: refreshedPermissions,
          accessToken: newToken,
          refreshedAt: new Date().toISOString(),
          cacheEnabled: redisManager.isAvailable()
        }
      });
    } catch (error) {
      console.error('Error refreshing self permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh user permissions'
      });
    }
  }

  /**
   * Refresh all permissions cache
   */
  static async refreshAllPermissions(req, res) {
    try {
      const refreshResult = await AdvancedPermissionService.refreshAllPermissions();

      res.status(200).json({
        success: true,
        message: 'All permissions cache refreshed successfully',
        data: {
          refreshedAt: new Date().toISOString(),
          cacheCleared: refreshResult,
          cacheEnabled: redisManager.isAvailable()
        }
      });
    } catch (error) {
      console.error('Error refreshing all permissions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh permissions cache'
      });
    }
  }

  /**
   * Get permission system statistics
   */
  static async getPermissionStats(req, res) {
    try {
      // Get database statistics
      const stats = await Promise.all([
        // Total users with roles
        query(`
          SELECT COUNT(DISTINCT u.id) as total_users
          FROM users u
          JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
          WHERE u.deleted_at IS NULL AND u.status = 'active'
        `),
        
        // Active roles count
        query('SELECT COUNT(*) as total_roles FROM roles WHERE is_active = true'),
        
        // Active departments count
        query('SELECT COUNT(*) as total_departments FROM departments WHERE is_active = true'),
        
        // Permission entries count
        query('SELECT COUNT(*) as total_permissions FROM role_permissions'),
        
        // Superuser count
        query('SELECT COUNT(*) as superuser_count FROM users WHERE is_superuser = true AND deleted_at IS NULL'),
        
        // Module assignments
        query('SELECT COUNT(*) as module_assignments FROM department_modules WHERE is_active = true')
      ]);

      // Get Redis cache statistics
      let cacheStats = null;
      if (redisManager.isAvailable()) {
        try {
          // Get cache key counts by pattern
          const permissionKeys = await redisManager.client.keys('perm:*');
          const moduleKeys = await redisManager.client.keys('modules:*');
          const scopeKeys = await redisManager.client.keys('scope:*');
          
          cacheStats = {
            enabled: true,
            permissionKeys: permissionKeys.length,
            moduleKeys: moduleKeys.length,
            scopeKeys: scopeKeys.length,
            totalKeys: permissionKeys.length + moduleKeys.length + scopeKeys.length
          };
        } catch (error) {
          cacheStats = {
            enabled: true,
            error: 'Failed to get cache statistics'
          };
        }
      } else {
        cacheStats = {
          enabled: false,
          reason: 'Redis not available'
        };
      }

      const result = {
        database: {
          totalUsers: parseInt(stats[0].rows[0].total_users),
          totalRoles: parseInt(stats[1].rows[0].total_roles),
          totalDepartments: parseInt(stats[2].rows[0].total_departments),
          totalPermissions: parseInt(stats[3].rows[0].total_permissions),
          superuserCount: parseInt(stats[4].rows[0].superuser_count),
          moduleAssignments: parseInt(stats[5].rows[0].module_assignments)
        },
        cache: cacheStats,
        system: {
          rlsEnabled: true,
          auditingEnabled: true,
          lastUpdated: new Date().toISOString()
        }
      };

      res.status(200).json({
        success: true,
        message: 'Permission system statistics retrieved',
        data: result
      });
    } catch (error) {
      console.error('Error getting permission statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get permission statistics'
      });
    }
  }

  /**
   * Check specific user permission
   */
  static async checkUserPermission(req, res) {
    try {
      const { userId } = req.params;
      const { module, feature, action, resourceId } = req.query;

      if (!module || !feature || !action) {
        return res.status(400).json({
          success: false,
          message: 'module, feature, and action are required query parameters'
        });
      }

      const targetUserId = parseInt(userId);
      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      const resourceType = `${module}.${feature}`;
      const accessResult = await AdvancedPermissionService.checkDataAccess(
        targetUserId,
        resourceType,
        resourceId ? parseInt(resourceId) : null,
        action
      );

      res.status(200).json({
        success: true,
        message: 'Permission check completed',
        data: {
          userId: targetUserId,
          permission: `${module}.${feature}.${action}`,
          resourceId: resourceId || null,
          result: accessResult,
          checkedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error checking user permission:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check user permission'
      });
    }
  }

  /**
   * Get user's available modules
   */
  static async getUserModules(req, res) {
    try {
      const { userId } = req.params;
      const targetUserId = parseInt(userId);

      if (isNaN(targetUserId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID'
        });
      }

      const modules = await AdvancedPermissionService.getAvailableModules(targetUserId);

      res.status(200).json({
        success: true,
        message: 'User modules retrieved successfully',
        data: {
          userId: targetUserId,
          modules,
          moduleCount: modules.length,
          retrievedAt: new Date().toISOString(),
          fromCache: redisManager.isAvailable()
        }
      });
    } catch (error) {
      console.error('Error getting user modules:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get user modules'
      });
    }
  }

  /**
   * Bulk permission check for multiple users and resources
   */
  static async bulkPermissionCheck(req, res) {
    try {
      const { checks } = req.body;

      if (!Array.isArray(checks) || checks.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'checks array is required and must not be empty'
        });
      }

      // Validate check format
      for (const check of checks) {
        if (!check.userId || !check.module || !check.feature || !check.action) {
          return res.status(400).json({
            success: false,
            message: 'Each check must have userId, module, feature, and action'
          });
        }
      }

      // Group checks by user for efficient processing
      const userChecks = {};
      checks.forEach(check => {
        if (!userChecks[check.userId]) {
          userChecks[check.userId] = [];
        }
        userChecks[check.userId].push({
          id: check.id || `${check.module}.${check.feature}.${check.action}`,
          module: check.module,
          feature: check.feature,
          action: check.action,
          resourceId: check.resourceId
        });
      });

      // Process bulk checks for each user
      const results = {};
      for (const [userId, userCheckList] of Object.entries(userChecks)) {
        try {
          const userResults = await AdvancedPermissionService.bulkCheckPermissions(
            parseInt(userId),
            userCheckList
          );
          results[userId] = userResults;
        } catch (error) {
          console.error(`Error checking permissions for user ${userId}:`, error);
          results[userId] = { error: 'Failed to check permissions for this user' };
        }
      }

      res.status(200).json({
        success: true,
        message: 'Bulk permission check completed',
        data: {
          results,
          totalChecks: checks.length,
          userCount: Object.keys(userChecks).length,
          checkedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error in bulk permission check:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk permission check'
      });
    }
  }

  /**
   * Clear specific cache entries
   */
  static async clearCache(req, res) {
    try {
      const { pattern, userId, type } = req.query;

      if (!redisManager.isAvailable()) {
        return res.status(503).json({
          success: false,
          message: 'Cache not available - Redis not connected'
        });
      }

      let clearedKeys = 0;
      let clearPattern = '';

      if (pattern) {
        // Clear by custom pattern
        clearPattern = pattern;
        await redisManager.delPattern(pattern);
        const keys = await redisManager.client.keys(pattern);
        clearedKeys = keys.length;
      } else if (userId) {
        // Clear user-specific cache
        const patterns = [
          `perm:user:${userId}`,
          `modules:user:${userId}`,
          `scope:${userId}:*`,
          `session:${userId}*`
        ];
        
        for (const pat of patterns) {
          await redisManager.delPattern(pat);
        }
        clearPattern = `user:${userId}`;
        clearedKeys = patterns.length;
      } else if (type) {
        // Clear by type
        switch (type) {
          case 'permissions':
            clearPattern = 'perm:*';
            break;
          case 'modules':
            clearPattern = 'modules:*';
            break;
          case 'scope':
            clearPattern = 'scope:*';
            break;
          case 'all':
            clearPattern = '*';
            break;
          default:
            return res.status(400).json({
              success: false,
              message: 'Invalid cache type. Use: permissions, modules, scope, or all'
            });
        }
        
        await redisManager.delPattern(clearPattern);
        const keys = await redisManager.client.keys(clearPattern);
        clearedKeys = keys.length;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Specify pattern, userId, or type parameter'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Cache cleared successfully',
        data: {
          pattern: clearPattern,
          clearedKeys,
          clearedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error clearing cache:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear cache'
      });
    }
  }
}

export default PermissionController;
