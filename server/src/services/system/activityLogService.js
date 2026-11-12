import { query } from '../../database/connection.js';

class ActivityLogService {
  /**
   * Create activity log entry
   * NOTE: Best-effort only – failures should never break main flow.
   */
  async logActivity(data) {
    // Temporarily disable activity logging (no-op)
    return null;

    /* Original implementation retained for future re‑enable:
    try {
      const result = await query(
        `
        INSERT INTO activity_logs (
          user_id,
          username,
          activity_type,
          module,
          feature,
          action,
          resource_type,
          resource_id,
          resource_name,
          ip_address,
          user_agent,
          request_method,
          request_path,
          description,
          metadata,
          created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11,
          $12, $13,
          $14, $15,
          NOW()
        )
        RETURNING id
      `,
        [
          data.user_id || null,
          data.username || null,
          data.activity_type,
          data.module || null,
          data.feature || null,
          data.action || null,
          data.resource_type || null,
          data.resource_id || null,
          data.resource_name || null,
          data.ip_address || null,
          data.user_agent || null,
          data.request_method || null,
          data.request_path || null,
          data.description || null,
          data.metadata ? JSON.stringify(data.metadata) : null
        ]
      );

      return result.rows[0]?.id || null;
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw - logging should not break the application
      return null;
    }
    */
  }

  /**
   * Get activity logs with pagination and filters
   */
  async getActivityLogs(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        user_id,
        activity_type,
        module,
        feature,
        start_date,
        end_date,
        search
      } = filters;

      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];
      let paramCount = 0;

      if (user_id) {
        paramCount++;
        conditions.push(`user_id = $${paramCount}`);
        params.push(user_id);
      }

      if (activity_type) {
        paramCount++;
        conditions.push(`activity_type = $${paramCount}`);
        params.push(activity_type);
      }

      if (module) {
        paramCount++;
        conditions.push(`module = $${paramCount}`);
        params.push(module);
      }

      if (feature) {
        paramCount++;
        conditions.push(`feature = $${paramCount}`);
        params.push(feature);
      }

      if (start_date) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        params.push(end_date);
      }

      if (search) {
        paramCount++;
        conditions.push(`(username ILIKE $${paramCount} OR description ILIKE $${paramCount} OR resource_name ILIKE $${paramCount})`);
        params.push(`%${search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM activity_logs ${whereClause}
      `, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT 
          id, user_id, username, activity_type, module, feature, action,
          resource_type, resource_id, resource_name,
          ip_address, user_agent, request_method, request_path,
          description, metadata, created_at
        FROM activity_logs
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);

      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw new Error(`Failed to fetch activity logs: ${error.message}`);
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(filters = {}) {
    try {
      const { start_date, end_date, user_id } = filters;
      const conditions = [];
      const params = [];
      let paramCount = 0;

      if (start_date) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        params.push(end_date);
      }

      if (user_id) {
        paramCount++;
        conditions.push(`user_id = $${paramCount}`);
        params.push(user_id);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await query(`
        SELECT 
          COUNT(*) as total_activities,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT DATE(created_at)) as active_days,
          COUNT(*) FILTER (WHERE activity_type = 'login') as logins,
          COUNT(*) FILTER (WHERE activity_type = 'export') as exports,
          COUNT(*) FILTER (WHERE module = 'procurement') as procurement_activities,
          COUNT(*) FILTER (WHERE module = 'inventory') as inventory_activities
        FROM activity_logs
        ${whereClause}
      `, params);

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      throw new Error(`Failed to fetch activity stats: ${error.message}`);
    }
  }

  /**
   * Get top active users
   */
  async getTopActiveUsers(limit = 10, filters = {}) {
    try {
      const { start_date, end_date } = filters;
      const conditions = ['user_id IS NOT NULL'];
      const params = [];
      let paramCount = 0;

      if (start_date) {
        paramCount++;
        conditions.push(`created_at >= $${paramCount}`);
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        conditions.push(`created_at <= $${paramCount}`);
        params.push(end_date);
      }

      paramCount++;
      params.push(limit);

      const result = await query(`
        SELECT 
          user_id,
          username,
          COUNT(*) as activity_count,
          MAX(created_at) as last_activity
        FROM activity_logs
        WHERE ${conditions.join(' AND ')}
        GROUP BY user_id, username
        ORDER BY activity_count DESC
        LIMIT $${paramCount}
      `, params);

      return result.rows;
    } catch (error) {
      console.error('Error fetching top active users:', error);
      throw new Error(`Failed to fetch top active users: ${error.message}`);
    }
  }

  /**
   * Delete old activity logs (cleanup)
   * @param {number} daysToKeep - Number of days to retain logs (default: 90)
   * @returns {Promise<number>} Number of rows deleted
   */
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const result = await query(
        `
        DELETE FROM activity_logs
        WHERE created_at < CURRENT_DATE - INTERVAL '${daysToKeep} days'
      `
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old activity logs:', error);
      throw new Error(`Failed to cleanup old activity logs: ${error.message}`);
    }
  }
}

export default new ActivityLogService();

