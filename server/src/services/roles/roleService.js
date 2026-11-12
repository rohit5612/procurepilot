import { query, transaction } from '../../database/connection.js';
import {
  isProcurePilotFeature,
  procurePilotFeaturePairSql,
  sortModulesForDisplay,
  ROLE_LEVELS
} from '../../config/procurePilotAccess.js';

const FEATURE_CATALOG_SQL = procurePilotFeaturePairSql('m', 'f');

class RoleService {
  /**
   * Get all roles with department and permission details
   */
  async getAllRoles(userId, departmentId = null) {
    try {
      let whereClause = 'WHERE r.is_active = true';
      let params = [];

      // If user is not superuser, filter by their department
      if (!await this.isSuperuser(userId)) {
        const userDept = await this.getUserDepartment(userId);
        whereClause += ' AND r.department_id = $1';
        params.push(userDept);
      } else if (departmentId) {
        whereClause += ' AND r.department_id = $1';
        params.push(departmentId);
      }

      const result = await query(`
        SELECT 
          r.id,
          r.name,
          r.display_name,
          r.description,
          r.role_type,
          r.role_level,
          r.is_active,
          r.is_default,
          r.created_at,
          r.updated_at,
          d.id as department_id,
          d.display_name as department_name,
          creator.first_name || ' ' || creator.last_name as created_by_name,
          (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id AND ur.is_active = true) as user_count,
          COALESCE(
            json_agg(
              CASE WHEN f.id IS NOT NULL AND ${FEATURE_CATALOG_SQL} THEN
                json_build_object(
                  'feature_id', f.id,
                  'feature_name', f.name,
                  'feature_display_name', f.display_name,
                  'module_name', m.name,
                  'permissions', rp.permissions,
                  'data_scope', rp.data_scope,
                  'can_approve', rp.can_approve,
                  'can_export', rp.can_export,
                  'can_bulk_action', rp.can_bulk_action
                )
              END
            ) FILTER (WHERE f.id IS NOT NULL AND ${FEATURE_CATALOG_SQL}), 
            '[]'::json
          ) as permissions
        FROM roles r
        JOIN departments d ON r.department_id = d.id
        LEFT JOIN users creator ON r.created_by = creator.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN features f ON rp.feature_id = f.id AND f.is_active = true
        LEFT JOIN modules m ON f.module_id = m.id AND m.is_active = true
        ${whereClause}
        GROUP BY r.id, d.id, d.display_name, creator.first_name, creator.last_name
        ORDER BY d.display_name, r.role_level, r.name
      `, params);

      // Log audit event (temporarily disabled due to partition issues)
      // await this.logAuditEvent(userId, 'data_accessed', 'role', null, null, null, 'GET', '/api/roles', 'Roles list viewed');

      return result.rows;
    } catch (error) {
      console.error('Error getting roles:', error);
      throw new Error(`Failed to get roles: ${error.message}`);
    }
  }

  /**
   * Get role by ID with full details
   */
  async getRoleById(roleId, userId) {
    try {
      const result = await query(`
        SELECT 
          r.id,
          r.name,
          r.display_name,
          r.description,
          r.role_type,
          r.role_level,
          r.is_active,
          r.is_default,
          r.created_at,
          r.updated_at,
          d.id as department_id,
          d.display_name as department_name,
          creator.first_name || ' ' || creator.last_name as created_by_name,
          (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id AND ur.is_active = true) as user_count,
          COALESCE(
            json_agg(
              CASE WHEN f.id IS NOT NULL AND ${FEATURE_CATALOG_SQL} THEN
                json_build_object(
                  'feature_id', f.id,
                  'feature_name', f.name,
                  'feature_display_name', f.display_name,
                  'module_name', m.name,
                  'module_display_name', m.display_name,
                  'permissions', rp.permissions,
                  'data_scope', rp.data_scope,
                  'can_approve', rp.can_approve,
                  'can_export', rp.can_export,
                  'can_bulk_action', rp.can_bulk_action
                )
              END
            ) FILTER (WHERE f.id IS NOT NULL AND ${FEATURE_CATALOG_SQL}), 
            '[]'::json
          ) as permissions
        FROM roles r
        JOIN departments d ON r.department_id = d.id
        LEFT JOIN users creator ON r.created_by = creator.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN features f ON rp.feature_id = f.id AND f.is_active = true
        LEFT JOIN modules m ON f.module_id = m.id AND m.is_active = true
        WHERE r.id = $1 AND r.is_active = true
        GROUP BY r.id, d.id, d.display_name, creator.first_name, creator.last_name
      `, [roleId]);

      if (result.rows.length === 0) {
        throw new Error('Role not found');
      }

      // Check if user has access to this role
      if (!await this.isSuperuser(userId)) {
        const userDept = await this.getUserDepartment(userId);
        if (result.rows[0].department_id !== userDept) {
          throw new Error('Access denied to this role');
        }
      }

      // Log audit event
      await this.logAuditEvent(userId, 'data_accessed', 'role', roleId, null, null, 'GET', `/api/roles/${roleId}`, 'Role details viewed');

      return result.rows[0];
    } catch (error) {
      console.error('Error getting role:', error);
      throw new Error(`Failed to get role: ${error.message}`);
    }
  }

  /**
   * Create new custom role
   */
  async createRole(roleData, userId) {
    const { name, displayName, description, departmentId, roleLevel, permissions = [] } = roleData;

    try {
      const result = await transaction(async (client) => {
        // Check if role name already exists in department
        const existingResult = await client.query(
          'SELECT id FROM roles WHERE name = $1 AND department_id = $2',
          [name.toLowerCase(), departmentId]
        );

        if (existingResult.rows.length > 0) {
          throw new Error('Role name already exists in this department');
        }

        // Check if user has access to this department
        if (!await this.isSuperuser(userId)) {
          const userDept = await this.getUserDepartment(userId);
          if (departmentId !== userDept) {
            throw new Error('Access denied to this department');
          }
        }

        // Create role
        const roleResult = await client.query(`
          INSERT INTO roles (
            name, display_name, description, department_id, 
            role_type, role_level, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id, name, display_name, description, role_type, role_level, created_at
        `, [
          name.toLowerCase(),
          displayName,
          description,
          departmentId,
          'custom',
          roleLevel || 3, // Default to level 3 if not specified
          userId,
          userId
        ]);

        const role = roleResult.rows[0];

        // Assign permissions based on role level (similar to template roles)
        await this.assignRolePermissionsByLevel(client, role.id, departmentId, role.role_level);

        return role;
      });

      // Log audit event
      await this.logAuditEvent(userId, 'role_created', 'role', result.id, null, {
        name: result.name,
        display_name: result.display_name,
        department_id: departmentId,
        permissions_count: permissions.length
      }, 'POST', '/api/roles', 'Custom role created successfully');

      return result;
    } catch (error) {
      console.error('Error creating role:', error);
      throw new Error(`Failed to create role: ${error.message}`);
    }
  }

  /**
   * Update role
   */
  async updateRole(roleId, roleData, userId) {
    const { displayName, description, roleLevel, isActive, permissions } = roleData;

    try {
      // Get current role data for audit logging
      const currentRoleResult = await query('SELECT * FROM roles WHERE id = $1', [roleId]);
      if (currentRoleResult.rows.length === 0) {
        throw new Error('Role not found');
      }
      const currentRole = currentRoleResult.rows[0];

      const result = await transaction(async (client) => {
        // Check if user has access to this role
        if (!await this.isSuperuser(userId)) {
          const userDept = await this.getUserDepartment(userId);
          if (currentRole.department_id !== userDept) {
            throw new Error('Access denied to this role');
          }
        }

        // Template roles cannot be deleted or fully deactivated
        if (currentRole.role_type === 'template' && isActive === false) {
          throw new Error('Template roles cannot be deactivated');
        }

        // Update role
        const roleResult = await client.query(`
          UPDATE roles 
          SET display_name = $1, description = $2, role_level = $3, is_active = $4, 
              updated_by = $5, updated_at = CURRENT_TIMESTAMP
          WHERE id = $6
          RETURNING id, name, display_name, description, role_type, role_level, is_active, updated_at
        `, [
          displayName || currentRole.display_name,
          description !== undefined ? description : currentRole.description,
          roleLevel !== undefined ? roleLevel : currentRole.role_level,
          isActive !== undefined ? isActive : currentRole.is_active,
          userId,
          roleId
        ]);

        const updatedRole = roleResult.rows[0];

        // If role level changed and it's a custom role, update permissions
        if (roleLevel !== undefined && roleLevel !== currentRole.role_level && currentRole.role_type === 'custom') {
          // Remove existing permissions
          await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
          
          // Reassign permissions based on new role level
          await this.assignRolePermissionsByLevel(client, roleId, currentRole.department_id, roleLevel);
        }
        // Update permissions if provided
        else if (permissions && currentRole.role_type === 'custom') {
          // Remove existing permissions
          await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
          
          // Add new permissions
          if (permissions.length > 0) {
            await this.assignRolePermissions(client, roleId, permissions);
          }
        }

        return updatedRole;
      });

      // Log audit event
      await this.logAuditEvent(userId, 'role_updated', 'role', roleId, 
        {
          display_name: currentRole.display_name,
          description: currentRole.description,
          is_active: currentRole.is_active
        },
        {
          display_name: displayName,
          description: description,
          is_active: isActive
        },
        'PUT', `/api/roles/${roleId}`, 'Role updated successfully'
      );

      return result;
    } catch (error) {
      console.error('Error updating role:', error);
      throw new Error(`Failed to update role: ${error.message}`);
    }
  }

  /**
   * Get available features for role permission assignment
   */
  async getAvailableFeatures(departmentId) {
    try {
      const result = await query(`
        SELECT 
          f.id,
          f.name,
          f.display_name,
          f.description,
          f.available_permissions,
          f.available_data_scopes,
          f.default_permissions,
          f.default_data_scope,
          m.id as module_id,
          m.name as module_name,
          m.display_name as module_display_name,
          m.icon as module_icon,
          m.color as module_color
        FROM features f
        JOIN modules m ON f.module_id = m.id
        JOIN department_modules dm ON m.id = dm.module_id
        WHERE dm.department_id = $1 AND dm.is_active = true 
        AND f.is_active = true AND m.is_active = true
        AND ${FEATURE_CATALOG_SQL}
        ORDER BY m.module_order, f.feature_order
      `, [departmentId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting available features:', error);
      throw new Error(`Failed to get available features: ${error.message}`);
    }
  }

  /**
   * Assign permissions to role
   */
  async assignRolePermissions(client, roleId, permissions) {
    for (const permission of permissions) {
      const {
        featureId,
        permissions: featurePermissions = [],
        dataScope = 'department',
        canApprove = false,
        canExport = false,
        canBulkAction = false
      } = permission;

      const featCheck = await client.query(
        `SELECT m.name AS module_name, f.name AS feature_name
         FROM features f
         JOIN modules m ON m.id = f.module_id
         WHERE f.id = $1 AND f.is_active = true AND m.is_active = true`,
        [featureId]
      );
      if (featCheck.rows.length === 0) continue;
      const { module_name, feature_name } = featCheck.rows[0];
      if (!isProcurePilotFeature(module_name, feature_name)) continue;

      await client.query(`
        INSERT INTO role_permissions (
          role_id, feature_id, permissions, data_scope,
          can_approve, can_export, can_bulk_action
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        roleId,
        featureId,
        JSON.stringify(featurePermissions),
        dataScope,
        canApprove,
        canExport,
        canBulkAction
      ]);
    }
  }

  /**
   * Assign permissions to role based on department modules and role level
   */
  async assignRolePermissionsByLevel(client, roleId, departmentId, roleLevel) {
    // Get department modules and their features
    const featuresResult = await client.query(`
      SELECT f.id, f.name, f.available_permissions, f.default_data_scope, m.name AS module_name
      FROM features f
      JOIN modules m ON f.module_id = m.id
      JOIN department_modules dm ON m.id = dm.module_id
      WHERE dm.department_id = $1 AND dm.is_active = true AND f.is_active = true
      AND ${FEATURE_CATALOG_SQL}
    `, [departmentId]);

    for (const feature of featuresResult.rows) {
      if (!isProcurePilotFeature(feature.module_name, feature.name)) {
        continue;
      }
      let permissions = [];
      let dataScope = feature.default_data_scope;
      let canApprove = false;
      let canExport = false;
      let canBulkAction = false;

      // Define permissions based on role level with special handling for user management
      switch (roleLevel) {
        case 1: // L1 org admin — policy, users/roles, oversight (superuser maps here in UI)
          if (feature.module_name === 'user_management') {
            switch (feature.name) {
              case 'user_directory':
                permissions = ['read', 'update', 'export'].filter((p) =>
                  feature.available_permissions.includes(p)
                );
                dataScope = 'all';
                canExport = true;
                break;
              case 'user_approval':
                permissions = ['read', 'approve', 'export'].filter((p) =>
                  feature.available_permissions.includes(p)
                );
                dataScope = 'all';
                canApprove = true;
                canExport = true;
                canBulkAction = true;
                break;
              case 'department_management':
              case 'role_management':
              case 'user_assignment':
                permissions = ['read', 'update'].filter((p) => feature.available_permissions.includes(p));
                dataScope = 'all';
                canExport = true;
                break;
              case 'archived_users':
                permissions = ['read', 'update'].filter((p) => feature.available_permissions.includes(p));
                dataScope = 'all';
                break;
              case 'appeals':
                permissions = ['read', 'approve', 'update'].filter((p) =>
                  feature.available_permissions.includes(p)
                );
                dataScope = 'all';
                canApprove = true;
                break;
              default:
                permissions = ['read'].filter((p) => feature.available_permissions.includes(p));
                dataScope = 'all';
            }
          } else if (feature.module_name === 'procurepilot') {
            if (feature.name === 'policy_admin') {
              permissions = feature.available_permissions.filter((p) =>
                ['read', 'create', 'update', 'delete'].includes(p)
              );
            } else {
              permissions = feature.available_permissions.filter((p) =>
                ['read', 'create', 'submit'].includes(p)
              );
            }
            dataScope = 'all';
            canExport = true;
          } else if (feature.module_name === 'procurement') {
            permissions = ['read', 'approve', 'export'].filter((p) =>
              feature.available_permissions.includes(p)
            );
            dataScope = 'all';
            canApprove = true;
            canExport = true;
          } else if (feature.module_name === 'inventory') {
            permissions = ['read', 'update'].filter((p) => feature.available_permissions.includes(p));
            dataScope = 'all';
          } else {
            permissions = ['read'].filter((p) => feature.available_permissions.includes(p));
            dataScope = 'all';
          }
          break;
        
        case 2: // Department Head - Full department access including approval dashboard
          if (feature.name.startsWith('user_')) {
            // User management features - department head has approval authority
            switch (feature.name) {
              case 'user_directory':
                permissions = ['read', 'update'];
                dataScope = 'department'; // Only their department
                canApprove = false;
                canExport = true;
                canBulkAction = false;
                break;
              case 'user_approval':
                permissions = ['read', 'approve']; // Can view and approve users
                dataScope = 'department'; // Only their department users
                canApprove = true;
                canExport = true;
                canBulkAction = true;
                break;
              case 'department_management':
              case 'role_management':
              case 'user_assignment':
                // No access to these features for dept heads
                continue; // Skip this feature
              case 'archived_users':
                permissions = ['read'];
                dataScope = 'department';
                break;
              case 'appeals':
                permissions = ['read', 'approve'];
                dataScope = 'department';
                canApprove = true;
                break;
              default:
                permissions = feature.available_permissions;
                dataScope = 'department';
                canApprove = true;
                canExport = true;
                canBulkAction = true;
            }
          } else if (feature.module_name === 'procurepilot') {
            if (feature.name === 'policy_admin') {
              permissions = ['read'];
              dataScope = 'department';
            } else {
              permissions = feature.available_permissions.filter((p) => ['read', 'create', 'submit'].includes(p));
              dataScope = 'department';
            }
          } else {
            // Non-user management features - full department access
            permissions = feature.available_permissions;
            dataScope = 'department';
            canApprove = true;
            canExport = true;
            canBulkAction = true;
          }
          break;
        
        case 3: // Manager — create/submit within L3 policy caps; no approvals or admin screens
          if (feature.module_name === 'user_management') {
            if (feature.name === 'user_directory') {
              permissions = ['read'];
              dataScope = 'department';
            } else {
              continue;
            }
          } else if (feature.module_name === 'procurepilot') {
            if (feature.name === 'policy_admin') {
              permissions = ['read'];
              dataScope = 'department';
            } else {
              permissions = feature.available_permissions.filter((p) =>
                ['read', 'create', 'submit'].includes(p)
              );
              dataScope = 'department';
            }
          } else if (feature.module_name === 'procurement') {
            permissions = ['read', 'create', 'update', 'submit'].filter((p) =>
              feature.available_permissions.includes(p)
            );
            dataScope = 'department';
            canExport = true;
          } else if (feature.module_name === 'inventory') {
            permissions = ['read'].filter((p) => feature.available_permissions.includes(p));
            dataScope = 'department';
          } else {
            continue;
          }
          break;
        
        case 4: // Senior User - No user management access
          if (feature.name.startsWith('user_')) {
            // No access to user management features
            continue; // Skip this feature
          } else {
            // Standard senior user access for other features
            permissions = ['create', 'read', 'update'].filter(p => 
              feature.available_permissions.includes(p)
            );
            dataScope = feature.name.includes('management') ? 'department' : 'own';
            canApprove = false;
            canExport = feature.name.includes('reports');
            canBulkAction = false;
          }
          break;
        
        case 5: // L5 — observer only: no modules, gated UI + API deny create/approve
          continue;
      }

      // Insert role permission
      await client.query(`
        INSERT INTO role_permissions (
          role_id, feature_id, permissions, data_scope,
          can_approve, can_export, can_bulk_action
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        roleId,
        feature.id,
        JSON.stringify(permissions),
        dataScope,
        canApprove,
        canExport,
        canBulkAction
      ]);
    }
  }

  /**
   * Duplicate role (create copy)
   */
  async duplicateRole(roleId, newRoleData, userId) {
    const { name, displayName, description } = newRoleData;

    try {
      const result = await transaction(async (client) => {
        // Get original role with permissions (call external query since we're in transaction)
        const originalRoleResult = await client.query(`
          SELECT 
            r.id, r.name, r.display_name, r.description, r.department_id,
            COALESCE(
              json_agg(
                CASE WHEN f.id IS NOT NULL THEN
                  json_build_object(
                    'feature_id', f.id,
                    'permissions', rp.permissions,
                    'data_scope', rp.data_scope,
                    'can_approve', rp.can_approve,
                    'can_export', rp.can_export,
                    'can_bulk_action', rp.can_bulk_action
                  )
                END
              ) FILTER (WHERE f.id IS NOT NULL), 
              '[]'::json
            ) as permissions
          FROM roles r
          LEFT JOIN role_permissions rp ON r.id = rp.role_id
          LEFT JOIN features f ON rp.feature_id = f.id
          WHERE r.id = $1
          GROUP BY r.id
        `, [roleId]);

        if (originalRoleResult.rows.length === 0) {
          throw new Error('Original role not found');
        }

        const originalRole = originalRoleResult.rows[0];
        
        // Check if new role name already exists
        const existingResult = await client.query(
          'SELECT id FROM roles WHERE name = $1 AND department_id = $2',
          [name.toLowerCase(), originalRole.department_id]
        );

        if (existingResult.rows.length > 0) {
          throw new Error('Role name already exists in this department');
        }

        // Create new role
        const roleResult = await client.query(`
          INSERT INTO roles (
            name, display_name, description, department_id, 
            role_type, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, name, display_name, description, role_type, created_at
        `, [
          name.toLowerCase(),
          displayName,
          description,
          originalRole.department_id,
          'custom',
          userId,
          userId
        ]);

        const newRole = roleResult.rows[0];

        // Copy permissions from original role
        const permissions = originalRole.permissions.map(p => ({
          featureId: p.feature_id,
          permissions: p.permissions,
          dataScope: p.data_scope,
          canApprove: p.can_approve,
          canExport: p.can_export,
          canBulkAction: p.can_bulk_action
        }));

        if (permissions.length > 0) {
          await this.assignRolePermissions(client, newRole.id, permissions);
        }

        return newRole;
      });

      // Log audit event
      await this.logAuditEvent(userId, 'role_created', 'role', result.id, null, {
        name: result.name,
        display_name: result.display_name,
        duplicated_from: roleId,
        permissions_copied: originalRole.permissions.length
      }, 'POST', `/api/roles/${roleId}/duplicate`, 'Role duplicated successfully');

      return result;
    } catch (error) {
      console.error('Error duplicating role:', error);
      throw new Error(`Failed to duplicate role: ${error.message}`);
    }
  }

  /**
   * Get roles by department
   */
  async getRolesByDepartment(departmentId, userId) {
    try {
      // Check if user has access to this department
      if (!await this.isSuperuser(userId)) {
        const userDept = await this.getUserDepartment(userId);
        if (departmentId !== userDept) {
          throw new Error('Access denied to this department');
        }
      }

      const result = await query(`
        SELECT 
          r.id,
          r.name,
          r.display_name,
          r.description,
          r.role_type,
          r.role_level,
          r.is_active,
          r.is_default,
          (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id AND ur.is_active = true) as user_count
        FROM roles r
        WHERE r.department_id = $1 AND r.is_active = true
        ORDER BY r.role_level, r.name
      `, [departmentId]);

      // Log audit event
      await this.logAuditEvent(userId, 'data_accessed', 'role', null, null, null, 'GET', `/api/roles/department/${departmentId}`, 'Department roles viewed');

      return result.rows;
    } catch (error) {
      console.error('Error getting department roles:', error);
      throw new Error(`Failed to get department roles: ${error.message}`);
    }
  }

  /**
   * Set default role for department
   */
  async setDefaultRole(roleId, userId) {
    try {
      const result = await transaction(async (client) => {
        // Get role details
        const roleResult = await client.query('SELECT department_id FROM roles WHERE id = $1', [roleId]);
        if (roleResult.rows.length === 0) {
          throw new Error('Role not found');
        }

        const departmentId = roleResult.rows[0].department_id;

        // Check if user has access to this department
        if (!await this.isSuperuser(userId)) {
          const userDept = await this.getUserDepartment(userId);
          if (departmentId !== userDept) {
            throw new Error('Access denied to this department');
          }
        }

        // Remove default flag from all roles in department
        await client.query(`
          UPDATE roles 
          SET is_default = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
          WHERE department_id = $2
        `, [userId, departmentId]);

        // Set new default role
        await client.query(`
          UPDATE roles 
          SET is_default = true, updated_by = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [userId, roleId]);

        return { roleId, departmentId };
      });

      // Log audit event
      await this.logAuditEvent(userId, 'role_updated', 'role', roleId, null, {
        is_default: true,
        department_id: result.departmentId
      }, 'PUT', `/api/roles/${roleId}/default`, 'Default role updated');

      return result;
    } catch (error) {
      console.error('Error setting default role:', error);
      throw new Error(`Failed to set default role: ${error.message}`);
    }
  }

  /**
   * Delete role (soft delete for custom roles)
   */
  async deleteRole(roleId, userId) {
    try {
      const result = await transaction(async (client) => {
        // Get role details
        const roleResult = await client.query('SELECT * FROM roles WHERE id = $1', [roleId]);
        if (roleResult.rows.length === 0) {
          throw new Error('Role not found');
        }

        const role = roleResult.rows[0];

        // Check if user has access to this role
        if (!await this.isSuperuser(userId)) {
          const userDept = await this.getUserDepartment(userId);
          if (role.department_id !== userDept) {
            throw new Error('Access denied to this role');
          }
        }

        // Template roles cannot be deleted
        if (role.role_type === 'template') {
          throw new Error('Template roles cannot be deleted');
        }

        // Check if role has active users
        const usersResult = await client.query(`
          SELECT COUNT(*) as user_count
          FROM user_roles ur
          JOIN users u ON ur.user_id = u.id
          WHERE ur.role_id = $1 AND ur.is_active = true AND u.status = 'active'
        `, [roleId]);

        if (parseInt(usersResult.rows[0].user_count) > 0) {
          throw new Error('Cannot delete role with active users. Please reassign users first.');
        }

        // Soft delete role
        await client.query(`
          UPDATE roles 
          SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [userId, roleId]);

        return role;
      });

      // Log audit event
      await this.logAuditEvent(userId, 'role_deleted', 'role', roleId, 
        { is_active: result.is_active },
        { is_active: false },
        'DELETE', `/api/roles/${roleId}`, 'Role deleted successfully'
      );

      return result;
    } catch (error) {
      console.error('Error deleting role:', error);
      throw new Error(`Failed to delete role: ${error.message}`);
    }
  }

  /**
   * Helper: Check if user is superuser
   */
  async isSuperuser(userId) {
    const result = await query('SELECT is_superuser FROM users WHERE id = $1', [userId]);
    return result.rows.length > 0 && result.rows[0].is_superuser;
  }

  /**
   * Helper: Get user's department
   */
  async getUserDepartment(userId) {
    const result = await query(`
      SELECT r.department_id
      FROM users u
      JOIN user_roles ur ON u.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE u.id = $1 AND ur.is_active = true
    `, [userId]);

    if (result.rows.length === 0) {
      throw new Error('User has no department assignment');
    }

    return result.rows[0].department_id;
  }

  /**
   * Log audit event for role-related actions.
   * Uses the central auditLogWriter helper to avoid partition/function issues.
   */
  async logAuditEvent(
    userId,
    action,
    resourceType,
    resourceId,
    oldValues,
    newValues,
    requestMethod,
    requestPath,
    description,
    success = true,
    errorMessage = null
  ) {
    try {
      const { writeAuditLog } = await import('../system/auditLogWriter.js');
      await writeAuditLog({
        userId: userId || null,
        action,
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        oldValues: oldValues || null,
        newValues: newValues || null,
        ipAddress: null,
        userAgent: null,
        requestMethod: requestMethod || null,
        requestPath: requestPath || null,
        requestQuery: null,
        description: description || null,
        success,
        errorMessage: errorMessage || null,
        metadata: null
      });
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error for audit logging failures
    }
  }

  /**
   * Get role statistics
   * @param {number} userId - The user requesting statistics
   * @returns {Object} Role statistics
   */
  async getRoleStatistics(userId) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT r.id) as total_roles,
          COUNT(DISTINCT CASE WHEN r.is_active = true THEN r.id END) as active_roles,
          COUNT(DISTINCT CASE WHEN r.role_type = 'template' THEN r.id END) as template_roles,
          COUNT(DISTINCT CASE WHEN r.role_type = 'custom' THEN r.id END) as custom_roles,
          COUNT(DISTINCT ur.user_id) as total_assigned_users,
          AVG(user_counts.user_count)::numeric(10,2) as avg_users_per_role
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
        LEFT JOIN (
          SELECT 
            ur.role_id,
            COUNT(ur.user_id) as user_count
          FROM user_roles ur
          WHERE ur.is_active = true
          GROUP BY ur.role_id
        ) user_counts ON r.id = user_counts.role_id
        WHERE r.deleted_at IS NULL
      `;

      const result = await query(statsQuery);
      const stats = result.rows[0];

      // Get role breakdown by type and level
      const breakdownQuery = `
        SELECT 
          role_type,
          role_level,
          COUNT(*) as count
        FROM roles
        WHERE deleted_at IS NULL AND is_active = true
        GROUP BY role_type, role_level
        ORDER BY role_level
      `;

      const breakdownResult = await query(breakdownQuery);
      const breakdown = {
        by_type: {},
        by_level: {}
      };

      breakdownResult.rows.forEach(row => {
        // By type
        if (!breakdown.by_type[row.role_type]) {
          breakdown.by_type[row.role_type] = 0;
        }
        breakdown.by_type[row.role_type] += parseInt(row.count);

        // By level
        if (row.role_level) {
          breakdown.by_level[`level_${row.role_level}`] = parseInt(row.count);
        }
      });

      return {
        overview: {
          total_roles: parseInt(stats.total_roles),
          active_roles: parseInt(stats.active_roles),
          template_roles: parseInt(stats.template_roles),
          custom_roles: parseInt(stats.custom_roles),
          total_assigned_users: parseInt(stats.total_assigned_users),
          avg_users_per_role: parseFloat(stats.avg_users_per_role) || 0
        },
        breakdown,
        generated_at: new Date().toISOString(),
        generated_by: userId
      };
    } catch (error) {
      console.error('Error getting role statistics:', error);
      throw new Error(`Failed to get role statistics: ${error.message}`);
    }
  }

  /**
   * Get available permissions for role creation
   * @returns {Object} Available permissions grouped by module and feature
   */
  async getAvailablePermissions() {
    try {
      const permissionsQuery = `
        SELECT 
          m.id as module_id,
          m.name as module_name,
          m.display_name as module_display_name,
          f.id as feature_id,
          f.name as feature_name,
          f.display_name as feature_display_name,
          f.available_permissions
        FROM modules m
        JOIN features f ON m.id = f.module_id
        WHERE m.is_active = true AND f.is_active = true
        AND ${FEATURE_CATALOG_SQL}
        ORDER BY m.module_order, f.feature_order
      `;

      const result = await query(permissionsQuery);
      
      // Group permissions by module
      const modules = {};
      
      result.rows.forEach(row => {
        if (!modules[row.module_name]) {
          modules[row.module_name] = {
            id: row.module_id,
            name: row.module_name,
            display_name: row.module_display_name,
            features: {}
          };
        }

        modules[row.module_name].features[row.feature_name] = {
          id: row.feature_id,
          name: row.feature_name,
          display_name: row.feature_display_name,
          available_permissions: row.available_permissions
        };
      });

      return {
        modules: sortModulesForDisplay(modules),
        permission_types: [
          'create', 'read', 'update', 'delete',
          'submit', 'approve', 'export', 'bulk_action'
        ],
        data_scopes: ['own', 'department', 'all'],
        role_levels: ROLE_LEVELS,
        catalog: 'procurepilot-v1'
      };
    } catch (error) {
      console.error('Error getting available permissions:', error);
      throw new Error(`Failed to get available permissions: ${error.message}`);
    }
  }
}

export default new RoleService();
