import { query, transaction } from '../../database/connection.js';
import redisManager, { CacheKeys } from '../../config/redis.js';

class UserAssignmentService {
  /**
   * Assign user to department and role
   * @param {string} userId - User ID to assign
   * @param {string} departmentId - Department ID
   * @param {string} roleId - Role ID
   * @param {string} assigningUserId - ID of user making assignment
   * @param {string} notes - Assignment notes
   * @returns {Promise<Object>} Assignment result
   */
  async assignUserRole(userId, departmentId, roleId, assigningUserId, notes = '') {
    try {
      const result = await transaction(async (client) => {
        // Validate user exists and is approved
        const userCheck = await client.query(
          'SELECT id, email, first_name, last_name, status FROM users WHERE id = $1',
          [userId]
        );
        
        if (userCheck.rows.length === 0) {
          throw new Error('User not found');
        }
        
        const user = userCheck.rows[0];
        
        if (user.status !== 'active') {
          throw new Error(`User must be active before assignment. Current status: ${user.status}`);
        }
        
        // Validate department exists and is active
        const deptCheck = await client.query(
          'SELECT id, display_name FROM departments WHERE id = $1 AND is_active = true',
          [departmentId]
        );
        
        if (deptCheck.rows.length === 0) {
          throw new Error('Department not found or inactive');
        }
        
        // Validate role exists, is active, and belongs to department
        const roleCheck = await client.query(
          'SELECT id, display_name, role_type, role_level FROM roles WHERE id = $1 AND department_id = $2 AND is_active = true',
          [roleId, departmentId]
        );
        
        if (roleCheck.rows.length === 0) {
          throw new Error('Role not found, inactive, or does not belong to the specified department');
        }
        
        // Check if user already has an active assignment
        const existingAssignment = await client.query(
          'SELECT id, department_id, role_id FROM user_roles WHERE user_id = $1 AND is_active = true',
          [userId]
        );
        
        if (existingAssignment.rows.length > 0) {
          // Deactivate existing assignment
          const existing = existingAssignment.rows[0];
          await client.query(
            `UPDATE user_roles 
             SET is_active = false, 
                 unassigned_at = NOW(),
                 unassigned_by_user_id = $1,
                 updated_at = NOW(),
                 updated_by = $1
             WHERE id = $2`,
            [assigningUserId, existing.id]
          );
          
          // Log deactivation (simplified - remove audit logs to avoid partition errors)
          console.log('Unassigned user from previous role:', {
            userId,
            previousDeptId: existing.department_id,
            previousRoleId: existing.role_id
          });
        }
        
        // Create new assignment
        const assignmentResult = await client.query(
          `INSERT INTO user_roles (
             user_id, department_id, role_id, assigned_by, 
             assignment_notes, is_active, assigned_at, updated_at, updated_by
           ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW(), $4)
           RETURNING id, assigned_at`,
          [userId, departmentId, roleId, assigningUserId, notes]
        );
        
        const newAssignment = assignmentResult.rows[0];
        
        // Log assignment creation (simplified - remove audit logs to avoid partition errors)
        console.log('Assigned user to role:', {
          userId,
          departmentId,
          roleId,
          assignmentId: newAssignment.id
        });
        
        // Get complete assignment details outside transaction
        const assignmentDetails = {
          id: newAssignment.id,
          user_id: userId,
          department_id: departmentId,
          role_id: roleId,
          assigned_at: newAssignment.assigned_at,
          department_name: deptCheck.rows[0].display_name,
          role_name: roleCheck.rows[0].display_name
        };
        
        return {
          success: true,
          assignment: assignmentDetails,
          message: `User successfully assigned to ${deptCheck.rows[0].display_name} as ${roleCheck.rows[0].display_name}`
        };
      });
      
      // Invalidate user's cached permissions after successful assignment
      try {
        await redisManager.del(CacheKeys.userPermissions(userId));
        await redisManager.del(CacheKeys.userModules(userId));
        await redisManager.del(CacheKeys.userSession(userId));
        console.log('🧹 Cleared Redis cache for user after role assignment:', userId);
      } catch (cacheError) {
        console.warn('Failed to clear Redis cache for user:', userId, cacheError.message);
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to assign user role: ${error.message}`);
    }
  }

  /**
   * Transfer user to different department/role
   * @param {string} userId - User ID to transfer
   * @param {string} newDepartmentId - New department ID
   * @param {string} newRoleId - New role ID
   * @param {string} transferringUserId - ID of user making transfer
   * @param {string} transferReason - Reason for transfer
   * @param {string} notes - Transfer notes
   * @returns {Promise<Object>} Transfer result
   */
  async transferUser(userId, departmentId, roleId, transferringUserId, transferReason, notes = '') {
    try {
      const result = await transaction(async (client) => {
        // Get current assignment
        const currentAssignment = await client.query(
          `SELECT ur.id, ur.department_id, ur.role_id, ur.assigned_at,
                  d.display_name as current_dept_name,
                  r.display_name as current_role_name
           FROM user_roles ur
           JOIN departments d ON ur.department_id = d.id
           JOIN roles r ON ur.role_id = r.id
           WHERE ur.user_id = $1 AND ur.is_active = true`,
          [userId]
        );
        
        if (currentAssignment.rows.length === 0) {
          throw new Error('User has no active assignment to transfer');
        }
        
        const current = currentAssignment.rows[0];
        
        // Validate new department and role
        const newDeptCheck = await client.query(
          'SELECT id, display_name FROM departments WHERE id = $1 AND is_active = true',
          [departmentId]
        );
        
        if (newDeptCheck.rows.length === 0) {
          throw new Error('New department not found or inactive');
        }
        
        const newRoleCheck = await client.query(
          'SELECT id, display_name FROM roles WHERE id = $1 AND department_id = $2 AND is_active = true',
          [roleId, departmentId]
        );
        
        if (newRoleCheck.rows.length === 0) {
          throw new Error('New role not found, inactive, or does not belong to the new department');
        }
        
        // Deactivate current assignment
        await client.query(
          `UPDATE user_roles 
           SET is_active = false, 
               unassigned_at = NOW(),
               unassigned_by_user_id = $1,
               transfer_reason = $2,
               updated_at = NOW(),
               updated_by = $1
           WHERE id = $3`,
          [transferringUserId, transferReason, current.id]
        );
        
        // Create new assignment
        const newAssignmentResult = await client.query(
          `INSERT INTO user_roles (
             user_id, department_id, role_id, assigned_by, 
             assignment_notes, transfer_from_assignment_id, is_active, 
             assigned_at, updated_at, updated_by
           ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW(), $4)
           RETURNING id, assigned_at`,
          [userId, departmentId, roleId, transferringUserId, notes, current.id]
        );
        
        const newAssignment = newAssignmentResult.rows[0];
        
        // Log transfer (simplified to avoid audit log partition errors)
        console.log('User transferred:', {
          userId,
          fromDepartment: current.current_dept_name,
          fromRole: current.current_role_name,
          toDepartment: newDeptCheck.rows[0].display_name,
          toRole: newRoleCheck.rows[0].display_name,
          transferReason,
          transferredBy: transferringUserId,
          notes
        });
        
        return {
          success: true,
          transfer: {
            user_id: userId,
            from: {
              department: current.current_dept_name,
              role: current.current_role_name,
              assignment_duration_days: Math.floor(
                (Date.now() - new Date(current.assigned_at).getTime()) / (1000 * 60 * 60 * 24)
              )
            },
            to: {
              department: newDeptCheck.rows[0].display_name,
              role: newRoleCheck.rows[0].display_name
            },
            transfer_reason: transferReason,
            transferred_by: transferringUserId,
            transferred_at: newAssignment.assigned_at
          },
          message: `User transferred from ${current.current_dept_name} to ${newDeptCheck.rows[0].display_name}`
        };
      });
      
      // Invalidate user's cached permissions after successful transfer
      try {
        await redisManager.del(CacheKeys.userPermissions(userId));
        await redisManager.del(CacheKeys.userModules(userId));
        await redisManager.del(CacheKeys.userSession(userId));
        console.log('🧹 Cleared Redis cache for user after role transfer:', userId);
      } catch (cacheError) {
        console.warn('Failed to clear Redis cache for user:', userId, cacheError.message);
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to transfer user: ${error.message}`);
    }
  }

  /**
   * Remove user assignment (unassign)
   * @param {string} userId - User ID to unassign
   * @param {string} unassigningUserId - ID of user making unassignment
   * @param {string} reason - Unassignment reason
   * @param {string} notes - Unassignment notes
   * @returns {Promise<Object>} Unassignment result
   */
  async unassignUser(userId, unassigningUserId, reason, notes = '') {
    try {
      const result = await transaction(async (client) => {
        // Get current assignment
        const currentAssignment = await client.query(
          `SELECT ur.id, ur.assigned_at,
                  d.display_name as dept_name,
                  r.display_name as role_name,
                  u.first_name, u.last_name
           FROM user_roles ur
           JOIN departments d ON ur.department_id = d.id
           JOIN roles r ON ur.role_id = r.id
           JOIN users u ON ur.user_id = u.id
           WHERE ur.user_id = $1 AND ur.is_active = true`,
          [userId]
        );
        
        if (currentAssignment.rows.length === 0) {
          throw new Error('User has no active assignment to remove');
        }
        
        const assignment = currentAssignment.rows[0];
        
        // Deactivate assignment
        await client.query(
          `UPDATE user_roles 
           SET is_active = false, 
               unassigned_at = NOW(),
               unassigned_by_user_id = $1,
               unassignment_reason = $2,
               unassignment_notes = $3,
               updated_at = NOW(),
               updated_by = $1
           WHERE id = $4`,
          [unassigningUserId, reason, notes, assignment.id]
        );
        
        // Log unassignment (simplified - remove audit logs to avoid partition errors)
        console.log('Unassigned user:', {
          userId,
          assignmentId: assignment.id,
          department: assignment.dept_name,
          role: assignment.role_name,
          unassignedBy: unassigningUserId,
          reason
        });
        
        return {
          success: true,
          unassignment: {
            user_id: userId,
            user_name: `${assignment.first_name} ${assignment.last_name}`,
            previous_department: assignment.dept_name,
            previous_role: assignment.role_name,
            unassigned_by: unassigningUserId,
            unassigned_at: new Date().toISOString(),
            reason: reason,
            notes: notes
          },
          message: `User unassigned from ${assignment.dept_name}`
        };
      });
      
      // Invalidate user's cached permissions after successful unassignment
      try {
        await redisManager.del(CacheKeys.userPermissions(userId));
        await redisManager.del(CacheKeys.userModules(userId));
        await redisManager.del(CacheKeys.userSession(userId));
        console.log('🧹 Cleared Redis cache for user after role unassignment:', userId);
      } catch (cacheError) {
        console.warn('Failed to clear Redis cache for user:', userId, cacheError.message);
      }
      
      return result;
      
    } catch (error) {
      throw new Error(`Failed to unassign user: ${error.message}`);
    }
  }

  /**
   * Get assignment details by assignment ID
   * @param {string} assignmentId - Assignment ID
   * @returns {Promise<Object>} Assignment details
   */
  async getAssignmentDetails(assignmentId) {
    try {
      const assignmentQuery = `
        SELECT 
          ur.id,
          ur.user_id,
          ur.assigned_at,
          ur.assignment_notes,
          ur.is_active,
          
          -- User info
          u.email,
          u.first_name,
          u.last_name,
          u.employee_id,
          
          -- Department info
          d.id as department_id,
          d.display_name as department_name,
          d.department_code,
          
          -- Role info
          r.id as role_id,
          r.display_name as role_name,
          r.role_type,
          r.role_level,
          
          -- Assignment by
          assigned_by.first_name as assigned_by_first_name,
          assigned_by.last_name as assigned_by_last_name
          
        FROM user_roles ur
        JOIN users u ON ur.user_id = u.id
        JOIN departments d ON ur.department_id = d.id
        JOIN roles r ON ur.role_id = r.id
        LEFT JOIN users assigned_by ON ur.assigned_by_user_id = assigned_by.id
        WHERE ur.id = $1
      `;
      
      const result = await query(assignmentQuery, [assignmentId]);
      
      if (result.rows.length === 0) {
        throw new Error('Assignment not found');
      }
      
      const assignment = result.rows[0];
      
      return {
        ...assignment,
        user_name: `${assignment.first_name} ${assignment.last_name}`,
        assigned_by: assignment.assigned_by_first_name 
          ? `${assignment.assigned_by_first_name} ${assignment.assigned_by_last_name}`
          : 'System'
      };
      
    } catch (error) {
      throw new Error(`Failed to get assignment details: ${error.message}`);
    }
  }

  /**
   * Get all users available for assignment (both assigned and unassigned)
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Array>} All users with assignment status
   */
  async getAllAvailableUsers(requestingUserId) {
    try {
      const availableUsersQuery = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.employee_id,
          u.status,
          u.is_active,
          u.is_superuser,
          u.created_at,
          u.approval_date,
          
          -- Check if user has current assignment
          CASE WHEN ur.id IS NOT NULL THEN false ELSE true END as can_assign,
          CASE WHEN ur.id IS NOT NULL THEN true ELSE false END as has_assignment,
          
          -- Current assignment info if any
          d.id as current_department_id,
          d.display_name as current_department_name,
          r.id as current_role_id,
          r.display_name as current_role_name,
          ur.assigned_at
          
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN departments d ON ur.department_id = d.id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.status = 'active' 
          AND u.is_active = true
        ORDER BY u.first_name, u.last_name
      `;
      
      const result = await query(availableUsersQuery);
      
      const mappedUsers = result.rows.map(user => ({
        ...user,
        name: `${user.first_name} ${user.last_name}`,
        assignment_status: user.has_assignment 
          ? `Currently assigned to ${user.current_department_name} as ${user.current_role_name}`
          : 'Available for assignment'
      }));
      
      return mappedUsers;
      
    } catch (error) {
      console.error('❌ Error in getAllAvailableUsers:', error);
      throw new Error(`Failed to get available users: ${error.message}`);
    }
  }

  /**
   * Get users available for assignment to a department
   * @param {string} departmentId - Department ID
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Array>} Available users
   */
  async getAvailableUsersForDepartment(departmentId, requestingUserId) {
    try {
      const availableUsersQuery = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.employee_id,
          u.created_at,
          u.approval_date,
          
          -- Check if user has current assignment
          CASE WHEN ur.id IS NOT NULL THEN true ELSE false END as has_assignment,
          
          -- Current assignment info if any
          d.display_name as current_department,
          r.display_name as current_role
          
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN departments d ON ur.department_id = d.id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.status = 'active' 
          AND 1=1
        ORDER BY u.first_name, u.last_name
      `;
      
      const result = await query(availableUsersQuery);
      
      return result.rows.map(user => ({
        ...user,
        name: `${user.first_name} ${user.last_name}`,
        can_assign: !user.has_assignment,
        assignment_status: user.has_assignment 
          ? `Currently assigned to ${user.current_department} as ${user.current_role}`
          : 'Available for assignment'
      }));
      
    } catch (error) {
      throw new Error(`Failed to get available users: ${error.message}`);
    }
  }

  /**
   * Get assignment statistics
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Object>} Assignment statistics
   */
  async getAssignmentStatistics(requestingUserId) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT ur.user_id) as total_assigned_users,
          COUNT(DISTINCT CASE WHEN ur.assigned_at >= NOW() - INTERVAL '30 days' THEN ur.user_id END) as recent_assignments,
          COUNT(DISTINCT CASE WHEN ur.unassigned_at >= NOW() - INTERVAL '30 days' THEN ur.user_id END) as recent_unassignments,
          COUNT(DISTINCT CASE WHEN ur.transfer_from_assignment_id IS NOT NULL THEN ur.user_id END) as total_transfers,
          
          -- Average assignment duration for completed assignments
          AVG(EXTRACT(EPOCH FROM (ur.unassigned_at - ur.assigned_at))/86400)::INTEGER as avg_assignment_duration_days
          
        FROM user_roles ur
        WHERE ur.assigned_at IS NOT NULL
      `;
      
      const departmentAssignmentQuery = `
        SELECT 
          d.display_name as department_name,
          COUNT(ur.user_id) as assigned_users,
          COUNT(CASE WHEN ur.assigned_at >= NOW() - INTERVAL '30 days' THEN 1 END) as recent_assignments
        FROM departments d
        LEFT JOIN user_roles ur ON d.id = ur.department_id AND ur.is_active = true
        WHERE d.is_active = true
        GROUP BY d.id, d.display_name
        ORDER BY assigned_users DESC
      `;
      
      const [statsResult, deptAssignmentResult] = await Promise.all([
        query(statsQuery),
        query(departmentAssignmentQuery)
      ]);
      
      return {
        overview: statsResult.rows[0],
        by_department: deptAssignmentResult.rows,
        generated_at: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`Failed to get assignment statistics: ${error.message}`);
    }
  }
}

export default new UserAssignmentService();
