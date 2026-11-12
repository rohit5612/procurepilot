import { body } from 'express-validator';

// Login validation (supports email or username)
export const loginValidation = [
  body('emailOrUsername')
    .notEmpty()
    .withMessage('Email or username is required')
    .custom((value) => {
      // Check if it's an email format or username format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const usernameRegex = /^[a-zA-Z0-9_]{3,50}$/;
      
      if (!emailRegex.test(value) && !usernameRegex.test(value)) {
        throw new Error('Please provide a valid email address or username (3-50 characters, letters, numbers, underscore only)');
      }
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Registration validation
export const registrationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('First name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('First name can only contain letters and spaces'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Last name must be between 1 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Last name can only contain letters and spaces'),
  body('mobileNumber')
    .trim()
    .matches(/^[+]?[1-9][\d\s\-()]{7,20}$/)
    .withMessage('Please provide a valid mobile number'),
  body('aadharCard')
    .trim()
    .matches(/^[0-9]{12}$/)
    .withMessage('Aadhar card number must be exactly 12 digits'),
  body('employeeId')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Employee ID must be between 1 and 50 characters'),
  body('designation')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Designation must be between 1 and 100 characters'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Please provide a valid date of birth')
    .custom((value) => {
      const dob = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 18 || age > 100) {
        throw new Error('Date of birth must be for a person between 18 and 100 years old');
      }
      return true;
    }),
  body('captchaToken')
    .notEmpty()
    .withMessage('Captcha verification is required')
];

// Email verification validation
export const emailVerificationValidation = [
  body('token')
    .notEmpty()
    .withMessage('Verification token is required')
    .isUUID()
    .withMessage('Invalid verification token format')
];

// Password reset request validation
export const passwordResetRequestValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

// Password reset validation
export const passwordResetValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isUUID()
    .withMessage('Invalid reset token format'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

// Refresh token validation
export const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Resend verification validation
export const resendVerificationValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];
