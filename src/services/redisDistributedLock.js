const Redis = require('ioredis');

class RedisDistributedLock {
  constructor(redisConfig = {}) {
    // Use REDIS_URL if available, otherwise fall back to individual host/port
    const redisUrl = process.env.REDIS_URL;
    let redisOptions = {
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      ...redisConfig
    };

    if (redisUrl) {
      this.redis = new Redis(redisUrl, redisOptions);
    } else {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        ...redisOptions
      });
    }

    this.lockPrefix = 'cron_lock:';
    this.instanceId = process.env.INSTANCE_ID || `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🔐 Redis Distributed Lock initialized for instance: ${this.instanceId}`);

    this.redis.on('error', (error) => {
      console.error('❌ Redis connection error:', error);
    });

    this.redis.on('connect', () => {
      console.log('✅ Redis connected for distributed locking');
    });
  }

  /**
   * Acquire a distributed lock for cron job execution
   * @param {string} scriptId - Unique identifier for the script
   * @param {number} ttl - Time to live for the lock in seconds (default: 300s = 5min)
   * @returns {Promise<boolean>} - True if lock acquired, false otherwise
   */
  async acquireLock(scriptId, ttl = 300) {
    try {
      const lockKey = `${this.lockPrefix}${scriptId}`;
      const lockValue = `${this.instanceId}:${Date.now()}`;
      
      // Use SET with NX (only set if not exists) and EX (expiry)
      const result = await this.redis.set(lockKey, lockValue, 'EX', ttl, 'NX');
      
      if (result === 'OK') {
        console.log(`🔒 Lock acquired for script "${scriptId}" by instance ${this.instanceId}`);
        return true;
      } else {
        // Check who owns the lock
        const currentLock = await this.redis.get(lockKey);
        const ttlRemaining = await this.redis.ttl(lockKey);
        console.log(`🚫 Lock already held for script "${scriptId}" by ${currentLock} (TTL: ${ttlRemaining}s)`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error acquiring lock for script "${scriptId}":`, error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * @param {string} scriptId - Unique identifier for the script
   * @returns {Promise<boolean>} - True if lock was released by this instance
   */
  async releaseLock(scriptId) {
    try {
      const lockKey = `${this.lockPrefix}${scriptId}`;
      const lockValue = await this.redis.get(lockKey);
      
      if (lockValue && lockValue.startsWith(this.instanceId)) {
        await this.redis.del(lockKey);
        console.log(`🔓 Lock released for script "${scriptId}" by instance ${this.instanceId}`);
        return true;
      } else {
        console.log(`⚠️ Cannot release lock for script "${scriptId}" - not owned by this instance`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error releasing lock for script "${scriptId}":`, error);
      return false;
    }
  }

  /**
   * Check if a lock exists for a script
   * @param {string} scriptId - Unique identifier for the script
   * @returns {Promise<Object>} - Lock information or null
   */
  async getLockInfo(scriptId) {
    try {
      const lockKey = `${this.lockPrefix}${scriptId}`;
      const lockValue = await this.redis.get(lockKey);
      const ttl = await this.redis.ttl(lockKey);
      
      if (lockValue) {
        const [instance, timestamp] = lockValue.split(':');
        return {
          instance,
          timestamp: parseInt(timestamp),
          ttl,
          ownedByThisInstance: instance === this.instanceId
        };
      }
      return null;
    } catch (error) {
      console.error(`❌ Error getting lock info for script "${scriptId}":`, error);
      return null;
    }
  }

  /**
   * Extend lock TTL if owned by this instance
   * @param {string} scriptId - Unique identifier for the script
   * @param {number} ttl - New TTL in seconds
   * @returns {Promise<boolean>} - True if extended successfully
   */
  async extendLock(scriptId, ttl = 300) {
    try {
      const lockKey = `${this.lockPrefix}${scriptId}`;
      const lockValue = await this.redis.get(lockKey);
      
      if (lockValue && lockValue.startsWith(this.instanceId)) {
        await this.redis.expire(lockKey, ttl);
        console.log(`⏱️ Lock extended for script "${scriptId}" by ${ttl}s`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Error extending lock for script "${scriptId}":`, error);
      return false;
    }
  }

  /**
   * Get all active cron locks
   * @returns {Promise<Array>} - Array of active locks
   */
  async getAllLocks() {
    try {
      const keys = await this.redis.keys(`${this.lockPrefix}*`);
      const locks = [];
      
      for (const key of keys) {
        const scriptId = key.replace(this.lockPrefix, '');
        const lockInfo = await this.getLockInfo(scriptId);
        if (lockInfo) {
          locks.push({ scriptId, ...lockInfo });
        }
      }
      
      return locks;
    } catch (error) {
      console.error('❌ Error getting all locks:', error);
      return [];
    }
  }

  /**
   * Clean up expired or orphaned locks
   * @returns {Promise<number>} - Number of locks cleaned up
   */
  async cleanupLocks() {
    try {
      const keys = await this.redis.keys(`${this.lockPrefix}*`);
      let cleaned = 0;
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // Key exists but has no expiry
          await this.redis.del(key);
          cleaned++;
          console.log(`🧹 Cleaned up orphaned lock: ${key}`);
        }
      }
      
      return cleaned;
    } catch (error) {
      console.error('❌ Error cleaning up locks:', error);
      return 0;
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.redis.quit();
    console.log('🔐 Redis Distributed Lock connection closed');
  }
}

module.exports = RedisDistributedLock;
