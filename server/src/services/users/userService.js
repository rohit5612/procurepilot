import { query } from '../../database/connection.js';
import { writeAuditLog } from '../system/auditLogWriter.js';
import emailService from '../auth/emailService.js';

class UserService {
  /**
   * Get all users with filtering and pagination
   * @param {Object} filters - Search filters
   * @param {Object} pagination - Pagination options
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Object>} Users data with pagination
   */
  async getAllUsers(filters = {}, pagination = {}, requestingUserId) {
    try {
      const { 
        search = '', 
        status = '', 
        departmentId = '', 
        roleId = '',
        isActive = ''
      } = filters;
      
      const { 
        page = 1, 
        limit = 20, 
        sortBy = 'created_at', 
        sortOrder = 'DESC' 
      } = pagination;
      
      const offset = (page - 1) * limit;
      
      // Build WHERE clause - no need to check deleted_at since we use archival system
      let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;
      
      if (search) {
        whereConditions.push(`(
          u.first_name ILIKE $${paramIndex} OR 
          u.last_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR
          u.employee_id ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }
      
      if (status) {
        whereConditions.push(`u.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }
      
      if (departmentId) {
        whereConditions.push(`ur.department_id = $${paramIndex}`);
        queryParams.push(departmentId);
        paramIndex++;
      }
      
      if (roleId) {
        whereConditions.push(`ur.role_id = $${paramIndex}`);
        queryParams.push(roleId);
        paramIndex++;
      }
      
      if (isActive !== '') {
        whereConditions.push(`u.is_active = $${paramIndex}`);
        queryParams.push(isActive === 'true');
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Validate sort column
      const allowedSortColumns = [
        'created_at', 'first_name', 'last_name', 'email', 
        'status', 'last_login', 'department_name', 'role_name'
      ];
      const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      // Main query  
      const usersQuery = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.employee_id,
          u.phone,
          u.status,
          u.is_active,
          u.email_verified_at,
          u.last_login,
          u.created_at,
          u.updated_at,
          
          -- Department info
          d.id as department_id,
          d.display_name as department_name,
          d.department_code,
          
          -- Role info
          r.id as role_id,
          r.display_name as role_name,
          r.role_type,
          r.role_level,
          
          -- Assignment info
          ur.assigned_at,
          ur.assigned_by_user_id,
          assigned_by.first_name as assigned_by_first_name,
          assigned_by.last_name as assigned_by_last_name
          
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN departments d ON ur.department_id = d.id AND d.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        LEFT JOIN users assigned_by ON ur.assigned_by_user_id = assigned_by.id
        WHERE ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      queryParams.push(limit, offset);
      
      // Count query
      const countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN departments d ON ur.department_id = d.id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE ${whereClause}
      `;
      
      // Execute queries
      const [usersResult, countResult] = await Promise.all([
        query(usersQuery, queryParams.slice(0, -2).concat(queryParams.slice(-2))),
        query(countQuery, queryParams.slice(0, -2))
      ]);
      
      const users = usersResult.rows;
      const total = parseInt(countResult.rows[0].total);
      
      return {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  /**
   * Get pending user registrations for approval
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Array>} Pending users
   */
  async getPendingUsers(requestingUserId) {
    try {
      const pendingQuery = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.employee_id,
          u.phone,
          u.status,
          u.email_verified_at,
          u.created_at,
          u.registration_notes,
          
          -- Registration metadata
          EXTRACT(EPOCH FROM (NOW() - u.created_at))/3600 as hours_pending
          
        FROM users u
        WHERE u.status = 'pending_approval'
          AND u.email_verified_at IS NOT NULL
          AND u.approval_status = 'pending'
        ORDER BY u.created_at ASC
      `;
      
      const result = await query(pendingQuery);
      
      return result.rows.map(user => ({
        ...user,
        hours_pending: Math.floor(user.hours_pending),
        can_approve: true,
        registration_complete: user.email_verified_at !== null
      }));
      
    } catch (error) {
      throw new Error(`Failed to get pending users: ${error.message}`);
    }
  }

  /**
   * Get user by ID with full details
   * @param {string} userId - User ID
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Object>} User details
   */
  async getUserById(userId, requestingUserId) {
    try {
      const userQuery = `
        SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.employee_id,
          u.phone,
          u.status,
          u.is_active,
          u.email_verified_at,
          u.last_login,
          u.created_at,
          u.updated_at,
          u.registration_notes,
          u.profile_metadata,
          
          -- Department info
          d.id as department_id,
          d.display_name as department_name,
          d.department_code,
          d.description as department_description,
          
          -- Role info
          r.id as role_id,
          r.display_name as role_name,
          r.role_type,
          r.role_level,
          r.description as role_description,
          
          -- Assignment info
          ur.assigned_at,
          ur.assigned_by_user_id,
          assigned_by.first_name as assigned_by_first_name,
          assigned_by.last_name as assigned_by_last_name,
          
          -- Assignment history count
          (SELECT COUNT(*) FROM user_roles ur_hist WHERE ur_hist.user_id = u.id) as assignment_history_count
          
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN departments d ON ur.department_id = d.id
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN users assigned_by ON ur.assigned_by_user_id = assigned_by.id
        WHERE u.id = $1
      `;
      
      const result = await query(userQuery, [userId]);
      
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = result.rows[0];
      
      // Get user's permission summary if they have a role
      if (user.role_id) {
        const permissionsQuery = `
          SELECT 
            COUNT(*) as total_permissions,
            COUNT(CASE WHEN 'create' = ANY(rp.permissions) THEN 1 END) as can_create,
            COUNT(CASE WHEN 'approve' = ANY(rp.permissions) THEN 1 END) as can_approve,
            COUNT(CASE WHEN 'export' = ANY(rp.permissions) THEN 1 END) as can_export
          FROM role_permissions rp
          WHERE rp.role_id = $1
        `;
        
        const permResult = await query(permissionsQuery, [user.role_id]);
        user.permission_summary = permResult.rows[0];
      }
      
      return user;
      
    } catch (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }
  }

  /**
   * Approve pending user
   * @param {string} userId - User ID to approve
   * @param {string} approvingUserId - ID of user approving
   * @param {string} notes - Approval notes
   * @returns {Promise<Object>} Approval result
   */
  async approveUser(userId, approvingUserId, notes = '') {
    try {
      // Start transaction
      const client = await query.getClient();
      await client.query('BEGIN');
      
      try {
                 // Check user exists and is pending
         const userCheck = await client.query(
           'SELECT id, email, first_name, last_name, status FROM users WHERE id = $1',
           [userId]
         );
        
        if (userCheck.rows.length === 0) {
          throw new Error('User not found');
        }
        
        const user = userCheck.rows[0];
        
        if (user.status !== 'pending_approval') {
          throw new Error(`User is not pending approval. Current status: ${user.status}`);
        }
        
        // Update user status
        await client.query(
          `UPDATE users 
           SET status = 'approved', 
               approval_date = NOW(),
               approved_by_user_id = $1,
               approval_notes = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [approvingUserId, notes, userId]
        );
        
        // Log audit entry (best-effort, outside main transaction semantics)
        await writeAuditLog({
          userId: approvingUserId,
          action: 'user_approved',
          resourceType: 'user',
          resourceId: userId,
          oldValues: {
            status: 'pending_approval'
          },
          newValues: {
            status: 'approved',
            approved_by: approvingUserId,
            notes
          },
          ipAddress: null,
          userAgent: null,
          requestMethod: null,
          requestPath: null,
          requestQuery: null,
          description: 'User approval completed',
          success: true,
          errorMessage: null,
          metadata: null
        });
        
        await client.query('COMMIT');
        
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            status: 'approved'
          },
          approval: {
            approved_by: approvingUserId,
            approved_at: new Date().toISOString(),
            notes: notes
          }
        };
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      throw new Error(`Failed to approve user: ${error.message}`);
    }
  }

  /**
   * Reject pending user
   * @param {string} userId - User ID to reject
   * @param {string} rejectingUserId - ID of user rejecting
   * @param {string} reason - Rejection reason
   * @returns {Promise<Object>} Rejection result
   */
  async rejectUser(userId, rejectingUserId, reason) {
    try {
      // Start transaction
      const client = await query.getClient();
      await client.query('BEGIN');
      
      try {
        // Check user exists and is pending
        const userCheck = await client.query(
          'SELECT id, email, first_name, last_name, status FROM users WHERE id = $1',
          [userId]
        );
        
        if (userCheck.rows.length === 0) {
          throw new Error('User not found');
        }
        
        const user = userCheck.rows[0];
        
        if (user.status !== 'pending_approval') {
          throw new Error(`User is not pending approval. Current status: ${user.status}`);
        }
        
        // Update user status
        await client.query(
          `UPDATE users 
           SET status = 'rejected', 
               rejection_date = NOW(),
               rejected_by_user_id = $1,
               rejection_reason = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [rejectingUserId, reason, userId]
        );
        
        // Log audit entry (best-effort)
        await writeAuditLog({
          userId: rejectingUserId,
          action: 'user_rejected',
          resourceType: 'user',
          resourceId: userId,
          oldValues: {
            status: 'pending_approval'
          },
          newValues: {
            status: 'rejected',
            rejected_by: rejectingUserId,
            reason
          },
          ipAddress: null,
          userAgent: null,
          requestMethod: null,
          requestPath: null,
          requestQuery: null,
          description: 'User rejection completed',
          success: true,
          errorMessage: null,
          metadata: null
        });
        
        await client.query('COMMIT');
        
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            status: 'rejected'
          },
          rejection: {
            rejected_by: rejectingUserId,
            rejected_at: new Date().toISOString(),
            reason: reason
          }
        };
        
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
      
    } catch (error) {
      throw new Error(`Failed to reject user: ${error.message}`);
    }
  }

  /**
   * Get user assignment history
   * @param {string} userId - User ID
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Array>} Assignment history
   */
  async getUserAssignmentHistory(userId, requestingUserId) {
    try {
      const historyQuery = `
        SELECT 
          ur.id,
          ur.assigned_at,
          ur.unassigned_at,
          ur.is_active,
          
          -- Department info
          d.display_name as department_name,
          d.department_code,
          
          -- Role info
          r.display_name as role_name,
          r.role_type,
          r.role_level,
          
          -- Assignment by
          assigned_by.first_name as assigned_by_first_name,
          assigned_by.last_name as assigned_by_last_name,
          
          -- Unassignment by
          unassigned_by.first_name as unassigned_by_first_name,
          unassigned_by.last_name as unassigned_by_last_name,
          
          -- Duration calculation
          CASE 
            WHEN ur.unassigned_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (ur.unassigned_at - ur.assigned_at))/86400
            ELSE
              EXTRACT(EPOCH FROM (NOW() - ur.assigned_at))/86400
          END as duration_days
          
        FROM user_roles ur
        LEFT JOIN departments d ON ur.department_id = d.id
        LEFT JOIN roles r ON ur.role_id = r.id
        LEFT JOIN users assigned_by ON ur.assigned_by_user_id = assigned_by.id
        LEFT JOIN users unassigned_by ON ur.unassigned_by_user_id = unassigned_by.id
        WHERE ur.user_id = $1
        ORDER BY ur.assigned_at DESC
      `;
      
      const result = await query(historyQuery, [userId]);
      
      return result.rows.map(assignment => ({
        ...assignment,
        duration_days: Math.floor(assignment.duration_days),
        is_current: assignment.is_active,
        assigned_by: assignment.assigned_by_first_name 
          ? `${assignment.assigned_by_first_name} ${assignment.assigned_by_last_name}`
          : 'System',
        unassigned_by: assignment.unassigned_by_first_name
          ? `${assignment.unassigned_by_first_name} ${assignment.unassigned_by_last_name}`
          : null
      }));
      
    } catch (error) {
      throw new Error(`Failed to get user assignment history: ${error.message}`);
    }
  }

  /**
   * Get user statistics for dashboard
   * @param {string} requestingUserId - ID of user making request
   * @returns {Promise<Object>} User statistics
   */
  async getUserStatistics(requestingUserId) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users,
          COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_approval,
          COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_unassigned,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_users,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_users,
          COUNT(CASE WHEN last_login >= NOW() - INTERVAL '30 days' THEN 1 END) as active_last_30_days,
          COUNT(CASE WHEN email_verified_at IS NULL THEN 1 END) as unverified_emails,
          COUNT(CASE WHEN ur.id IS NOT NULL THEN 1 END) as users_with_assignments
                 FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
         WHERE 1=1
      `;
      
      const departmentStatsQuery = `
        SELECT 
          d.display_name as department_name,
          d.department_code,
          COUNT(ur.user_id) as user_count,
          COUNT(CASE WHEN u.status = 'active' THEN 1 END) as active_count
        FROM departments d
        LEFT JOIN user_roles ur ON d.id = ur.department_id AND ur.is_active = true
                 LEFT JOIN users u ON ur.user_id = u.id
         WHERE d.is_active = true
        GROUP BY d.id, d.display_name, d.department_code
        ORDER BY user_count DESC
      `;
      
      const roleStatsQuery = `
        SELECT 
          r.display_name as role_name,
          r.role_type,
          r.role_level,
          COUNT(ur.user_id) as user_count
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
                 LEFT JOIN users u ON ur.user_id = u.id
         WHERE r.is_active = true
        GROUP BY r.id, r.display_name, r.role_type, r.role_level
        ORDER BY user_count DESC
      `;
      
      const [statsResult, deptStatsResult, roleStatsResult] = await Promise.all([
        query(statsQuery),
        query(departmentStatsQuery),
        query(roleStatsQuery)
      ]);
      
      return {
        overview: statsResult.rows[0],
        by_department: deptStatsResult.rows,
        by_role: roleStatsResult.rows,
        generated_at: new Date().toISOString()
      };
      
    } catch (error) {
      throw new Error(`Failed to get user statistics: ${error.message}`);
    }
  }

  /**
   * Get all users with approval status
   */
  async getAllUsersWithApprovalStatus({ page = 1, limit = 10, status, search }) {
    try {
      const offset = (page - 1) * limit;
      
             let whereConditions = ['1=1'];
      let queryParams = [];
      let paramIndex = 1;
      
      if (status) {
        whereConditions.push(`u.approval_status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }
      
      if (search) {
        whereConditions.push(`(
          u.first_name ILIKE $${paramIndex} OR 
          u.last_name ILIKE $${paramIndex} OR 
          u.email ILIKE $${paramIndex} OR
          u.username ILIKE $${paramIndex} OR
          u.employee_id ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }
      
      const whereClause = whereConditions.join(' AND ');
      
      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        WHERE ${whereClause}
      `;
      
      // Main query
      const usersQuery = `
        SELECT 
          u.id,
          u.email,
          u.username,
          u.first_name,
          u.last_name,
          u.full_name,
          u.mobile_number,
          u.aadhar_card,
          u.employee_id,
          u.designation,
          u.date_of_birth,
          u.approval_status,
          u.email_verified,
          u.status,
          u.created_at,
          u.approved_at,
          u.rejection_reason,
          approved_by_user.first_name as approved_by_first_name,
          approved_by_user.last_name as approved_by_last_name
        FROM users u
                 LEFT JOIN users approved_by_user ON u.approved_by = approved_by_user.id
        WHERE ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      const [countResult, usersResult] = await Promise.all([
        query(countQuery, queryParams),
        query(usersQuery, [...queryParams, limit, offset])
      ]);
      
      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);
      
      return {
        success: true,
        data: {
          users: usersResult.rows.map(user => ({
            ...user,
            fullName: user.full_name,
            approvalDate: user.approved_at,
            approvedBy: user.approved_by_first_name 
              ? `${user.approved_by_first_name} ${user.approved_by_last_name}`
              : null
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to get users with approval status: ${error.message}`);
    }
  }

  /**
   * Get pending users for approval
   */
  async getPendingUsers({ page = 1, limit = 10 }) {
    try {
      return await this.getAllUsersWithApprovalStatus({
        page,
        limit,
        status: 'pending'
      });
    } catch (error) {
      throw new Error(`Failed to get pending users: ${error.message}`);
    }
  }

  /**
   * Approve a user using the new approval_status field
   */
     async approveUser(userId, approvedBy) {
     try {
       // Check if user exists and is pending
       const userCheck = await query(
         'SELECT id, email, first_name, last_name, approval_status FROM users WHERE id = $1',
         [userId]
       );
      
      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userCheck.rows[0];
      
      if (user.approval_status !== 'pending') {
        throw new Error(`User is not pending approval. Current status: ${user.approval_status}`);
      }
      
      // Update user approval status
      await query(
        `UPDATE users 
         SET approval_status = 'approved', 
             status = 'active',
             approved_by = $1,
             approved_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [approvedBy, userId]
      );

      // Send approval email
      try {
        await emailService.sendUserApprovalEmail(
          user.email,
          user.first_name,
          user.username || user.email,
          true // isApproved
        );
      } catch (emailError) {
        console.error('Failed to send approval email:', emailError);
        // Don't fail the approval if email fails
      }
      
      return {
        success: true,
        message: 'User approved successfully',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          approvalStatus: 'approved'
        }
      };
    } catch (error) {
      throw new Error(`Failed to approve user: ${error.message}`);
    }
  }

  /**
   * Reject a user using the new approval_status field
   */
     async rejectUser(userId, rejectedBy, rejectionReason) {
     try {
       // Check if user exists and is pending
       const userCheck = await query(
         'SELECT id, email, first_name, last_name, approval_status FROM users WHERE id = $1',
         [userId]
       );
      
      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userCheck.rows[0];
      
      if (user.approval_status !== 'pending') {
        throw new Error(`User is not pending approval. Current status: ${user.approval_status}`);
      }
      
      // Update user approval status
      await query(
        `UPDATE users 
         SET approval_status = 'rejected', 
             status = 'inactive',
             approved_by = $1,
             approved_at = NOW(),
             rejection_reason = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [rejectedBy, rejectionReason, userId]
      );

      // Send rejection email
      try {
        await emailService.sendUserApprovalEmail(
          user.email,
          user.first_name,
          user.username || user.email,
          false, // isApproved
          rejectionReason
        );
      } catch (emailError) {
        console.error('Failed to send rejection email:', emailError);
        // Don't fail the rejection if email fails
      }
      
      return {
        success: true,
        message: 'User rejected successfully',
        user: {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          approvalStatus: 'rejected',
          rejectionReason
        }
      };
    } catch (error) {
      throw new Error(`Failed to reject user: ${error.message}`);
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStatistics() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN approval_status = 'pending' THEN 1 END) as pending_approval,
          COUNT(CASE WHEN approval_status = 'approved' THEN 1 END) as approved_users,
          COUNT(CASE WHEN approval_status = 'rejected' THEN 1 END) as rejected_users,
          COUNT(CASE WHEN email_verified = true THEN 1 END) as email_verified,
          COUNT(CASE WHEN email_verified = false THEN 1 END) as email_pending
        FROM users
                 WHERE 1=1
      `;
      
      const result = await query(statsQuery);
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get approval statistics: ${error.message}`);
    }
  }
}

export default new UserService();
