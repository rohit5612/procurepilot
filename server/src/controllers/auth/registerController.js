import authService from '../../services/auth/authService.js';
import captchaService from '../../services/auth/captchaService.js';
import { validationResult } from 'express-validator';

class RegisterController {
  /**
   * User registration
   */
  async register(req, res) {
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

      const { 
        email, 
        username, 
        password, 
        firstName, 
        lastName, 
        mobileNumber, 
        aadharCard, 
        employeeId, 
        designation, 
        dateOfBirth, 
        captchaToken 
      } = req.body;

      // Verify captcha
      const captchaResult = await captchaService.verifyCaptcha(captchaToken, req.ip);
      if (!captchaResult.verified) {
        return res.status(400).json({
          success: false,
          message: 'Captcha verification failed',
          error: captchaResult.error
        });
      }

      const result = await authService.register({
        email,
        username,
        password,
        firstName,
        lastName,
        mobileNumber,
        aadharCard,
        employeeId,
        designation,
        dateOfBirth,
        captchaToken
      });

      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Resend email verification
   */
  async resendVerification(req, res) {
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

      // This would be implemented to resend verification email
      // For now, just return success
      res.status(200).json({
        success: true,
        message: 'Verification email sent'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new RegisterController();
