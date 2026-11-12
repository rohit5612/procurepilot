import dotenv from 'dotenv';

dotenv.config();

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  refreshExpiresIn: '7d',
  issuer: 'erp-system',
  audience: 'erp-users',
  algorithm: 'HS256'
};

export const jwtRefreshConfig = {
  secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + '_refresh',
  expiresIn: '7d',
  issuer: 'erp-system',
  audience: 'erp-users',
  algorithm: 'HS256'
};
