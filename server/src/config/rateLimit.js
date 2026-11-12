import rateLimit from 'express-rate-limit';
import redisManager, { CacheKeys, CacheTTL } from './redis.js';

// Custom Redis store for rate limiting
const redisStore = {
  incr: async (key) => {
    try {
      return await redisManager.incr(key, CacheTTL.RATE_LIMIT);
    } catch (error) {
      console.warn('Redis rate limit incr failed:', error.message);
      return 1; // Fallback to 1 if Redis fails
    }
  },
  decrement: async (key) => {
    try {
      // Redis doesn't have decrement, but we can handle this
      return 0;
    } catch (error) {
      console.warn('Redis rate limit decrement failed:', error.message);
      return 0;
    }
  },
  resetKey: async (key) => {
    try {
      await redisManager.del(key);
      return true;
    } catch (error) {
      console.warn('Redis rate limit reset failed:', error.message);
      return true;
    }
  }
};

// General rate limiting (Redis store temporarily disabled)
export const rateLimitConfig = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Disabled for testing - Limit each IP to 10000 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // store: redisStore, // Temporarily disabled Redis store
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health';
  }
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Disabled for testing - Limit each IP to 10000 auth requests per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Password reset rate limiting
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000, // Disabled for testing - Limit each IP to 10000 password reset requests per hour
  message: {
    error: 'Too many password reset attempts, please try again later',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});
