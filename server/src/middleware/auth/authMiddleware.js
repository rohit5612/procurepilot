import jwtService from '../../services/auth/jwtService.js';
import { query } from '../../database/connection.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user data to request
 */
export const authMiddleware = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const verificationResult = jwtService.verifyAccessToken(token);
    
    if (!verificationResult.success) {
      return res.status(401).json({
        success: false,
        message: verificationResult.expired ? 'Token expired' : 'Invalid token',
        expired: verificationResult.expired
      });
    }

    const { decoded } = verificationResult;

    // Verify user still exists and is active
    const userCheck = await query(
      'SELECT id, email, status, is_superuser, last_login FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userCheck.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userCheck.rows[0];

    // Check if user is still active
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'User account is not active or has been suspended'
      });
    }

    // Attach user data to request
    req.user = {
      id: decoded.userId,
      userId: decoded.userId, // Add userId for backward compatibility
      email: decoded.email,
      departmentId: decoded.departmentId,
      departmentName: decoded.departmentName,
      roleId: decoded.roleId,
      roleName: decoded.roleName,
      roleLevel: decoded.roleLevel,
      permissions: decoded.permissions,
      isSuperuser: user.is_superuser,
      lastLogin: user.last_login
    };

    // Attach raw token for potential refresh
    req.token = token;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user data if token is present, but doesn't require it
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }

    // Use regular auth middleware if token is provided
    return authMiddleware(req, res, next);
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    // If there's an error, continue without authentication
    req.user = null;
    next();
  }
};

/**
 * Superuser only middleware
 */
export const superuserMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (!req.user.isSuperuser) {
    return res.status(403).json({
      success: false,
      message: 'Superuser access required'
    });
  }

  next();
};

/**
 * Role level middleware
 * Requires minimum role level (1 = highest, 5 = lowest)
 */
export const roleLevel = (minLevel) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (req.user.roleLevel > minLevel) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions. Minimum role level ${minLevel} required`
      });
    }

    next();
  };
};
