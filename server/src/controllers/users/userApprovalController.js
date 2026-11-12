import { validationResult } from 'express-validator';
import userService from '../../services/users/userService.js';

class UserApprovalController {
  /**
   * Get all users with approval status
   */
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10, status, search } = req.query;
      
      const result = await userService.getAllUsersWithApprovalStatus({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        search
      });

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get pending users for approval
   */
  async getPendingUsers(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      
      const result = await userService.getPendingUsers({
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Approve a user
   */
  async approveUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { approvedBy } = req.body;

      const result = await userService.approveUser(userId, approvedBy);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Reject a user
   */
  async rejectUser(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { userId } = req.params;
      const { rejectedBy, rejectionReason } = req.body;

      const result = await userService.rejectUser(userId, rejectedBy, rejectionReason);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get user approval statistics
   */
  async getApprovalStats(req, res) {
    try {
      const stats = await userService.getApprovalStatistics();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new UserApprovalController();
