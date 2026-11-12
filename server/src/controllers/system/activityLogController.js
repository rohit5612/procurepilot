import activityLogService from '../../services/system/activityLogService.js';

class ActivityLogController {
  /**
   * Get activity logs with filters
   */
  async getActivityLogs(req, res, next) {
    try {
      const filters = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
        user_id: req.query.user_id,
        activity_type: req.query.activity_type,
        module: req.query.module,
        feature: req.query.feature,
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        search: req.query.search
      };

      const result = await activityLogService.getActivityLogs(filters);

      // Log this activity
      await activityLogService.logActivity({
        user_id: req.user.id,
        username: req.user.full_name,
        activity_type: 'view',
        module: 'system',
        feature: 'activity_logs',
        action: 'viewed_activity_logs',
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        description: `Viewed activity logs`
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats(req, res, next) {
    try {
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date,
        user_id: req.query.user_id
      };

      const stats = await activityLogService.getActivityStats(filters);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get top active users
   */
  async getTopActiveUsers(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const filters = {
        start_date: req.query.start_date,
        end_date: req.query.end_date
      };

      const topUsers = await activityLogService.getTopActiveUsers(limit, filters);

      res.json(topUsers);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cleanup old activity logs
   * (Intended to be called from a scheduled job / admin-only endpoint)
   */
  async cleanupOldLogs(req, res, next) {
    try {
      const daysToKeep = req.query.days
        ? parseInt(req.query.days, 10)
        : 90;

      const deleted = await activityLogService.cleanupOldLogs(
        Number.isFinite(daysToKeep) && daysToKeep > 0 ? daysToKeep : 90
      );

      res.json({
        success: true,
        message: 'Activity logs cleanup completed',
        data: { deleted, daysToKeep: daysToKeep || 90 }
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ActivityLogController();

