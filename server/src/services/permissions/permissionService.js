import { query } from '../../database/connection.js';
import { procurePilotFeaturePairSql } from '../../config/procurePilotAccess.js';

const FEATURE_CATALOG_SQL = procurePilotFeaturePairSql('m', 'f');

export class PermissionService {
  /**
   * Get user permissions based on their role
   */
  static async getUserPermissions(userId) {
    try {
      const result = await query(`
        SELECT 
          m.name as module_name,
          f.name as feature_name,
          rp.permissions,
          rp.data_scope,
          rp.can_approve,
          rp.can_export,
          rp.can_bulk_action
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN features f ON rp.feature_id = f.id AND f.is_active = true
        JOIN modules m ON f.module_id = m.id AND m.is_active = true
        JOIN department_modules dm ON m.id = dm.module_id AND dm.is_active = true
        JOIN departments d ON dm.department_id = d.id AND d.is_active = true AND d.id = r.department_id
        WHERE u.id = $1
        AND ${FEATURE_CATALOG_SQL}
        ORDER BY m.module_order, f.feature_order
      `, [userId]);

      const permissions = {
        modules: [],
        features: {},
        dataScopes: {}
      };

      const moduleSet = new Set();

      result.rows.forEach(row => {
        // Add module to modules array
        if (!moduleSet.has(row.module_name)) {
          permissions.modules.push(row.module_name);
          moduleSet.add(row.module_name);
        }

        // Add feature permissions
        const featureKey = `${row.module_name}.${row.feature_name}`;
        const featurePermissions = Array.isArray(row.permissions) ? row.permissions : [];
        
        // Add special permissions
        if (row.can_approve) featurePermissions.push('approve');
        if (row.can_export) featurePermissions.push('export');
        if (row.can_bulk_action) featurePermissions.push('bulk_action');

        permissions.features[featureKey] = [...new Set(featurePermissions)];
        permissions.dataScopes[featureKey] = row.data_scope;
      });

      return permissions;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return {
        modules: [],
        features: {},
        dataScopes: {}
      };
    }
  }

  /**
   * Get superuser permissions (all permissions)
   */
  static async getSuperuserPermissions() {
    try {
      const result = await query(`
        SELECT 
          m.name as module_name,
          f.name as feature_name,
          f.available_permissions
        FROM modules m
        JOIN features f ON m.id = f.module_id
        WHERE m.is_active = true AND f.is_active = true
        AND ${FEATURE_CATALOG_SQL}
        ORDER BY m.module_order, f.feature_order
      `);

      const permissions = {
        modules: [],
        features: {},
        dataScopes: {}
      };

      const moduleSet = new Set();

      result.rows.forEach(row => {
        // Add module to modules array
        if (!moduleSet.has(row.module_name)) {
          permissions.modules.push(row.module_name);
          moduleSet.add(row.module_name);
        }

        // Add all available permissions for the feature
        const featureKey = `${row.module_name}.${row.feature_name}`;
        const availablePermissions = Array.isArray(row.available_permissions) 
          ? row.available_permissions 
          : ['create', 'read', 'update', 'delete'];

        // Superuser gets all permissions including special ones
        permissions.features[featureKey] = [
          ...availablePermissions,
          'approve',
          'export',
          'bulk_action'
        ];
        permissions.dataScopes[featureKey] = 'all';
      });

      return permissions;
    } catch (error) {
      console.error('Error getting superuser permissions:', error);
      return {
        modules: [],
        features: {},
        dataScopes: {}
      };
    }
  }

  /**
   * Check if user has specific permission
   */
  static async hasPermission(userId, module, feature, action) {
    try {
      // Check if user is superuser
      const superuserCheck = await query(
        'SELECT is_superuser FROM users WHERE id = $1',
        [userId]
      );

      if (superuserCheck.rows.length > 0 && superuserCheck.rows[0].is_superuser) {
        return true;
      }

      // Check specific permission
      const result = await query(`
        SELECT rp.permissions, rp.can_approve, rp.can_export, rp.can_bulk_action
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN features f ON rp.feature_id = f.id AND f.name = $3
        JOIN modules m ON f.module_id = m.id AND m.name = $2
        WHERE u.id = $1
      `, [userId, module, feature]);

      if (result.rows.length === 0) {
        return false;
      }

      const row = result.rows[0];
      const permissions = Array.isArray(row.permissions) ? row.permissions : [];

      // Check standard permissions
      if (permissions.includes(action)) {
        return true;
      }

      // Check special permissions
      if (action === 'approve' && row.can_approve) {
        return true;
      }

      if (action === 'export' && row.can_export) {
        return true;
      }

      if (action === 'bulk_action' && row.can_bulk_action) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Get user's data scope for a specific resource
   */
  static async getDataScope(userId, module, feature) {
    try {
      // Check if user is superuser
      const superuserCheck = await query(
        'SELECT is_superuser FROM users WHERE id = $1',
        [userId]
      );

      if (superuserCheck.rows.length > 0 && superuserCheck.rows[0].is_superuser) {
        return 'all';
      }

      // Get specific data scope
      const result = await query(`
        SELECT rp.data_scope
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN features f ON rp.feature_id = f.id AND f.name = $3
        JOIN modules m ON f.module_id = m.id AND m.name = $2
        WHERE u.id = $1
      `, [userId, module, feature]);

      if (result.rows.length === 0) {
        return 'own'; // Most restrictive by default
      }

      return result.rows[0].data_scope || 'department';
    } catch (error) {
      console.error('Error getting data scope:', error);
      return 'own'; // Most restrictive on error
    }
  }

  /**
   * Refresh user permissions (called when role changes)
   */
  static async refreshUserPermissions(userId) {
    try {
      // This would typically invalidate cached permissions
      // For now, we'll just return fresh permissions
      const user = await query(
        'SELECT is_superuser FROM users WHERE id = $1',
        [userId]
      );

      if (user.rows.length === 0) {
        throw new Error('User not found');
      }

      const isSuperuser = user.rows[0].is_superuser;

      if (isSuperuser) {
        return await this.getSuperuserPermissions();
      } else {
        return await this.getUserPermissions(userId);
      }
    } catch (error) {
      console.error('Error refreshing user permissions:', error);
      throw error;
    }
  }

  /**
   * Get available modules for a department
   */
  static async getDepartmentModules(departmentId) {
    try {
      const result = await query(`
        SELECT m.name, m.display_name, m.description, m.icon, m.color
        FROM modules m
        JOIN department_modules dm ON m.id = dm.module_id
        WHERE dm.department_id = $1 AND dm.is_active = true AND m.is_active = true
        ORDER BY m.module_order
      `, [departmentId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting department modules:', error);
      return [];
    }
  }

  /**
   * Check if user has module access
   */
  static async hasModuleAccess(userId, moduleName) {
    try {
      // Check if user is superuser
      const superuserCheck = await query(
        'SELECT is_superuser FROM users WHERE id = $1',
        [userId]
      );

      if (superuserCheck.rows.length > 0 && superuserCheck.rows[0].is_superuser) {
        return true;
      }

      // Check department-module access
      const result = await query(`
        SELECT 1
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        JOIN departments d ON r.department_id = d.id AND d.is_active = true
        JOIN department_modules dm ON d.id = dm.department_id AND dm.is_active = true
        JOIN modules m ON dm.module_id = m.id AND m.name = $2 AND m.is_active = true
        WHERE u.id = $1
      `, [userId, moduleName]);

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking module access:', error);
      return false;
    }
  }
}
