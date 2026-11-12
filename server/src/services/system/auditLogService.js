import { query } from '../../database/connection.js';

async function tableExists(tableName) {
  const { rows } = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return !!rows?.[0]?.exists;
}

class AuditLogService {
  /**
   * Get audit logs with pagination and filters
   */
  async getAuditLogs(filters = {}) {
    try {
      const exists = await tableExists('audit_logs');
      if (!exists) {
        return {
          data: [],
          pagination: {
            page: filters.page || 1,
            limit: filters.limit || 50,
            total: 0,
            totalPages: 0
          }
        };
      }

      const {
        page = 1,
        limit = 50,
        user_id,
        action,
        resource_type,
        success,
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
        conditions.push(`a.user_id = $${paramCount}`);
        params.push(user_id);
      }

      if (action) {
        paramCount++;
        conditions.push(`a.action = $${paramCount}`);
        params.push(action);
      }

      if (resource_type) {
        paramCount++;
        conditions.push(`a.resource_type = $${paramCount}`);
        params.push(resource_type);
      }

      if (typeof success === 'boolean') {
        paramCount++;
        conditions.push(`a.success = $${paramCount}`);
        params.push(success);
      }

      if (start_date) {
        paramCount++;
        conditions.push(`a.created_at >= $${paramCount}`);
        params.push(start_date);
      }

      if (end_date) {
        paramCount++;
        conditions.push(`a.created_at <= $${paramCount}`);
        params.push(end_date);
      }

      if (search) {
        paramCount++;
        conditions.push(`(a.description ILIKE $${paramCount} OR a.request_path ILIKE $${paramCount})`);
        params.push(`%${search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM audit_logs a
        ${whereClause}
      `, params);
      const total = parseInt(countResult.rows[0].total);

      // Get paginated data with user details
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT 
          a.id, a.user_id, a.session_id, a.action, a.resource_type, a.resource_id,
          a.old_values, a.new_values, a.ip_address, a.user_agent,
          a.request_method, a.request_path, a.request_query,
          a.success, a.error_message, a.duration_ms,
          a.description, a.metadata, a.created_at,
          u.full_name as user_name, u.email as user_email
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        ${whereClause}
        ORDER BY a.created_at DESC
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
      console.error('Error fetching audit logs:', error);
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(filters = {}) {
    try {
      const exists = await tableExists('audit_logs');
      if (!exists) {
        return {
          total_actions: 0,
          unique_users: 0,
          successful_actions: 0,
          failed_actions: 0,
          creates: 0,
          updates: 0,
          deletes: 0,
          avg_duration_ms: null
        };
      }

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
          COUNT(*) as total_actions,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(*) FILTER (WHERE success = true) as successful_actions,
          COUNT(*) FILTER (WHERE success = false) as failed_actions,
          COUNT(*) FILTER (WHERE action = 'CREATE') as creates,
          COUNT(*) FILTER (WHERE action = 'UPDATE') as updates,
          COUNT(*) FILTER (WHERE action = 'DELETE') as deletes,
          AVG(duration_ms) as avg_duration_ms
        FROM audit_logs
        ${whereClause}
      `, params);

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching audit stats:', error);
      throw new Error(`Failed to fetch audit stats: ${error.message}`);
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(id) {
    try {
      const exists = await tableExists('audit_logs');
      if (!exists) {
        throw new Error('Audit log not found');
      }

      const result = await query(`
        SELECT 
          a.*,
          u.full_name as user_name,
          u.email as user_email
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        WHERE a.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        throw new Error('Audit log not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error fetching audit log:', error);
      throw new Error(`Failed to fetch audit log: ${error.message}`);
    }
  }
}

export default new AuditLogService();

