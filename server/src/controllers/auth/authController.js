import authService from '../../services/auth/authService.js';
import activityLogService from '../../services/system/activityLogService.js';
import { validationResult } from 'express-validator';

class AuthController {
  /**
   * User login
   */
  async login(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { emailOrUsername, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      const result = await authService.login(emailOrUsername, password, ipAddress, userAgent);

      // Activity log for successful login (non-blocking)
      try {
        if (result?.success && result?.user?.id) {
          await activityLogService.logActivity({
            user_id: result.user.id,
            username: result.user.fullName,
            activity_type: 'login',
            module: 'system',
            feature: 'auth',
            action: 'login_success',
            resource_type: 'user',
            resource_id: result.user.id,
            resource_name: result.user.email,
            ip_address: ipAddress,
            user_agent: userAgent,
            description: 'User logged in'
          });
        }
      } catch (_) {}

      res.status(200).json(result);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * User logout
   */
  async logout(req, res) {
    try {
      const userId = req.user?.id;

      if (userId) {
        await authService.logout(userId);
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { refreshToken } = req.body;

      const result = await authService.refreshToken(refreshToken);

      res.status(200).json(result);
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get current user profile
   */
  async me(req, res) {
    try {
      res.status(200).json({
        success: true,
        user: req.user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get user profile'
      });
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { token } = req.body;

      const result = await authService.verifyEmail(token);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Verify email redirect (for frontend)
   */
  async verifyEmailRedirect(req, res) {
    try {
      const { token } = req.params;

      await authService.verifyEmail(token);

      // Redirect to frontend success page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/email-verification-success`);
    } catch (error) {
      // Redirect to error page or login with error message
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login?error=verification_failed&message=${encodeURIComponent(error.message)}`);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { email } = req.body;

      const result = await authService.requestPasswordReset(email);

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Reset password
   */
  async resetPassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { token, password } = req.body;

      const result = await authService.resetPassword(token, password);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new AuthController();
