/**
 * Distributed Lock Service using Redis
 * Provides distributed locking for coordination between multiple API instances
 */

const Redis = require('ioredis');
const config = require('../config');

class DistributedLock {
  constructor() {
    this.redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      enableReadyCheck: true,
      lazyConnect: true
    });
    
    this.instanceId = config.cluster.instanceId;
    
    // Handle Redis connection events
    this.redis.on('connect', () => {
      console.log('✅ Connected to Redis for distributed locking');
    });
    
    this.redis.on('error', (err) => {
      console.error('❌ Redis connection error:', err.message);
    });
    
    this.redis.on('ready', () => {
      console.log('🔄 Redis is ready for distributed locking');
    });
  }

  /**
   * Acquire a distributed lock
   * @param {string} key - Lock key
   * @param {number} ttl - Time to live in milliseconds
   * @returns {string|null} Lock value if acquired, null if failed
   */
  async acquireLock(key, ttl = config.scaling.lockTtl) {
    const lockKey = `lock:${key}`;
    const value = `${this.instanceId}:${Date.now()}:${Math.random()}`;
    
    try {
      const result = await this.redis.set(
        lockKey,
        value,
        'PX', ttl,  // TTL in milliseconds
        'NX'        // Only if not exists
      );
      
      if (result === 'OK') {
        console.log(`🔒 Lock acquired: ${key} by ${this.instanceId}`);
        return value;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Failed to acquire lock ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Release a distributed lock
   * @param {string} key - Lock key
   * @param {string} value - Lock value to verify ownership
   * @returns {boolean} True if released, false if not owned
   */
  async releaseLock(key, value) {
    const lockKey = `lock:${key}`;
    
    // Lua script to atomically check and delete
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;
    
    try {
      const result = await this.redis.eval(script, 1, lockKey, value);
      
      if (result === 1) {
        console.log(`🔓 Lock released: ${key} by ${this.instanceId}`);
        return true;
      }
      
      console.warn(`⚠️  Cannot release lock ${key}: not owned by ${this.instanceId}`);
      return false;
    } catch (error) {
      console.error(`❌ Failed to release lock ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Extend a distributed lock
   * @param {string} key - Lock key
   * @param {string} value - Lock value to verify ownership
   * @param {number} ttl - New TTL in milliseconds
   * @returns {boolean} True if extended, false if not owned
   */
  async extendLock(key, value, ttl = config.scaling.lockTtl) {
    const lockKey = `lock:${key}`;
    
    // Lua script to atomically check ownership and extend TTL
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("PEXPIRE", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    
    try {
      const result = await this.redis.eval(script, 1, lockKey, value, ttl);
      
      if (result === 1) {
        console.log(`🔄 Lock extended: ${key} by ${this.instanceId} for ${ttl}ms`);
        return true;
      }
      
      console.warn(`⚠️  Cannot extend lock ${key}: not owned by ${this.instanceId}`);
      return false;
    } catch (error) {
      console.error(`❌ Failed to extend lock ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Check if a lock exists
   * @param {string} key - Lock key
   * @returns {Object|null} Lock info or null if not exists
   */
  async getLockInfo(key) {
    const lockKey = `lock:${key}`;
    
    try {
      const value = await this.redis.get(lockKey);
      const ttl = await this.redis.pttl(lockKey);
      
      if (value) {
        const [instanceId, timestamp] = value.split(':');
        return {
          key,
          value,
          instanceId,
          timestamp: parseInt(timestamp),
          ttl,
          isOwned: instanceId === this.instanceId
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Failed to get lock info ${key}:`, error.message);
      return null;
    }
  }

  /**
   * List all active locks (for debugging/monitoring)
   * @returns {Array} Array of lock information
   */
  async listActiveLocks() {
    try {
      const keys = await this.redis.keys('lock:*');
      const locks = [];
      
      for (const key of keys) {
        const lockKey = key.replace('lock:', '');
        const info = await this.getLockInfo(lockKey);
        if (info) {
          locks.push(info);
        }
      }
      
      return locks;
    } catch (error) {
      console.error('❌ Failed to list active locks:', error.message);
      return [];
    }
  }

  /**
   * Clean up expired locks (maintenance function)
   * @returns {number} Number of cleaned locks
   */
  async cleanupExpiredLocks() {
    try {
      const keys = await this.redis.keys('lock:*');
      let cleaned = 0;
      
      for (const key of keys) {
        const ttl = await this.redis.pttl(key);
        if (ttl === -1) { // Key exists but has no expiration
          await this.redis.del(key);
          cleaned++;
          console.log(`🧹 Cleaned expired lock: ${key}`);
        }
      }
      
      return cleaned;
    } catch (error) {
      console.error('❌ Failed to cleanup expired locks:', error.message);
      return 0;
    }
  }

  /**
   * Close Redis connection
   */
  async disconnect() {
    try {
      await this.redis.quit();
      console.log('📴 Disconnected from Redis');
    } catch (error) {
      console.error('❌ Error disconnecting from Redis:', error.message);
    }
  }

  /**
   * Health check for Redis connection
   * @returns {boolean} True if healthy
   */
  async healthCheck() {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('❌ Redis health check failed:', error.message);
      return false;
    }
  }
}

module.exports = DistributedLock;
