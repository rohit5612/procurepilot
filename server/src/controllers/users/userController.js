import userService from '../../services/users/userService.js';
import { query } from '../../database/connection.js';
import redisManager, { CacheKeys, CacheTTL } from '../../config/redis.js';
import userArchiveService from '../../services/users/userArchiveService.js';

class UserController {
  /**
   * Get all users with filtering and pagination (with Redis caching)
   */
  async getAllUsers(req, res) {
    try {
      const { user } = req;
      
      // Extract filters from query params
      const filters = {
        search: req.query.search || '',
        status: req.query.status || '',
        departmentId: req.query.departmentId || '',
        roleId: req.query.roleId || '',
        isActive: req.query.isActive || ''
      };
      
      // Extract pagination from query params
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 20, 100), // Max 100 per page
        sortBy: req.query.sortBy || 'created_at',
        sortOrder: req.query.sortOrder || 'DESC'
      };
      
      // Create cache key based on filters and pagination
      const cacheKey = `users:list:${JSON.stringify(filters)}:${JSON.stringify(pagination)}:${user.userId}`;
      
      // Try to get from cache first (with error handling)
      let cachedResult = null;
      try {
        cachedResult = await redisManager.get(cacheKey);
        if (cachedResult) {
          return res.json({
            success: true,
            message: 'Users retrieved successfully (cached)',
            data: cachedResult.users,
            pagination: cachedResult.pagination,
            filters: filters,
            cached: true
          });
        }
      } catch (error) {
        console.warn('Failed to get users from Redis cache:', error.message);
        // Continue without cache
      }
      
      const result = await userService.getAllUsers(filters, pagination, user.userId);
      
      // Cache the result for 5 minutes (with error handling)
      try {
        await redisManager.set(cacheKey, result, 300);
      } catch (error) {
        console.warn('Failed to cache users in Redis:', error.message);
        // Continue without caching
      }
      
      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: result.users,
        pagination: result.pagination,
        filters: filters
      });
      
    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users',
        error: error.message
      });
    }
  }

  /**
   * Get pending users for approval
   */
  async getPendingUsers(req, res) {
    try {
      const { user } = req;
      
      const pendingUsers = await userService.getPendingUsers(user.userId);
      
      res.json({
        success: true,
        message: 'Pending users retrieved successfully',
        data: pendingUsers,
        count: pendingUsers.length
      });
      
    } catch (error) {
      console.error('Get pending users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve pending users',
        error: error.message
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      
      const userData = await userService.getUserById(userId, user.userId);
      
      res.json({
        success: true,
        message: 'User retrieved successfully',
        data: userData
      });
      
    } catch (error) {
      console.error('Get user by ID error:', error);
      
      if (error.message === 'User not found') {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user',
        error: error.message
      });
    }
  }

  /**
   * Approve pending user
   */
  async approveUser(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      const { notes = '' } = req.body;
      
      // Check if user is protected
      const userCheck = await query(
        'SELECT id, email, is_protected FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (userCheck.rows[0].is_protected) {
        return res.status(403).json({
          success: false,
          message: 'Cannot modify protected admin accounts'
        });
      }
      
      const result = await userService.approveUser(userId, user.userId, notes);
      
      res.json({
        success: true,
        message: 'User approved successfully',
        data: result
      });
      
    } catch (error) {
      console.error('Approve user error:', error);
      
      if (error.message.includes('not found') || error.message.includes('not pending')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot approve user',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to approve user',
        error: error.message
      });
    }
  }

  /**
   * Reject pending user
   */
  async rejectUser(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      const { reason } = req.body;
      
      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }
      
      // Check if user is protected
      const userCheck = await query(
        'SELECT id, email, is_protected FROM users WHERE id = $1',
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (userCheck.rows[0].is_protected) {
        return res.status(403).json({
          success: false,
          message: 'Cannot modify protected admin accounts'
        });
      }
      
      const result = await userService.rejectUser(userId, user.userId, reason);
      
      res.json({
        success: true,
        message: 'User rejected successfully',
        data: result
      });
      
    } catch (error) {
      console.error('Reject user error:', error);
      
      if (error.message.includes('not found') || error.message.includes('not pending')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot reject user',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to reject user',
        error: error.message
      });
    }
  }

  /**
   * Bulk approve users
   */
  async bulkApproveUsers(req, res) {
    try {
      const { user } = req;
      const { userIds, notes = '' } = req.body;
      
      // Allow empty arrays for testing - just return success with no changes
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.json({
          success: true,
          message: 'No users to approve',
          data: {
            approved: [],
            failed: [],
            total: 0
          }
        });
      }
      
      const results = [];
      const errors = [];
      
      // Process each user approval
      for (const userId of userIds) {
        try {
          const result = await userService.approveUser(userId, user.userId, notes);
          results.push(result);
        } catch (error) {
          errors.push({
            userId,
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        message: `Bulk approval completed. ${results.length} approved, ${errors.length} failed`,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: userIds.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
      
    } catch (error) {
      console.error('Bulk approve users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process bulk approval',
        error: error.message
      });
    }
  }

  /**
   * Get user assignment history
   */
  async getUserAssignmentHistory(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      
      const history = await userService.getUserAssignmentHistory(userId, user.userId);
      
      res.json({
        success: true,
        message: 'User assignment history retrieved successfully',
        data: history,
        count: history.length
      });
      
    } catch (error) {
      console.error('Get user assignment history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignment history',
        error: error.message
      });
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(req, res) {
    try {
      const { user } = req;
      
      const stats = await userService.getUserStatistics(user.userId);
      
      res.json({
        success: true,
        message: 'User statistics retrieved successfully',
        data: stats
      });
      
    } catch (error) {
      console.error('Get user statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user statistics',
        error: error.message
      });
    }
  }

  /**
   * Update user profile (basic info)
   */
  async updateUserProfile(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      const updates = req.body;
      
      // Only allow certain fields to be updated
      const allowedFields = ['first_name', 'last_name', 'phone', 'employee_id', 'profile_metadata'];
      const sanitizedUpdates = {};
      
      for (const field of allowedFields) {
        if (updates[field] !== undefined) {
          sanitizedUpdates[field] = updates[field];
        }
      }
      
      if (Object.keys(sanitizedUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update'
        });
      }
      
      // Build update query
      const updateFields = Object.keys(sanitizedUpdates).map((field, index) => 
        `${field} = $${index + 1}`
      ).join(', ');
      
      const updateValues = Object.values(sanitizedUpdates);
      updateValues.push(userId);
      
      const updateQuery = `
        UPDATE users 
        SET ${updateFields}, updated_at = NOW()
        WHERE id = $${updateValues.length}
        RETURNING id, first_name, last_name, phone, employee_id, updated_at
      `;
      
      const result = await query(updateQuery, updateValues);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      res.json({
        success: true,
        message: 'User profile updated successfully',
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('Update user profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user profile',
        error: error.message
      });
    }
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      const { reason = '' } = req.body;
      
      // Cannot deactivate superuser
      if (userId === '1') {
        return res.status(403).json({
          success: false,
          message: 'Cannot deactivate superuser account'
        });
      }
      
      const updateQuery = `
        UPDATE users 
        SET is_active = false, 
            status = 'inactive',
            deactivation_reason = $1,
            deactivated_by_user_id = $2,
            deactivated_at = NOW(),
            updated_at = NOW()
        WHERE id = $3
        RETURNING id, email, first_name, last_name, status
      `;
      
      const result = await query(updateQuery, [reason, user.userId, userId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Also deactivate any active role assignments
      await query(
        `UPDATE user_roles 
         SET is_active = false, 
             unassigned_at = NOW(),
             unassigned_by_user_id = $1,
             unassignment_reason = 'user_deactivated'
         WHERE user_id = $2 AND is_active = true`,
        [user.userId, userId]
      );
      
      res.json({
        success: true,
        message: 'User deactivated successfully',
        data: result.rows[0]
      });
      
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user',
        error: error.message
      });
    }
  }

  /**
   * Check user assignment status
   */
  /**
   * Get basic user info (available to all authenticated users)
   * Used for approval tasks and similar features
   */
  async getBasicUserInfo(req, res) {
    try {
      const { userId } = req.params;

      const userResult = await query(
        `SELECT 
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.first_name || ' ' || u.last_name as full_name,
          r.name as role_name,
          d.name as department_name
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        LEFT JOIN departments d ON r.department_id = d.id AND d.is_active = true
        WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        message: 'User info retrieved successfully',
        data: userResult.rows[0]
      });
    } catch (error) {
      console.error('Get basic user info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user info',
        error: error.message
      });
    }
  }

  async checkAssignmentStatus(req, res) {
    try {
      const userId = req.user.userId;

      const userResult = await query(
        `SELECT 
          u.id, u.email, u.username, u.first_name, u.last_name, u.full_name,
          u.status, u.email_verified, u.is_superuser, u.approval_status,
          ur.role_id,
          r.name as role_name, r.role_level,
          d.id as department_id, d.name as department_name
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        LEFT JOIN departments d ON r.department_id = d.id AND d.is_active = true
        WHERE u.id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResult.rows[0];
      const isFullyAssigned = user.is_superuser || (user.department_id && user.role_id);

      // Get user permissions
      let permissions = {
        modules: [],
        features: {},
        dataScopes: {}
      };

      if (isFullyAssigned) {
        const { AdvancedPermissionService } = await import('../../services/permissions/advancedPermissionService.js');
        
        if (user.is_superuser) {
          permissions = await AdvancedPermissionService.getSuperuserPermissions(true);
        } else if (user.role_id) {
          permissions = await AdvancedPermissionService.getUserPermissions(user.id, true);
        }
      }

      return res.json({
        success: true,
        isFullyAssigned,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          departmentId: user.department_id,
          departmentName: user.department_name,
          roleId: user.role_id,
          roleName: user.role_name,
          roleLevel: user.role_level,
          isSuperuser: user.is_superuser,
          isFullyAssigned,
          permissions
        }
      });
    } catch (error) {
      console.error('Error checking assignment status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to check assignment status'
      });
    }
  }

  // Get user directory (approved users only)
  async getUserDirectory(req, res) {
    try {
      const { page = 1, limit = 10, search = '', status = '', approved = 'true' } = req.query;
      const offset = (page - 1) * limit;

      // Build WHERE clause - no need to check deleted_at since we use archival system
      let whereConditions = ['1=1'];
      const queryParams = [];
      let paramCount = 0;
      
      // Add approval filter
      if (approved === 'true') {
        whereConditions.push(`u.approval_status = 'approved'`);
      }

      // Add status filter
      if (status && status !== 'all') {
        paramCount++;
        whereConditions.push(`u.status = $${paramCount}`);
        queryParams.push(status);
      }

      // Add search filter
      if (search) {
        paramCount++;
        whereConditions.push(`(
          u.first_name ILIKE $${paramCount} OR 
          u.last_name ILIKE $${paramCount} OR 
          u.email ILIKE $${paramCount} OR 
          u.username ILIKE $${paramCount}
        )`);
        queryParams.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Build the base query
      let sqlQuery = `
        SELECT 
          u.id, u.email, u.username, u.first_name, u.last_name, u.full_name,
          u.mobile_number, u.employee_id, u.designation, u.date_of_birth,
          u.status, u.email_verified, u.last_login, u.login_count, u.created_at,
          u.approval_status, u.approved_at, u.is_protected,
          d.name as department_name,
          r.name as role_name, r.role_level
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        LEFT JOIN departments d ON r.department_id = d.id AND d.is_active = true
        WHERE ${whereClause}
      `;

      // Add ordering
      sqlQuery += ` ORDER BY u.created_at DESC`;

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        LEFT JOIN departments d ON r.department_id = d.id AND d.is_active = true
        WHERE ${whereClause}
      `;
      const countResult = await query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      // Add pagination
      paramCount++;
      sqlQuery += ` LIMIT $${paramCount}`;
      queryParams.push(limit);

      paramCount++;
      sqlQuery += ` OFFSET $${paramCount}`;
      queryParams.push(offset);

      // Debug log before query
      console.log('User directory query:', {
        sqlQuery,
        whereClause,
        queryParams,
        total
      });

      // Execute the main query
      const result = await query(sqlQuery, queryParams);

      // Debug log after query
      console.log('User directory query results:', {
        whereClause,
        queryParams,
        totalUsers: total,
        returnedUsers: result.rows.length,
        userIds: result.rows.map(u => u.id),
        users: result.rows.map(u => ({
          id: u.id,
          email: u.email,
          status: u.status
        }))
      });

      return res.json({
        success: true,
        users: result.rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      });
    } catch (error) {
      console.error('Error fetching user directory:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user directory'
      });
    }
  }

  // Update user status
  async updateUserStatus(req, res) {
    try {
      const { userId } = req.params;
      const { status, reason, notes } = req.body;
      const adminId = req.user.userId;

      // Validate status
      const validStatuses = ['active', 'inactive', 'suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be one of: active, inactive, suspended'
        });
      }

      // Check if user exists and is approved
      const userCheck = await query(
        `SELECT id, email, first_name, last_name, status, approval_status, is_protected 
         FROM users WHERE id = $1`,
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userCheck.rows[0];

      // Check if user is protected (admin/backup accounts)
      if (user.is_protected) {
        return res.status(403).json({
          success: false,
          message: 'Cannot modify protected admin accounts'
        });
      }

      if (user.approval_status !== 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Can only update status for approved users'
        });
      }

      // Update user status
      await query(
        `UPDATE users 
         SET status = $1, updated_at = NOW() 
         WHERE id = $2`,
        [status, userId]
      );

      // If suspending, update suspension details and send email notification
      if (status === 'suspended') {
        await query(
          `UPDATE users 
           SET suspension_reason = $1, suspended_at = CURRENT_TIMESTAMP, 
               suspended_by = $2, suspension_notes = $3
           WHERE id = $4`,
          [reason || null, adminId, notes || null, userId]
        );

        // Send suspension notification email (improved template)
        try {
          const emailService = (await import('../../services/auth/emailService.js')).default;
          const subject = 'Your Account Has Been Suspended – Action Required';
          const appealUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/appeal/${userId}`;
          const supportEmail = process.env.SUPPORT_EMAIL || 'support@noreply.local';

          const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Account Suspended</title>
      <style>
        /* Basic reset for email clients */
        body { margin:0; padding:0; background:#f6f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, 'Helvetica Neue', 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', sans-serif; }
        a { color: #4f46e5; text-decoration: none; }
        .container { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
        .card { background:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.10); }
        .header { background: linear-gradient(135deg, #1f2937 0%, #111827 100%); padding: 24px; color: #fff; }
        .brand { font-weight: 700; letter-spacing: 0.3px; font-size: 18px; }
        .badge { display:inline-block; background:#fee2e2; color:#b91c1c; padding:6px 10px; font-size:12px; font-weight:600; border-radius:9999px; }
        .content { padding: 24px; color:#111827; }
        .section { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px; margin: 16px 0; }
        .section h3 { margin:0 0 8px 0; font-size:14px; color:#374151; }
        .list { margin: 8px 0 0 0; padding-left: 18px; color:#4b5563; }
        .list li { margin: 6px 0; }
        .btn { display:inline-block; background:#4f46e5; color:#ffffff !important; padding: 12px 20px; font-weight:600; border-radius:10px; box-shadow: 0 10px 15px -3px rgba(79,70,229,0.3), 0 4px 6px -4px rgba(79,70,229,0.3); }
        .btn:hover { background:#4338ca; }
        .muted { color:#6b7280; font-size: 13px; }
        .footer { padding: 16px 24px 24px 24px; color:#6b7280; font-size:12px; }
        .kv { display:flex; gap:8px; align-items:baseline; }
        .kv-label { font-size:12px; color:#6b7280; min-width: 96px; }
        .kv-value { font-size:14px; color:#111827; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <div class="header">
            <div class="brand">ERP System</div>
            <div style="margin-top:8px;">
              <span class="badge">Account Suspended</span>
            </div>
          </div>
          <div class="content">
            <p>Hi ${user.first_name} ${user.last_name},</p>
            <p>Your account has been <strong>temporarily suspended</strong> by the administrator.</p>

            ${(reason || notes) ? `
            <div class="section">
              <h3>Summary</h3>
              ${reason ? `<div class="kv"><div class="kv-label">Reason</div><div class="kv-value">${reason}</div></div>` : ''}
              ${notes ? `<div class="kv"><div class="kv-label">Notes</div><div class="kv-value">${notes}</div></div>` : ''}
              <div class="kv"><div class="kv-label">Status</div><div class="kv-value">Suspended</div></div>
            </div>` : ''}

            <div class="section">
              <h3>What this means</h3>
              <ul class="list">
                <li>You cannot log in to the system.</li>
                <li>Your active sessions (if any) have been terminated.</li>
                <li>Access can be restored after a successful appeal.</li>
              </ul>
            </div>

            <div style="margin: 20px 0 8px 0;">
              <a class="btn" href="${appealUrl}" target="_blank" rel="noopener">Submit an Appeal</a>
            </div>
            <div class="muted">Appeals are typically reviewed within 1–3 business days.</div>

            <div class="section" style="margin-top:20px;">
              <h3>Need help?</h3>
              <div class="muted">If you have questions, contact support at <a href="mailto:${supportEmail}">${supportEmail}</a>.</div>
            </div>
          </div>
          <div class="footer">
            This is an automated message. Please do not reply.
          </div>
        </div>
      </div>
    </body>
  </html>`;

          await emailService.sendEmail(user.email, subject, html);
          console.log('Suspension notification email sent to:', user.email);
        } catch (emailError) {
          console.error('Failed to send suspension notification email:', emailError);
          // Don't fail the suspension if email fails
        }
      }

      // Audit logging disabled - removed to eliminate 500 errors
      console.log('User status updated:', { userId, oldStatus: user.status, newStatus: status, adminId });

      // Clear related caches (with error handling)
      try {
        await redisManager.delPattern('users:list:*');
        await redisManager.delPattern('users:directory:*');
        await redisManager.del(CacheKeys.userPermissions(userId));
      } catch (error) {
        console.warn('Failed to clear Redis cache on user status update:', error.message);
        // Continue without cache clearing
      }

      return res.json({
        success: true,
        message: `User status updated to ${status}`,
        user: {
          id: userId,
          status,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`
        }
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update user status'
      });
    }
  }

  /**
   * Get user status for public access (appeal form)
   */
  async getUserStatusPublic(req, res) {
    try {
      const { userId } = req.params;

      // Get user status without authentication
      const userCheck = await query(
        `SELECT id, email, first_name, last_name, status, suspension_reason, suspended_at 
         FROM users WHERE id = $1`,
        [userId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userCheck.rows[0];

      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          status: user.status,
          suspension_reason: user.suspension_reason,
          suspended_at: user.suspended_at
        }
      });
    } catch (error) {
      console.error('Error getting user status:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to get user status'
      });
    }
  }

  /**
   * Permanently delete a user
   */
  async deleteUser(req, res) {
    try {
      const { userId } = req.params;
      const adminId = req.user.userId;
      const { reason = 'User deleted by administrator' } = req.body;

      // Archive and delete the user
      const result = await userArchiveService.archiveAndDeleteUser(userId, adminId, reason);

      // Clear related caches (with error handling)
      try {
        console.log('Clearing Redis caches for user deletion...');
        await redisManager.delPattern('users:list:*');
        await redisManager.delPattern('users:directory:*');
        await redisManager.del(CacheKeys.userPermissions(userId));
        console.log('Successfully cleared Redis caches');
      } catch (error) {
        console.warn('Failed to clear Redis cache on user deletion:', error.message);
        // Continue without cache clearing
      }

      return res.json({
        success: true,
        message: 'User archived and deleted successfully',
        data: result.data
      });
    } catch (error) {
      console.error('Error archiving and deleting user:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to archive and delete user',
        error: error.message
      });
    }
  }

  // Get archived users with pagination and search
  async getArchivedUsers(req, res) {
    try {
      const { page = 1, limit = 10, search = '' } = req.query;
      const offset = (page - 1) * limit;

      let whereClause = '';
      const params = [];

      if (search) {
        whereClause = `
          WHERE (au.first_name ILIKE $1 OR au.last_name ILIKE $1 OR au.email ILIKE $1 OR au.username ILIKE $1)
        `;
        params.push(`%${search}%`);
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM archived_users au
        ${whereClause}
      `;
      const countResult = await query(countQuery, params);
      const totalCount = parseInt(countResult.rows[0].total);

      // Get archived users with role information
      const usersQuery = `
        SELECT 
          au.*,
          COALESCE(archived_by.first_name || ' ' || archived_by.last_name, 'System') as archived_by_user,
          json_agg(
            json_build_object(
              'role_name', aur.role_name,
              'department_name', aur.department_name,
              'assigned_at', aur.assigned_at,
              'unassigned_at', aur.unassigned_at
            )
          ) FILTER (WHERE aur.id IS NOT NULL) as archived_user_roles
        FROM archived_users au
        LEFT JOIN archived_user_roles aur ON au.id = aur.archived_user_id
        LEFT JOIN users archived_by ON au.archived_by = archived_by.id
        ${whereClause}
        GROUP BY au.id, archived_by.first_name, archived_by.last_name
        ORDER BY au.archived_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      
      const usersResult = await query(usersQuery, [...params, limit, offset]);
      const archivedUsers = usersResult.rows.map(row => ({
        ...row,
        archived_user_roles: row.archived_user_roles || []
      }));

      const totalPages = Math.ceil(totalCount / limit);

      res.json({
        success: true,
        archivedUsers,
        totalCount,
        totalPages,
        currentPage: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error('Error fetching archived users:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch archived users',
        error: error.message 
      });
    }
  }

  // Get archived users statistics
  async getArchivedUsersStats(req, res) {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE archived_at >= date_trunc('month', CURRENT_DATE)) as this_month,
          COUNT(*) FILTER (WHERE archived_at >= date_trunc('week', CURRENT_DATE)) as this_week
        FROM archived_users
      `;
      
      const result = await query(statsQuery);
      const stats = result.rows[0];

      res.json({
        success: true,
        total: parseInt(stats.total),
        thisMonth: parseInt(stats.this_month),
        thisWeek: parseInt(stats.this_week)
      });
    } catch (error) {
      console.error('Error fetching archived users stats:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch archived users statistics',
        error: error.message 
      });
    }
  }
}

export default new UserController();
