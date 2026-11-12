import { query, transaction } from '../../database/connection.js';

class DepartmentService {
  /**
   * Get all departments with module assignments
   */
  async getAllDepartments(userId) {
    try {
      const result = await query(`
        SELECT 
          d.id,
          d.name,
          d.display_name,
          d.description,
          d.is_active,
          d.department_code,
          d.parent_department_id,
          d.created_at,
          d.updated_at,
          pd.display_name as parent_department_name,
          creator.first_name || ' ' || creator.last_name as created_by_name,
          COALESCE(
            json_agg(
              CASE WHEN m.id IS NOT NULL THEN
                json_build_object(
                  'id', m.id,
                  'name', m.name,
                  'display_name', m.display_name,
                  'icon', m.icon,
                  'color', m.color,
                  'granted_at', dm.granted_at
                )
              END
            ) FILTER (WHERE m.id IS NOT NULL), 
            '[]'::json
          ) as modules,
          (SELECT COUNT(*) FROM users u 
           JOIN user_roles ur ON u.id = ur.user_id 
           JOIN roles r ON ur.role_id = r.id 
           WHERE r.department_id = d.id AND u.status = 'active' AND ur.is_active = true) as user_count
        FROM departments d
        LEFT JOIN departments pd ON d.parent_department_id = pd.id
        LEFT JOIN users creator ON d.created_by = creator.id
        LEFT JOIN department_modules dm ON d.id = dm.department_id AND dm.is_active = true
        LEFT JOIN modules m ON dm.module_id = m.id AND m.is_active = true
        WHERE d.is_active = true
        GROUP BY d.id, pd.display_name, creator.first_name, creator.last_name
        ORDER BY d.name
      `);

      // Log audit event
      await this.logAuditEvent(userId, 'data_accessed', 'department', null, null, null, 'GET', '/api/departments', 'Departments list viewed');

      return result.rows;
    } catch (error) {
      console.error('Error getting departments:', error);
      throw new Error(`Failed to get departments: ${error.message}`);
    }
  }

  /**
   * Get department by ID with full details
   */
  async getDepartmentById(departmentId, userId) {
    try {
      const result = await query(`
        SELECT 
          d.id,
          d.name,
          d.display_name,
          d.description,
          d.is_active,
          d.department_code,
          d.parent_department_id,
          d.created_at,
          d.updated_at,
          pd.display_name as parent_department_name,
          creator.first_name || ' ' || creator.last_name as created_by_name,
          COALESCE(
            json_agg(
              CASE WHEN m.id IS NOT NULL THEN
                json_build_object(
                  'id', m.id,
                  'name', m.name,
                  'display_name', m.display_name,
                  'icon', m.icon,
                  'color', m.color,
                  'granted_at', dm.granted_at
                )
              END
            ) FILTER (WHERE m.id IS NOT NULL), 
            '[]'::json
          ) as modules,
          (SELECT COUNT(*) FROM users u 
           JOIN user_roles ur ON u.id = ur.user_id 
           JOIN roles r ON ur.role_id = r.id 
           WHERE r.department_id = d.id AND u.status = 'active' AND ur.is_active = true) as user_count,
          (SELECT COUNT(*) FROM roles r WHERE r.department_id = d.id AND r.is_active = true) as role_count
        FROM departments d
        LEFT JOIN departments pd ON d.parent_department_id = pd.id
        LEFT JOIN users creator ON d.created_by = creator.id
        LEFT JOIN department_modules dm ON d.id = dm.department_id AND dm.is_active = true
        LEFT JOIN modules m ON dm.module_id = m.id AND m.is_active = true
        WHERE d.id = $1 AND d.is_active = true
        GROUP BY d.id, pd.display_name, creator.first_name, creator.last_name
      `, [departmentId]);

      if (result.rows.length === 0) {
        throw new Error('Department not found');
      }

      // Log audit event
      await this.logAuditEvent(userId, 'data_accessed', 'department', departmentId, null, null, 'GET', `/api/departments/${departmentId}`, 'Department details viewed');

      return result.rows[0];
    } catch (error) {
      console.error('Error getting department:', error);
      throw new Error(`Failed to get department: ${error.message}`);
    }
  }

  /**
   * Create new department
   */
  async createDepartment(departmentData, userId) {
    const { name, displayName, description, departmentCode, parentDepartmentId, moduleIds = [] } = departmentData;

    try {
      const result = await transaction(async (client) => {
        // Check if department name already exists
        const existingResult = await client.query(
          'SELECT id FROM departments WHERE name = $1 OR (department_code = $2 AND department_code IS NOT NULL)',
          [name.toLowerCase(), departmentCode]
        );

        if (existingResult.rows.length > 0) {
          throw new Error('Department name or code already exists');
        }

        // Create department
        const deptResult = await client.query(`
          INSERT INTO departments (
            name, display_name, description, department_code, 
            parent_department_id, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id, name, display_name, description, department_code, created_at
        `, [
          name.toLowerCase(),
          displayName,
          description,
          departmentCode,
          parentDepartmentId,
          userId,
          userId
        ]);

        const department = deptResult.rows[0];

        // Assign modules to department
        if (moduleIds.length > 0) {
          for (const moduleId of moduleIds) {
            await client.query(`
              INSERT INTO department_modules (department_id, module_id, granted_by)
              VALUES ($1, $2, $3)
            `, [department.id, moduleId, userId]);
          }
        }

        // Always assign user_management module to all departments
        const userMgmtResult = await client.query(
          'SELECT id FROM modules WHERE name = $1',
          ['user_management']
        );

        if (userMgmtResult.rows.length > 0 && !moduleIds.includes(userMgmtResult.rows[0].id)) {
          await client.query(`
            INSERT INTO department_modules (department_id, module_id, granted_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (department_id, module_id) DO NOTHING
          `, [department.id, userMgmtResult.rows[0].id, userId]);
        }

        // Create default role templates for the department
        await this.createDefaultRoleTemplates(client, department.id, userId);

        return department;
      });

      // Log audit event
      await this.logAuditEvent(userId, 'department_created', 'department', result.id, null, {
        name: result.name,
        display_name: result.display_name,
        department_code: result.department_code,
        modules_assigned: moduleIds.length
      }, 'POST', '/api/departments', 'Department created successfully');

      return result;
    } catch (error) {
      console.error('Error creating department:', error);
      throw new Error(`Failed to create department: ${error.message}`);
    }
  }

  /**
   * Update department
   */
  async updateDepartment(departmentId, departmentData, userId) {
    const { displayName, description, departmentCode, parentDepartmentId, isActive } = departmentData;

    try {
      // Get current department data for audit
      const currentResult = await query('SELECT * FROM departments WHERE id = $1', [departmentId]);
      if (currentResult.rows.length === 0) {
        throw new Error('Department not found');
      }

      const currentDepartment = currentResult.rows[0];

      // Update department
      const result = await query(`
        UPDATE departments 
        SET display_name = $1, description = $2, department_code = $3, 
            parent_department_id = $4, is_active = $5, updated_by = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING id, name, display_name, description, department_code, is_active, updated_at
      `, [
        displayName,
        description,
        departmentCode,
        parentDepartmentId,
        isActive !== undefined ? isActive : currentDepartment.is_active,
        userId,
        departmentId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Department not found');
      }

      // Log audit event
      await this.logAuditEvent(userId, 'department_updated', 'department', departmentId, 
        {
          display_name: currentDepartment.display_name,
          description: currentDepartment.description,
          department_code: currentDepartment.department_code,
          is_active: currentDepartment.is_active
        },
        {
          display_name: displayName,
          description: description,
          department_code: departmentCode,
          is_active: isActive !== undefined ? isActive : currentDepartment.is_active
        },
        'PUT', `/api/departments/${departmentId}`, 'Department updated successfully'
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating department:', error);
      throw new Error(`Failed to update department: ${error.message}`);
    }
  }

  /**
   * Assign modules to department
   */
  async assignModules(departmentId, moduleIds, userId) {
    try {
      const result = await transaction(async (client) => {
        // Remove existing module assignments
        await client.query(
          'DELETE FROM department_modules WHERE department_id = $1',
          [departmentId]
        );

        // Always include user_management module
        const userMgmtResult = await client.query(
          'SELECT id FROM modules WHERE name = $1',
          ['user_management']
        );

        const allModuleIds = [...new Set([...moduleIds, userMgmtResult.rows[0].id])];

        // Add new module assignments
        for (const moduleId of allModuleIds) {
          await client.query(`
            INSERT INTO department_modules (department_id, module_id, granted_by)
            VALUES ($1, $2, $3)
          `, [departmentId, moduleId, userId]);
        }

        // Update role permissions for existing roles in this department
        await this.updateDepartmentRolePermissions(client, departmentId);

        return allModuleIds;
      });

      // Log audit event
      await this.logAuditEvent(userId, 'module_assigned', 'department', departmentId, null, {
        modules_assigned: result.length,
        module_ids: result
      }, 'POST', `/api/departments/${departmentId}/modules`, 'Modules assigned to department');

      return result;
    } catch (error) {
      console.error('Error assigning modules:', error);
      throw new Error(`Failed to assign modules: ${error.message}`);
    }
  }

  /**
   * Get available modules for assignment
   */
  async getAvailableModules() {
    try {
      const result = await query(`
        SELECT id, name, display_name, description, icon, color, is_core
        FROM modules 
        WHERE is_active = true
        ORDER BY module_order, display_name
      `);

      return result.rows;
    } catch (error) {
      console.error('Error getting available modules:', error);
      throw new Error(`Failed to get available modules: ${error.message}`);
    }
  }

  /**
   * Create default role templates for a department
   */
  async createDefaultRoleTemplates(client, departmentId, userId) {
    const roleTemplates = [
      {
        name: 'department_head',
        displayName: 'Department Head',
        description: 'Full departmental access with approval authority',
        roleLevel: 2
      },
      {
        name: 'manager',
        displayName: 'Manager',
        description: 'Management access with limited approval authority',
        roleLevel: 3
      },
      {
        name: 'senior_user',
        displayName: 'Senior User',
        description: 'Advanced user access with some administrative functions',
        roleLevel: 4
      },
      {
        name: 'basic_user',
        displayName: 'Basic User',
        description: 'Standard user access with view and basic create permissions',
        roleLevel: 5
      }
    ];

    for (const template of roleTemplates) {
      // Create role
      const roleResult = await client.query(`
        INSERT INTO roles (
          name, display_name, description, department_id, 
          role_type, role_level, created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [
        template.name,
        template.displayName,
        template.description,
        departmentId,
        'template',
        template.roleLevel,
        userId,
        userId
      ]);

      const roleId = roleResult.rows[0].id;

      // Assign permissions based on role level
      await this.assignRolePermissions(client, roleId, departmentId, template.roleLevel);
    }
  }

  /**
   * Assign permissions to role based on department modules and role level
   */
  async assignRolePermissions(client, roleId, departmentId, roleLevel) {
    // Get department modules and their features
    const featuresResult = await client.query(`
      SELECT f.id, f.name, f.available_permissions, f.default_data_scope
      FROM features f
      JOIN modules m ON f.module_id = m.id
      JOIN department_modules dm ON m.id = dm.module_id
      WHERE dm.department_id = $1 AND dm.is_active = true AND f.is_active = true
    `, [departmentId]);

    for (const feature of featuresResult.rows) {
      let permissions = [];
      let dataScope = feature.default_data_scope;
      let canApprove = false;
      let canExport = false;
      let canBulkAction = false;

      // Define permissions based on role level with special handling for user management
      switch (roleLevel) {
        case 1: // Admin - Limited user management access, full access to everything else
          if (feature.name.startsWith('user_')) {
            // User management features - limited access for admin
            switch (feature.name) {
              case 'user_directory':
                permissions = ['read', 'update']; // Can activate/deactivate, suspend
                dataScope = 'all';
                canApprove = false;
                canExport = false;
                canBulkAction = false;
                break;
              case 'user_approval':
                permissions = ['read']; // Can view but appeals handled by superadmin
                dataScope = 'all';
                canApprove = false;
                canExport = false;
                canBulkAction = false;
                break;
              case 'department_management':
              case 'role_management':
              case 'user_assignment':
                permissions = ['read']; // View only access
                dataScope = 'all';
                canApprove = false;
                canExport = false;
                canBulkAction = false;
                break;
              default:
                permissions = feature.available_permissions;
                dataScope = 'all';
                canApprove = true;
                canExport = true;
                canBulkAction = true;
            }
          } else {
            // Non-user management features - full admin access
            permissions = feature.available_permissions;
            dataScope = 'all';
            canApprove = true;
            canExport = true;
            canBulkAction = true;
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
              default:
                permissions = feature.available_permissions;
                dataScope = 'department';
                canApprove = true;
                canExport = true;
                canBulkAction = true;
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
        
        case 3: // Manager - Limited user management access, no approval authority
          if (feature.name.startsWith('user_')) {
            // User management features - very limited access
            switch (feature.name) {
              case 'user_directory':
                permissions = ['read'];
                dataScope = 'department';
                canApprove = false;
                canExport = false;
                canBulkAction = false;
                break;
              case 'user_approval':
                // No access to approval dashboard for managers
                continue; // Skip this feature
              case 'department_management':
              case 'role_management':
              case 'user_assignment':
                // No access to these features for managers
                continue; // Skip this feature
              default:
                permissions = feature.available_permissions.filter(p => p !== 'delete');
                dataScope = 'department';
                canApprove = false; // Managers cannot approve
                canExport = true;
                canBulkAction = false;
            }
          } else {
            // Non-user management features - standard manager access
            permissions = feature.available_permissions.filter(p => p !== 'delete');
            dataScope = 'department';
            canApprove = false; // Managers cannot approve
            canExport = true;
            canBulkAction = false;
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
        
        case 5: // Basic User - No user management access
          if (feature.name.startsWith('user_')) {
            // No access to user management features
            continue; // Skip this feature
          } else {
            // Standard basic user access for other features
            permissions = ['read'].concat(
              feature.name === 'purchase_orders' || feature.name === 'stock_movements' 
                ? ['create'] : []
            ).filter(p => feature.available_permissions.includes(p));
            dataScope = 'own';
            canApprove = false;
            canExport = false;
            canBulkAction = false;
          }
          break;
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
   * Update role permissions when department modules change
   */
  async updateDepartmentRolePermissions(client, departmentId) {
    // Get all roles for this department
    const rolesResult = await client.query(`
      SELECT id, role_level, role_type 
      FROM roles 
      WHERE department_id = $1 AND is_active = true AND role_type = 'template'
    `, [departmentId]);

    for (const role of rolesResult.rows) {
      // Remove existing permissions
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id]);
      
      // Reassign permissions based on current modules
      await this.assignRolePermissions(client, role.id, departmentId, role.role_level);
    }
  }

  /**
   * Deactivate department (soft delete)
   */
  async deactivateDepartment(departmentId, userId) {
    try {
      // Check if department has active users
      const usersResult = await query(`
        SELECT COUNT(*) as user_count
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.department_id = $1 AND u.status = 'active' AND ur.is_active = true
      `, [departmentId]);

      if (parseInt(usersResult.rows[0].user_count) > 0) {
        throw new Error('Cannot deactivate department with active users. Please reassign users first.');
      }

      // Get current department data for audit
      const currentResult = await query('SELECT * FROM departments WHERE id = $1', [departmentId]);
      const currentDepartment = currentResult.rows[0];

      // Deactivate department
      const result = await query(`
        UPDATE departments 
        SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING id, name, display_name
      `, [userId, departmentId]);

      if (result.rows.length === 0) {
        throw new Error('Department not found');
      }

      // Deactivate all roles in this department
      await query(`
        UPDATE roles 
        SET is_active = false, updated_by = $1, updated_at = CURRENT_TIMESTAMP
        WHERE department_id = $2
      `, [userId, departmentId]);

      // Log audit event
      await this.logAuditEvent(userId, 'department_deleted', 'department', departmentId, 
        { is_active: currentDepartment.is_active },
        { is_active: false },
        'DELETE', `/api/departments/${departmentId}`, 'Department deactivated'
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error deactivating department:', error);
      throw new Error(`Failed to deactivate department: ${error.message}`);
    }
  }

  /**
   * Log audit event for department-related actions.
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
   * Get department statistics
   * @param {number} userId - The user requesting statistics
   * @returns {Object} Department statistics
   */
  async getDepartmentStatistics(userId) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT d.id) as total_departments,
          COUNT(DISTINCT CASE WHEN d.is_active = true THEN d.id END) as active_departments,
          COUNT(DISTINCT dm.module_id) as total_module_assignments,
          COUNT(DISTINCT ur.user_id) as total_assigned_users,
          AVG(user_counts.user_count)::numeric(10,2) as avg_users_per_department
        FROM departments d
        LEFT JOIN department_modules dm ON d.id = dm.department_id
        LEFT JOIN user_roles ur ON d.id = ur.department_id AND ur.is_active = true
        LEFT JOIN (
          SELECT 
            ur.department_id,
            COUNT(ur.user_id) as user_count
          FROM user_roles ur
          WHERE ur.is_active = true
          GROUP BY ur.department_id
        ) user_counts ON d.id = user_counts.department_id
        WHERE d.deleted_at IS NULL
      `;

      const result = await query(statsQuery);
      const stats = result.rows[0];

      // Get department breakdown by status
      const breakdownQuery = `
        SELECT 
          is_active,
          COUNT(*) as count
        FROM departments
        WHERE deleted_at IS NULL
        GROUP BY is_active
      `;

      const breakdownResult = await query(breakdownQuery);
      const breakdown = breakdownResult.rows.reduce((acc, row) => {
        acc[row.is_active ? 'active' : 'inactive'] = parseInt(row.count);
        return acc;
      }, { active: 0, inactive: 0 });

      return {
        overview: {
          total_departments: parseInt(stats.total_departments),
          active_departments: parseInt(stats.active_departments),
          total_module_assignments: parseInt(stats.total_module_assignments),
          total_assigned_users: parseInt(stats.total_assigned_users),
          avg_users_per_department: parseFloat(stats.avg_users_per_department) || 0
        },
        breakdown,
        generated_at: new Date().toISOString(),
        generated_by: userId
      };
    } catch (error) {
      console.error('Error getting department statistics:', error);
      throw new Error(`Failed to get department statistics: ${error.message}`);
    }
  }
}

export default new DepartmentService();
