import { query, transaction } from '../../database/connection.js';

class UserArchiveService {
  /**
   * Archive and delete a user
   */
  async archiveAndDeleteUser(userId, archivedBy, reason) {
    try {
      const { archivedUserId, user } = await transaction(async (client) => {
        // Check if user exists and can be archived
        const userCheck = await client.query(
          `SELECT id, email, first_name, last_name, is_protected, is_superuser 
           FROM users WHERE id = $1`,
          [userId]
        );

        if (userCheck.rows.length === 0) {
          throw new Error('User not found');
        }

        const foundUser = userCheck.rows[0];

        // Cannot archive protected accounts
        if (foundUser.is_protected) {
          throw new Error('Cannot archive protected admin accounts');
        }

        // Cannot archive superuser
        if (foundUser.is_superuser) {
          throw new Error('Cannot archive superuser account');
        }

        // Archive the user using our database function
        const result = await client.query(
          'SELECT archive_user($1, $2, $3) as archived_user_id',
          [userId, archivedBy, reason]
        );

        return {
          archivedUserId: result.rows[0].archived_user_id,
          user: foundUser,
        };
      });

      return {
        success: true,
        message: 'User archived successfully',
        data: {
          originalUserId: userId,
          archivedUserId: archivedUserId,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`
        }
      };
    } catch (error) {
      throw new Error(`Failed to archive user: ${error.message}`);
    }
  }

  /**
   * Get archived user details
   */
  async getArchivedUser(archivedUserId) {
    try {
      const result = await query(
        `SELECT 
          au.*,
          aur.role_name,
          aur.department_name,
          aur.assigned_at as last_role_assigned_at,
          aur.unassigned_at as last_role_unassigned_at
        FROM archived_users au
        LEFT JOIN archived_user_roles aur ON au.id = aur.archived_user_id
        WHERE au.id = $1`,
        [archivedUserId]
      );

      if (result.rows.length === 0) {
        throw new Error('Archived user not found');
      }

      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get archived user: ${error.message}`);
    }
  }

  /**
   * Search archived users
   */
  async searchArchivedUsers({ page = 1, limit = 10, search = '', fromDate, toDate }) {
    try {
      const offset = (page - 1) * limit;
      let whereConditions = ['1=1'];
      const queryParams = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        whereConditions.push(
          `(email ILIKE $${paramCount} OR 
            username ILIKE $${paramCount} OR 
            first_name ILIKE $${paramCount} OR 
            last_name ILIKE $${paramCount})`
        );
        queryParams.push(`%${search}%`);
      }

      if (fromDate) {
        paramCount++;
        whereConditions.push(`archived_at >= $${paramCount}`);
        queryParams.push(fromDate);
      }

      if (toDate) {
        paramCount++;
        whereConditions.push(`archived_at <= $${paramCount}`);
        queryParams.push(toDate);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(
        `SELECT COUNT(*) as total FROM archived_users WHERE ${whereClause}`,
        queryParams
      );

      // Get archived users
      const usersResult = await query(
        `SELECT 
          au.*,
          u.email as archived_by_email,
          u.first_name as archived_by_first_name,
          u.last_name as archived_by_last_name
        FROM archived_users au
        LEFT JOIN users u ON au.archived_by = u.id
        WHERE ${whereClause}
        ORDER BY au.archived_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...queryParams, limit, offset]
      );

      return {
        users: usersResult.rows,
        pagination: {
          total: parseInt(countResult.rows[0].total),
          page,
          limit,
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to search archived users: ${error.message}`);
    }
  }

  /**
   * Get archival statistics
   */
  async getArchivalStatistics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_archived,
          COUNT(CASE WHEN archived_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as archived_last_24h,
          COUNT(CASE WHEN archived_at >= NOW() - INTERVAL '7 days' THEN 1 END) as archived_last_7d,
          COUNT(CASE WHEN archived_at >= NOW() - INTERVAL '30 days' THEN 1 END) as archived_last_30d,
          MIN(archived_at) as first_archival_date,
          MAX(archived_at) as last_archival_date
        FROM archived_users
      `);

      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get archival statistics: ${error.message}`);
    }
  }
}

export default new UserArchiveService();
