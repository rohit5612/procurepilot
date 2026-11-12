import { query } from '../../database/connection.js';

class ErrorLogService {
  /**
   * Create error log entry
   */
  async logError(data) {
    // Temporarily disable error logging (no-op)
    return null;

    /* Original implementation retained for future re‑enable:
    try {
      const result = await query(
        `
        INSERT INTO error_logs (
          error_level,
          error_type,
          error_code,
          error_message,
          error_stack,
          module,
          feature,
          function_name,
          line_number,
          user_id,
          username,
          ip_address,
          user_agent,
          request_method,
          request_path,
          request_body,
          metadata,
          is_resolved,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3,
          $4, $5,
          $6, $7,
          $8, $9,
          $10, $11,
          $12, $13,
          $14, $15,
          $16,
          $17,
          false,
          NOW(),
          NOW()
        )
        RETURNING id
      `,
        [
          data.error_level || 'error',
          data.error_type || 'application',
          data.error_code || null,
          data.error_message,
          data.error_stack || null,
          data.module || null,
          data.feature || null,
          data.function_name || null,
          data.line_number || null,
          data.user_id || null,
          data.username || null,
          data.ip_address || null,
          data.user_agent || null,
          data.request_method || null,
          data.request_path || null,
          data.request_body ? JSON.stringify(data.request_body) : null,
          data.metadata ? JSON.stringify(data.metadata) : null
        ]
      );

      return result.rows[0]?.id || null;
    } catch (error) {
      console.error('Error logging error (meta!):', error);
      // Don't throw - error logging should not break the application
      return null;
    }
    */
  }

  /**
   * Get error logs with pagination and filters
   */
  async getErrorLogs(filters = {}) {
    try {
      const {
        page = 1,
        limit = 50,
        error_level,
        error_type,
        module,
        is_resolved,
        start_date,
        end_date,
        search
      } = filters;

      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];
      let paramCount = 0;

      if (error_level) {
        paramCount++;
        conditions.push(`error_level = $${paramCount}`);
        params.push(error_level);
      }

      if (error_type) {
        paramCount++;
        conditions.push(`error_type = $${paramCount}`);
        params.push(error_type);
      }

      if (module) {
        paramCount++;
        conditions.push(`module = $${paramCount}`);
        params.push(module);
      }

      if (typeof is_resolved === 'boolean') {
        paramCount++;
        conditions.push(`is_resolved = $${paramCount}`);
        params.push(is_resolved);
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
        conditions.push(`(error_message ILIKE $${paramCount} OR error_code ILIKE $${paramCount} OR function_name ILIKE $${paramCount})`);
        params.push(`%${search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total FROM error_logs ${whereClause}
      `, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT 
          id, error_level, error_type, error_code, error_message, error_stack,
          module, feature, function_name, line_number,
          user_id, username, ip_address, user_agent,
          request_method, request_path, request_body, metadata,
          is_resolved, resolved_at, resolved_by, resolution_notes,
          created_at, updated_at
        FROM error_logs
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
      console.error('Error fetching error logs:', error);
      throw new Error(`Failed to fetch error logs: ${error.message}`);
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(filters = {}) {
    try {
      const { start_date, end_date } = filters;
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

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await query(`
        SELECT 
          COUNT(*) as total_errors,
          COUNT(*) FILTER (WHERE error_level = 'critical') as critical_errors,
          COUNT(*) FILTER (WHERE error_level = 'error') as errors,
          COUNT(*) FILTER (WHERE error_level = 'warning') as warnings,
          COUNT(*) FILTER (WHERE is_resolved = true) as resolved_errors,
          COUNT(*) FILTER (WHERE is_resolved = false) as unresolved_errors
        FROM error_logs
        ${whereClause}
      `, params);

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching error stats:', error);
      throw new Error(`Failed to fetch error stats: ${error.message}`);
    }
  }

  /**
   * Resolve an error
   */
  async resolveError(errorId, userId, resolutionNotes) {
    try {
      const result = await query(`
        UPDATE error_logs
        SET 
          is_resolved = true,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = $1,
          resolution_notes = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [userId, resolutionNotes, errorId]);

      if (result.rows.length === 0) {
        throw new Error('Error log not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error resolving error log:', error);
      throw new Error(`Failed to resolve error: ${error.message}`);
    }
  }

  /**
   * Delete old error logs (cleanup)
   */
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const result = await query(
        `
        DELETE FROM error_logs
        WHERE created_at < CURRENT_DATE - INTERVAL '${daysToKeep} days'
      `
      );

      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old error logs:', error);
      throw new Error(`Failed to cleanup old logs: ${error.message}`);
    }
  }
}

export default new ErrorLogService();

