import auditLogService from '../../services/system/auditLogService.js';
import activityLogService from '../../services/system/activityLogService.js';

class AuditLogController {
  /**
   * Get audit logs with filters
   */
  async getAuditLogs(req, res, next) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        user_id: req.query.user_id,
        action: req.query.action,
        resource_type: req.query.resource_type,
        success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        search: req.query.search
      };

      const result = await auditLogService.getAuditLogs(filters);

      // Log this activity
      await activityLogService.logActivity({
        user_id: req.user.id,
        username: req.user.full_name,
        activity_type: 'view',
        module: 'system',
        feature: 'audit_logs',
        action: 'viewed_audit_logs',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        description: `Viewed audit logs`
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStats(req, res, next) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        user_id: req.query.user_id
      };

      const stats = await auditLogService.getAuditStats(filters);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get audit log by ID
   */
  async getAuditLogById(req, res, next) {
    try {
      const { id } = req.params;
      const auditLog = await auditLogService.getAuditLogById(parseInt(id));

      res.json(auditLog);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuditLogController();

