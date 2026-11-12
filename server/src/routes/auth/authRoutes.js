import express from 'express';
import authController from '../../controllers/auth/authController.js';
import registerController from '../../controllers/auth/registerController.js';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth/authMiddleware.js';
import { authRateLimit, passwordResetRateLimit } from '../../config/rateLimit.js';
import {
  loginValidation,
  registrationValidation,
  emailVerificationValidation,
  passwordResetRequestValidation,
  passwordResetValidation,
  refreshTokenValidation,
  resendVerificationValidation
} from '../../middleware/validation/authValidation.js';

const router = express.Router();

// Public routes (no authentication required)

// User registration
router.post('/register', 
  authRateLimit,
  registrationValidation,
  registerController.register
);

// User login
router.post('/login',
  authRateLimit,
  loginValidation,
  authController.login
);

// Email verification (POST for API)
router.post('/verify-email',
  emailVerificationValidation,
  authController.verifyEmail
);

// Email verification (GET for frontend redirect)
router.get('/verify-email/:token',
  authController.verifyEmailRedirect
);

// Password reset request
router.post('/forgot-password',
  passwordResetRateLimit,
  passwordResetRequestValidation,
  authController.requestPasswordReset
);

// Password reset
router.post('/reset-password',
  passwordResetValidation,
  authController.resetPassword
);

// Refresh token
router.post('/refresh-token',
  refreshTokenValidation,
  authController.refreshToken
);

// Resend email verification
router.post('/resend-verification',
  authRateLimit,
  resendVerificationValidation,
  registerController.resendVerification
);

// Protected routes (authentication required)

// Get current user profile
router.get('/me',
  authMiddleware,
  authController.me
);

// User logout
router.post('/logout',
  optionalAuthMiddleware,
  authController.logout
);

export default router;
