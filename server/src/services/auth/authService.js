import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '../../database/connection.js';
import jwtService from './jwtService.js';
import emailService from './emailService.js';
import { PermissionService } from '../permissions/permissionService.js';
import { AdvancedPermissionService } from '../permissions/advancedPermissionService.js';
import redisManager, { CacheKeys, CacheTTL } from '../../config/redis.js';
import { writeAuditLog } from '../system/auditLogWriter.js';

/** Superuser (DB level 0) is exposed to clients as L1 org admin. */
function effectiveRoleLevel(user) {
  if (user?.is_superuser) return 1;
  return user?.role_level ?? null;
}

class AuthService {
  /**
   * Register a new user
   */
  async register(userData) {
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
    } = userData;

    try {
      // Check if user already exists by email
      const existingUserByEmail = await query(
        'SELECT id, email, approval_status FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      // If user exists and is not rejected, prevent registration
      if (existingUserByEmail.rows.length > 0) {
        const existingUser = existingUserByEmail.rows[0];
        if (existingUser.approval_status !== 'rejected') {
          throw new Error('User with this email already exists');
        }
        // If user is rejected, we'll update their record instead of creating a new one
      }

      // Check if username already exists (but allow rejected users to re-register)
      const existingUserByUsername = await query(
        'SELECT id, username, approval_status FROM users WHERE username = $1',
        [username.toLowerCase()]
      );

      if (existingUserByUsername.rows.length > 0) {
        const existingUser = existingUserByUsername.rows[0];
        if (existingUser.approval_status !== 'rejected') {
          throw new Error('Username already taken');
        }
      }

      // Check if mobile number already exists (but allow rejected users to re-register)
      if (mobileNumber) {
        const existingUserByMobile = await query(
          'SELECT id, mobile_number, approval_status FROM users WHERE mobile_number = $1',
          [mobileNumber]
        );

        if (existingUserByMobile.rows.length > 0) {
          const existingUser = existingUserByMobile.rows[0];
          if (existingUser.approval_status !== 'rejected') {
            throw new Error('Mobile number already registered');
          }
        }
      }

      // Check if aadhar card already exists (but allow rejected users to re-register)
      if (aadharCard) {
        const existingUserByAadhar = await query(
          'SELECT id, aadhar_card, approval_status FROM users WHERE aadhar_card = $1',
          [aadharCard]
        );

        if (existingUserByAadhar.rows.length > 0) {
          const existingUser = existingUserByAadhar.rows[0];
          if (existingUser.approval_status !== 'rejected') {
            throw new Error('Aadhar card number already registered');
          }
        }
      }

      // Check if employee ID already exists (but allow rejected users to re-register)
      if (employeeId) {
        const existingUserByEmployeeId = await query(
          'SELECT id, employee_id, approval_status FROM users WHERE employee_id = $1',
          [employeeId]
        );

        if (existingUserByEmployeeId.rows.length > 0) {
          const existingUser = existingUserByEmployeeId.rows[0];
          if (existingUser.approval_status !== 'rejected') {
            throw new Error('Employee ID already exists');
          }
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Generate email verification token
      const emailVerificationToken = uuidv4();
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Use provided firstName and lastName
      const firstNameClean = firstName.trim();
      const lastNameClean = lastName.trim();

      let user;

      // Check if we're updating a rejected user or creating a new one
      if (existingUserByEmail.rows.length > 0 && existingUserByEmail.rows[0].approval_status === 'rejected') {
        // Update existing rejected user
        const existingUserId = existingUserByEmail.rows[0].id;
        
        const userResult = await query(
          `UPDATE users SET 
            username = $1, password_hash = $2, first_name = $3, last_name = $4, full_name = $5,
            mobile_number = $6, aadhar_card = $7, employee_id = $8, designation = $9, date_of_birth = $10,
            captcha_token = $11, captcha_verified = $12, email_verification_token = $13, 
            email_verification_expires = $14, approval_status = 'pending', approved_by = NULL, 
            approved_at = NULL, rejection_reason = NULL, updated_at = NOW()
          WHERE id = $15
          RETURNING id, email, username, first_name, last_name, full_name, status, created_at`,
          [
            username.toLowerCase(),
            passwordHash,
            firstNameClean,
            lastNameClean,
            `${firstNameClean} ${lastNameClean}`,
            mobileNumber,
            aadharCard,
            employeeId,
            designation,
            dateOfBirth,
            captchaToken,
            true, // captcha_verified
            emailVerificationToken,
            emailVerificationExpires,
            existingUserId
          ]
        );

        user = userResult.rows[0];
      } else {
        // Create new user
        const userResult = await query(
          `INSERT INTO users (
            email, username, password_hash, first_name, last_name, full_name,
            mobile_number, aadhar_card, employee_id, designation, date_of_birth,
            captcha_token, captcha_verified, email_verification_token, email_verification_expires
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING id, email, username, first_name, last_name, full_name, status, created_at`,
          [
            email.toLowerCase(),
            username.toLowerCase(),
            passwordHash,
            firstNameClean,
            lastNameClean,
            `${firstNameClean} ${lastNameClean}`,
            mobileNumber,
            aadharCard,
            employeeId,
            designation,
            dateOfBirth,
            captchaToken,
            true, // captcha_verified
            emailVerificationToken,
            emailVerificationExpires
          ]
        );

        user = userResult.rows[0];
      }

      // Send verification email
      await emailService.sendVerificationEmail(email, emailVerificationToken);

      // Log the registration (different action for rejected user re-registration)
      const isRejectedUserUpdate = existingUserByEmail.rows.length > 0 && existingUserByEmail.rows[0].approval_status === 'rejected';
      const auditAction = isRejectedUserUpdate ? 'user_reregistered' : 'user_created';
      
      await this.logAuditEvent(user.id, auditAction, 'user', user.id, null, {
        email: user.email,
        username: user.username,
        full_name: user.full_name,
        mobile_number: mobileNumber,
        employee_id: employeeId,
        designation: designation,
        is_rejected_user_update: isRejectedUserUpdate
      });

      return {
        success: true,
        message: isRejectedUserUpdate 
          ? 'User re-registered successfully. Please check your email for verification.'
          : 'User registered successfully. Please check your email for verification.',
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.full_name,
          status: user.status
        }
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Login user
   */
  async login(emailOrUsername, password, ipAddress, userAgent) {
    try {
      // Determine if input is email or username
      const isEmail = emailOrUsername.includes('@');
      const queryField = isEmail ? 'u.email' : 'u.username';
      
      // Find user with role and department information
      const userResult = await query(
        `SELECT 
          u.id, u.email, u.username, u.password_hash, u.first_name, u.last_name, u.full_name,
          u.status, u.email_verified, u.is_superuser, u.login_count, u.approval_status,
          ur.role_id,
          r.name as role_name, r.role_level,
          d.id as department_id, d.name as department_name
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        LEFT JOIN departments d ON r.department_id = d.id AND d.is_active = true
        WHERE ${queryField} = $1`,
        [emailOrUsername.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        await this.logAuditEvent(null, 'login_failed', null, null, null, null, 
          ipAddress, userAgent, null, null, 'User not found', false, 'Invalid email/username or password');
        throw new Error('Invalid email/username or password');
      }

      const user = userResult.rows[0];

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        await this.logAuditEvent(user.id, 'login_failed', 'user', user.id, null, null,
          ipAddress, userAgent, null, null, 'Invalid password', false, 'Invalid email or password');
        throw new Error('Invalid email or password');
      }

      // Check if email is verified
      if (!user.email_verified) {
        throw new Error('Please verify your email before logging in');
      }

      // Check if user is approved (using new approval_status field)
      if (user.approval_status !== 'approved') {
        let message = 'Account is not approved';
        if (user.approval_status === 'pending') {
          message = 'Your account is pending admin approval. Please wait for approval before logging in.';
        } else if (user.approval_status === 'rejected') {
          message = 'Your account has been rejected. Please contact your administrator for more information.';
        }
        throw new Error(message);
      }

      // Check if user account is active
      if (user.status !== 'active') {
        let message = 'Account is not active';
        if (user.status === 'inactive') {
          message = 'Your account has been deactivated. Please contact your administrator to reactivate your account.';
        } else if (user.status === 'suspended') {
          message = 'Your account has been suspended. Please contact your administrator for more information.';
        }
        throw new Error(message);
      }

      // Check if user has been assigned department and role (for non-superusers)
      if (!user.is_superuser && (!user.department_id || !user.role_id)) {
        return {
          success: true,
          message: 'Login successful - Pending role assignment',
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            departmentId: user.department_id,
            departmentName: user.department_name,
            roleId: user.role_id,
            roleName: user.role_name,
            roleLevel: effectiveRoleLevel(user),
            isSuperuser: user.is_superuser,
            isFullyAssigned: false, // New flag to indicate assignment status
            permissions: {
              modules: [],
              features: {},
              dataScopes: {}
            }
          },
          tokens: jwtService.generateTokenPair({
            userId: user.id,
            email: user.email,
            departmentId: user.department_id,
            departmentName: user.department_name,
            roleId: user.role_id,
            roleName: user.role_name,
            roleLevel: effectiveRoleLevel(user),
            isFullyAssigned: false,
            permissions: {
              modules: [],
              features: {},
              dataScopes: {}
            }
          })
        };
      }

      // Get user permissions with Redis caching
      let permissions = {
        modules: [],
        features: {},
        dataScopes: {}
      };

      if (!user.is_superuser && user.role_id) {
        permissions = await AdvancedPermissionService.getUserPermissions(user.id, true);
      } else if (user.is_superuser) {
        // Superuser gets all permissions with Redis caching
        permissions = await AdvancedPermissionService.getSuperuserPermissions(true);
      }

      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        departmentId: user.department_id,
        departmentName: user.department_name,
        roleId: user.role_id,
        roleName: user.role_name,
        roleLevel: effectiveRoleLevel(user),
        isFullyAssigned: true, // User has department and role assigned
        permissions
      };

      const tokens = jwtService.generateTokenPair(tokenPayload);

      // Store session data in Redis (with error handling)
      try {
        const sessionData = {
          userId: user.id,
          email: user.email,
          username: user.username,
          loginTime: new Date().toISOString(),
          ipAddress,
          userAgent,
          permissions: permissions ? permissions.modules : []
        };

        await redisManager.set(
          CacheKeys.userSession(user.id),
          sessionData,
          CacheTTL.SESSION
        );
      } catch (error) {
        console.warn('Failed to store session in Redis:', error.message);
        // Continue without Redis session storage
      }

      // Update last login and login count
      await query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1 WHERE id = $1',
        [user.id]
      );

      // Log successful login
      await this.logAuditEvent(user.id, 'login', 'user', user.id, null, null,
        ipAddress, userAgent, null, null, 'Successful login');

      return {
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          departmentId: user.department_id,
          departmentName: user.department_name,
          roleId: user.role_id,
          roleName: user.role_name,
          roleLevel: effectiveRoleLevel(user),
          isSuperuser: user.is_superuser,
          isFullyAssigned: true, // User has department and role assigned
          permissions
        },
        tokens
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token) {
    try {
      const userResult = await query(
        `SELECT id, email, email_verification_expires 
         FROM users 
         WHERE email_verification_token = $1 AND email_verified = false`,
        [token]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid or expired verification token');
      }

      const user = userResult.rows[0];

      // Check if token is expired
      if (new Date() > new Date(user.email_verification_expires)) {
        throw new Error('Verification token has expired');
      }

      // Update user as verified
      await query(
        `UPDATE users 
         SET email_verified = true, 
             email_verification_token = NULL, 
             email_verification_expires = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id]
      );

      // Log email verification
      await this.logAuditEvent(user.id, 'email_verified', 'user', user.id);

      return {
        success: true,
        message: 'Email verified successfully'
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    try {
      const userResult = await query(
        'SELECT id, email, first_name FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if email exists or not
        return {
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent'
        };
      }

      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = uuidv4();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Update user with reset token
      await query(
        `UPDATE users 
         SET password_reset_token = $1, 
             password_reset_expires = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [resetToken, resetExpires, user.id]
      );

      // Send reset email
      await emailService.sendPasswordResetEmail(email, resetToken);

      // Log password reset request
      await this.logAuditEvent(user.id, 'password_reset_requested', 'user', user.id);

      return {
        success: true,
        message: 'If an account with this email exists, a password reset link has been sent'
      };
    } catch (error) {
      throw new Error(`Password reset request failed: ${error.message}`);
    }
  }

  /**
   * Reset password
   */
  async resetPassword(token, newPassword) {
    try {
      const userResult = await query(
        `SELECT id, email, password_reset_expires 
         FROM users 
         WHERE password_reset_token = $1`,
        [token]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid or expired reset token');
      }

      const user = userResult.rows[0];

      // Check if token is expired
      if (new Date() > new Date(user.password_reset_expires)) {
        throw new Error('Reset token has expired');
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password and clear reset token
      await query(
        `UPDATE users 
         SET password_hash = $1,
             password_reset_token = NULL,
             password_reset_expires = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [passwordHash, user.id]
      );

      // Log password reset completion
      await this.logAuditEvent(user.id, 'password_reset_completed', 'user', user.id);

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const verificationResult = jwtService.verifyRefreshToken(refreshToken);
      
      if (!verificationResult.success) {
        throw new Error('Invalid refresh token');
      }

      const { userId } = verificationResult.decoded;

      // Get current user data with permissions
      const userResult = await query(
        `SELECT 
          u.id, u.email, u.first_name, u.last_name, u.status, u.is_superuser,
          ur.role_id,
          r.name as role_name, r.role_level,
          d.id as department_id, d.name as department_name
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        LEFT JOIN departments d ON r.department_id = d.id AND d.is_active = true
        WHERE u.id = $1 AND u.status = 'active'`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found or not approved');
      }

      const user = userResult.rows[0];

      // Get fresh permissions
      let permissions = {
        modules: [],
        features: {},
        dataScopes: {}
      };

      if (!user.is_superuser && user.role_id) {
        permissions = await PermissionService.getUserPermissions(user.id);
      } else if (user.is_superuser) {
        permissions = await PermissionService.getSuperuserPermissions();
      }

      // Generate new access token
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        departmentId: user.department_id,
        departmentName: user.department_name,
        roleId: user.role_id,
        roleName: user.role_name,
        roleLevel: effectiveRoleLevel(user),
        permissions
      };

      const accessToken = jwtService.generateAccessToken(tokenPayload);

      return {
        success: true,
        accessToken,
        expiresIn: jwtService.jwtConfig.expiresIn
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Logout user (invalidate tokens and clear Redis session)
   */
  async logout(userId) {
    try {
      // Clear Redis session (with error handling)
      try {
        await redisManager.del(CacheKeys.userSession(userId));
        await redisManager.del(CacheKeys.userPermissions(userId));
      } catch (error) {
        console.warn('Failed to clear Redis cache on logout:', error.message);
        // Continue without Redis cache clearing
      }

      // Log logout
      await this.logAuditEvent(userId, 'logout', 'user', userId);

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Log audit event (persists to audit_logs via DB function)
   */
  async logAuditEvent(userId, action, resourceType, resourceId, oldValues, newValues,
                     ipAddress, userAgent, requestMethod, requestPath, description,
                     success = true, errorMessage = null, metadata = null) {
    try {
      await writeAuditLog({
        userId: userId || null,
        action,
        resourceType: resourceType || null,
        resourceId: resourceId || null,
        oldValues: oldValues || null,
        newValues: newValues || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        requestMethod: requestMethod || null,
        requestPath: requestPath || null,
        requestQuery: null,
        description: description || null,
        success,
        errorMessage: errorMessage || null,
        metadata: metadata || null
      });
    } catch (e) {
      // Do not block main flow on audit failures
      console.warn('Audit log failed:', e.message);
    }
  }
}

export default new AuthService();
