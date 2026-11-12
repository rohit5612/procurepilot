import jwt from 'jsonwebtoken';
import { jwtConfig, jwtRefreshConfig } from '../../config/jwt.js';

class JWTService {
  /**
   * Generate access token with user permissions
   */
  generateAccessToken(payload) {
    const tokenPayload = {
      userId: payload.userId,
      email: payload.email,
      departmentId: payload.departmentId,
      departmentName: payload.departmentName,
      roleId: payload.roleId,
      roleName: payload.roleName,
      roleLevel: payload.roleLevel,
      permissions: payload.permissions || {
        modules: [],
        features: {},
        dataScopes: {}
      },
      type: 'access'
    };

    return jwt.sign(tokenPayload, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
      issuer: jwtConfig.issuer,
      audience: jwtConfig.audience,
      algorithm: jwtConfig.algorithm
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh'
    };

    return jwt.sign(payload, jwtRefreshConfig.secret, {
      expiresIn: jwtRefreshConfig.expiresIn,
      issuer: jwtRefreshConfig.issuer,
      audience: jwtRefreshConfig.audience,
      algorithm: jwtRefreshConfig.algorithm
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(userPayload) {
    const accessToken = this.generateAccessToken(userPayload);
    const refreshToken = this.generateRefreshToken(userPayload.userId);

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtConfig.expiresIn
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, jwtConfig.secret, {
        issuer: jwtConfig.issuer,
        audience: jwtConfig.audience,
        algorithms: [jwtConfig.algorithm]
      });

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return { success: true, decoded };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        expired: error.name === 'TokenExpiredError'
      };
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, jwtRefreshConfig.secret, {
        issuer: jwtRefreshConfig.issuer,
        audience: jwtRefreshConfig.audience,
        algorithms: [jwtRefreshConfig.algorithm]
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return { success: true, decoded };
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        expired: error.name === 'TokenExpiredError'
      };
    }
  }

  /**
   * Decode token without verification (for inspection)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    const decoded = this.decodeToken(token);
    if (decoded && decoded.exp) {
      return new Date(decoded.exp * 1000);
    }
    return null;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return Date.now() >= expiration.getTime();
  }
}

export default new JWTService();
