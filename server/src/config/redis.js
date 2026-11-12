/**
 * Redis Configuration for Permission Caching
 * Phase 4: Hybrid Permission System
 */

import { createClient } from 'redis';

class RedisManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  /**
   * Initialize Redis connection
   */
  async connect() {
    try {
      // Get Redis URL from environment or use default
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Redis connection failed after 10 retries');
              return false;
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      // Handle connection events
      this.client.on('error', (err) => {
        console.warn('Redis connection error:', err.message);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('✅ Redis connected');
        this.isConnected = true;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis ready');
        this.isConnected = true;
      });

      // Connect to Redis
      await this.client.connect();
      return true;
    } catch (error) {
      console.warn('⚠️ Redis connection failed:', error.message);
      console.log('⚠️ Running without Redis cache');
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('Redis disconnected');
    }
  }

  /**
   * Check if Redis is available
   */
  isAvailable() {
    return this.isConnected && this.client;
  }

  /**
   * Get data from Redis with fallback
   */
  async get(key) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`Redis GET error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set data in Redis with TTL
   */
  async set(key, data, ttlSeconds = 3600) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(data));
      return true;
    } catch (error) {
      console.warn(`Redis SET error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete data from Redis
   */
  async del(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.warn(`Redis DEL error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      // Use SCAN to avoid blocking Redis with KEYS on large datasets
      const batch = [];
      for await (const key of this.client.scanIterator({ MATCH: pattern, COUNT: 500 })) {
        batch.push(key);
        if (batch.length >= 500) {
          await this.client.del(batch);
          batch.length = 0;
        }
      }
      if (batch.length > 0) {
        await this.client.del(batch);
      }
      return true;
    } catch (error) {
      console.warn(`Redis DEL pattern error for ${pattern}:`, error.message);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      console.warn(`Redis EXISTS error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Set expiration on existing key
   */
  async expire(key, ttlSeconds) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.warn(`Redis EXPIRE error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Increment a counter
   */
  async incr(key, ttlSeconds = 3600) {
    if (!this.isAvailable()) {
      return 1; // Fallback to 1 if Redis unavailable
    }

    try {
      const value = await this.client.incr(key);
      if (value === 1) {
        // Set expiration only for new keys
        await this.client.expire(key, ttlSeconds);
      }
      return value;
    } catch (error) {
      console.warn(`Redis INCR error for key ${key}:`, error.message);
      return 1;
    }
  }

  /**
   * Get hash field
   */
  async hget(key, field) {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const data = await this.client.hGet(key, field);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn(`Redis HGET error for key ${key}, field ${field}:`, error.message);
      return null;
    }
  }

  /**
   * Set hash field
   */
  async hset(key, field, data, ttlSeconds = 3600) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.hSet(key, field, JSON.stringify(data));
      // Set expiration on the hash key
      await this.client.expire(key, ttlSeconds);
      return true;
    } catch (error) {
      console.warn(`Redis HSET error for key ${key}, field ${field}:`, error.message);
      return false;
    }
  }

  /**
   * Publish message to channel (for Pub/Sub)
   */
  async publish(channel, message) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.client.publish(channel, message);
      return true;
    } catch (error) {
      console.warn(`Redis PUBLISH error for channel ${channel}:`, error.message);
      return false;
    }
  }
}

// Create singleton instance
const redisManager = new RedisManager();

// Export both the class and instance
export { RedisManager };
export default redisManager;

// Cache key generators for permissions
export const CacheKeys = {
  userPermissions: (userId) => `perm:user:${userId}`,
  userDataScope: (userId, resource) => `scope:${userId}:${resource}`,
  userModules: (userId) => `modules:user:${userId}`,
  departmentModules: (departmentId) => `modules:dept:${departmentId}`,
  rolePermissions: (roleId) => `perm:role:${roleId}`,
  superuserPermissions: () => 'perm:superuser',
  userSession: (userId) => `session:${userId}`,
  rateLimitUser: (userId, endpoint) => `rate:${userId}:${endpoint}`,
  rateLimitIP: (ip, endpoint) => `rate:${ip}:${endpoint}`
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  PERMISSIONS: 3600,        // 1 hour - user permissions
  DATA_SCOPE: 1800,         // 30 minutes - data scope info
  MODULES: 7200,            // 2 hours - module assignments
  SESSION: 86400,           // 24 hours - user session data
  RATE_LIMIT: 900,          // 15 minutes - rate limiting
  SUPERUSER: 14400          // 4 hours - superuser permissions (change less frequently)
};
