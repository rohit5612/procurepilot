import errorLogService from '../../services/system/errorLogService.js';
import activityLogService from '../../services/system/activityLogService.js';

class ErrorLogController {
  /**
   * Get error logs with filters
   */
  async getErrorLogs(req, res, next) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        error_level: req.query.error_level,
        error_type: req.query.error_type,
        module: req.query.module,
        is_resolved: req.query.is_resolved === 'true' ? true : req.query.is_resolved === 'false' ? false : undefined,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        search: req.query.search
      };

      const result = await errorLogService.getErrorLogs(filters);

      // Log this activity
      await activityLogService.logActivity({
        user_id: req.user.id,
        username: req.user.full_name,
        activity_type: 'view',
        module: 'system',
        feature: 'error_logs',
        action: 'viewed_error_logs',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        description: `Viewed error logs`
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(req, res, next) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const stats = await errorLogService.getErrorStats(filters);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Resolve an error
   */
  async resolveError(req, res, next) {
    try {
      const { id } = req.params;
      const { resolution_notes } = req.body;

      const result = await errorLogService.resolveError(
        parseInt(id),
        req.user.id,
        resolution_notes
      );

      // Log this activity
      await activityLogService.logActivity({
        user_id: req.user.id,
        username: req.user.full_name,
        activity_type: 'update',
        module: 'system',
        feature: 'error_logs',
        action: 'resolved_error',
        resource_type: 'error_log',
        resource_id: parseInt(id),
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        description: `Resolved error log #${id}`
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

export default new ErrorLogController();

