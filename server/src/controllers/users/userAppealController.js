import userAppealService from '../../services/users/userAppealService.js';
import { query } from '../../database/connection.js';

class UserAppealController {
  /**
   * Submit a new appeal (public endpoint - no auth required)
   */
  async submitAppeal(req, res) {
    try {
      const { userId } = req.params;
      const { reason, details } = req.body;

      // Validate input
      if (!reason || !details) {
        return res.status(400).json({
          success: false,
          message: 'Appeal reason and details are required'
        });
      }

      if (reason.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Appeal reason must be at least 10 characters long'
        });
      }

      if (details.length < 20) {
        return res.status(400).json({
          success: false,
          message: 'Appeal details must be at least 20 characters long'
        });
      }

      const result = await userAppealService.submitAppeal(userId, {
        reason: reason.trim(),
        details: details.trim()
      });

      res.status(201).json(result);
    } catch (error) {
      console.error('Submit appeal error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get all appeals (admin only)
   */
  async getAllAppeals(req, res) {
    try {
      const { page = 1, limit = 10, search = '', status = 'all' } = req.query;
      const offset = (page - 1) * limit;

      const filters = {
        search,
        status,
        limit: parseInt(limit),
        offset
      };

      const appeals = await userAppealService.getAllAppeals(filters);
      const stats = await userAppealService.getAppealsStats();

      res.json({
        success: true,
        message: 'Appeals retrieved successfully',
        data: appeals,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: stats.total_appeals
        }
      });
    } catch (error) {
      console.error('Get all appeals error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve appeals',
        error: error.message
      });
    }
  }

  /**
   * Get appeal by ID (admin only)
   */
  async getAppealById(req, res) {
    try {
      const { appealId } = req.params;
      const appeal = await userAppealService.getAppealById(appealId);

      res.json({
        success: true,
        message: 'Appeal retrieved successfully',
        data: appeal
      });
    } catch (error) {
      console.error('Get appeal by ID error:', error);
      
      if (error.message === 'Appeal not found') {
        return res.status(404).json({
          success: false,
          message: 'Appeal not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve appeal',
        error: error.message
      });
    }
  }

  /**
   * Review an appeal (admin only)
   */
  async reviewAppeal(req, res) {
    try {
      const { appealId } = req.params;
      const { status, notes } = req.body;
      const adminId = req.user.userId;

      // Validate input
      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status (approved or rejected) is required'
        });
      }

      const result = await userAppealService.reviewAppeal(appealId, adminId, {
        status,
        notes: notes || ''
      });

      res.json(result);
    } catch (error) {
      console.error('Review appeal error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get appeal statistics (admin only)
   */
  async getAppealStats(req, res) {
    try {
      const stats = await userAppealService.getAppealsStats();

      res.json({
        success: true,
        message: 'Appeal statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Get appeal stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve appeal statistics',
        error: error.message
      });
    }
  }

  /**
   * Check if user has pending appeal (public endpoint)
   */
  async checkPendingAppeal(req, res) {
    try {
      const { userId } = req.params;

      // Check if user exists and is suspended
      const userResult = await query(
        'SELECT id, status FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const user = userResult.rows[0];
      if (user.status !== 'suspended') {
        return res.json({
          success: true,
          hasPendingAppeal: false,
          message: 'User is not suspended'
        });
      }

      // Check for pending appeal
      const appealResult = await query(
        'SELECT id FROM user_appeals WHERE user_id = $1 AND status = $2',
        [userId, 'pending']
      );

      const hasPendingAppeal = appealResult.rows.length > 0;

      res.json({
        success: true,
        hasPendingAppeal,
        message: hasPendingAppeal ? 'User has a pending appeal' : 'No pending appeal found'
      });
    } catch (error) {
      console.error('Check pending appeal error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to check appeal status',
        error: error.message
      });
    }
  }
}

export default new UserAppealController();
