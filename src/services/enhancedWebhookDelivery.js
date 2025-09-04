/**
 * Enhanced Webhook Delivery Service with Distributed Processing
 * Uses Redis queue and distributed locking for scalable webhook delivery
 */

const Bull = require('bull');
const crypto = require('crypto');
const config = require('../config');
const DistributedLock = require('./distributedLock');

class WebhookDeliveryService {
  constructor() {
    this.distributedLock = new DistributedLock();
    
    // Initialize Bull queue for webhook processing
    this.webhookQueue = new Bull('webhook-delivery', config.redis.url, {
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50,      // Keep last 50 failed jobs
        attempts: config.webhooks.maxRetries,
        backoff: {
          type: 'exponential',
          delay: config.webhooks.retryDelay,
        }
      }
    });

    // Rate limiting: Map of webhook URLs to their last delivery times and counts
    this.rateLimitMap = new Map();
    
    // Setup queue processing
    this.setupQueueProcessing();
    
    // Setup queue event handlers
    this.setupQueueEvents();
    
    // Start lock cleanup service
    this.startLockCleanup();
  }

  setupQueueProcessing() {
    // Process webhooks with configurable concurrency
    this.webhookQueue.process(
      'deliver', 
      config.cluster.webhookProcessingConcurrency, 
      async (job) => {
        const { webhookId, payload, url, headers, deliveryId } = job.data;
        
        // Use distributed lock to prevent duplicate delivery
        const lockKey = `webhook:${webhookId}:${deliveryId}`;
        const lock = await this.distributedLock.acquireLock(lockKey, 300000); // 5 min timeout
        
        if (!lock) {
          console.log(`🔒 Webhook ${webhookId} delivery ${deliveryId} already being processed`);
          return { skipped: true, reason: 'Already processing' };
        }

        try {
          console.log(`📤 Processing webhook delivery ${deliveryId} for ${webhookId}`);
          
          // Check rate limiting
          if (await this.isRateLimited(url, headers.rateLimit)) {
            throw new Error(`Rate limit exceeded for webhook ${url}`);
          }

          // Perform the actual delivery
          const result = await this.deliverWebhook(url, payload, headers);
          
          // Update rate limiting counters
          await this.updateRateLimit(url);
          
          console.log(`✅ Webhook delivery ${deliveryId} completed successfully`);
          
          return {
            success: true,
            deliveryId,
            webhookId,
            url,
            timestamp: new Date().toISOString(),
            response: {
              status: result.status,
              statusText: result.statusText
            }
          };
          
        } catch (error) {
          console.error(`❌ Webhook delivery ${deliveryId} failed:`, error.message);
          
          // Track failure for monitoring
          await this.trackDeliveryFailure(webhookId, deliveryId, error);
          
          throw error; // Let Bull handle retries
          
        } finally {
          await this.distributedLock.releaseLock(lockKey, lock);
        }
      }
    );
  }

  setupQueueEvents() {
    this.webhookQueue.on('completed', (job, result) => {
      if (!result.skipped) {
        console.log(`🎉 Webhook job ${job.id} completed: ${result.deliveryId}`);
      }
    });

    this.webhookQueue.on('failed', (job, err) => {
      console.error(`💥 Webhook job ${job.id} failed:`, err.message);
    });

    this.webhookQueue.on('stalled', (job) => {
      console.warn(`⏱️  Webhook job ${job.id} stalled`);
    });

    this.webhookQueue.on('progress', (job, progress) => {
      console.log(`📊 Webhook job ${job.id} progress: ${progress}%`);
    });
  }

  /**
   * Queue webhook for delivery
   */
  async triggerWebhooks(collection, event, document, previousDocument = null) {
    try {
      const webhooks = await this.getWebhooksForEvent(collection, event);
      
      if (webhooks.length === 0) {
        console.log(`📭 No webhooks configured for ${collection}:${event}`);
        return;
      }

      console.log(`📬 Triggering ${webhooks.length} webhooks for ${collection}:${event}`);
      
      for (const webhook of webhooks) {
        await this.queueWebhookDelivery(webhook, {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          event,
          collection,
          data: {
            document,
            previousDocument
          }
        });
      }
      
    } catch (error) {
      console.error(`❌ Error triggering webhooks for ${collection}:${event}:`, error.message);
    }
  }

  /**
   * Queue individual webhook delivery
   */
  async queueWebhookDelivery(webhook, payload) {
    const deliveryId = crypto.randomUUID();
    
    try {
      const jobData = {
        webhookId: webhook._id.toString(),
        deliveryId,
        url: webhook.url,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MongoDB-CRUD-API/1.0',
          'X-Webhook-ID': webhook._id.toString(),
          'X-Webhook-Name': webhook.name,
          'X-Delivery-ID': deliveryId,
          'X-Instance-ID': config.cluster.instanceId,
          rateLimit: webhook.rateLimit || config.webhooks.rateLimit.defaultMaxRequestsPerMinute,
          ...webhook.headers
        },
        payload
      };

      // Calculate delay based on webhook priority/configuration
      const delay = this.calculateDeliveryDelay(webhook);
      
      const job = await this.webhookQueue.add('deliver', jobData, {
        delay,
        priority: webhook.priority || 0,
        jobId: deliveryId // Use delivery ID as job ID for deduplication
      });

      console.log(`📋 Queued webhook delivery ${deliveryId} for ${webhook.name} (job: ${job.id})`);
      
      return {
        deliveryId,
        jobId: job.id,
        webhook: webhook.name,
        queuedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Failed to queue webhook delivery for ${webhook.name}:`, error.message);
      throw error;
    }
  }

  /**
   * Perform actual webhook delivery
   */
  async deliverWebhook(url, payload, headers) {
    const requestOptions = {
      method: 'POST',
      headers: {
        ...headers,
        'X-Delivery-Timestamp': new Date().toISOString()
      },
      body: JSON.stringify(payload),
      timeout: config.webhooks.timeout
    };

    // Use dynamic import for node-fetch
    const fetch = (await import('node-fetch')).default;
    
    console.log(`🚀 Delivering webhook to ${url}`);
    
    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}: ${response.statusText}`);
    }

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    };
  }

  /**
   * Check if webhook URL is rate limited
   */
  async isRateLimited(url, maxRequestsPerMinute = config.webhooks.rateLimit.defaultMaxRequestsPerMinute) {
    const now = Date.now();
    const windowMs = config.webhooks.rateLimit.windowMs;
    
    // Use Redis for distributed rate limiting
    const key = `rate_limit:webhook:${Buffer.from(url).toString('base64')}`;
    
    try {
      const count = await this.distributedLock.redis.incr(key);
      
      if (count === 1) {
        // First request in window, set expiration
        await this.distributedLock.redis.pexpire(key, windowMs);
      }
      
      return count > maxRequestsPerMinute;
      
    } catch (error) {
      console.error(`❌ Error checking rate limit for ${url}:`, error.message);
      return false; // Fail open
    }
  }

  /**
   * Update rate limit counter
   */
  async updateRateLimit(url) {
    // Rate limiting is handled in isRateLimited via Redis INCR
    // This method can be used for additional local tracking if needed
  }

  /**
   * Get webhooks for a specific event
   */
  async getWebhooksForEvent(collection, event) {
    // This would typically query the database
    // For now, return mock data - implement with actual database service
    return [];
  }

  /**
   * Calculate delivery delay based on webhook configuration
   */
  calculateDeliveryDelay(webhook) {
    // Immediate delivery by default
    let delay = 0;
    
    // Add jitter to prevent thundering herd
    if (webhook.addJitter !== false) {
      delay += Math.random() * 1000; // 0-1 second jitter
    }
    
    // Custom delay if specified
    if (webhook.delayMs) {
      delay += webhook.delayMs;
    }
    
    return Math.floor(delay);
  }

  /**
   * Track delivery failure for monitoring
   */
  async trackDeliveryFailure(webhookId, deliveryId, error) {
    try {
      const failureKey = `webhook_failures:${webhookId}`;
      const failureData = {
        deliveryId,
        error: error.message,
        timestamp: new Date().toISOString(),
        instance: config.cluster.instanceId
      };
      
      await this.distributedLock.redis.lpush(failureKey, JSON.stringify(failureData));
      await this.distributedLock.redis.ltrim(failureKey, 0, 99); // Keep last 100 failures
      await this.distributedLock.redis.expire(failureKey, 86400); // Expire after 24 hours
      
    } catch (err) {
      console.error('❌ Failed to track webhook failure:', err.message);
    }
  }

  /**
   * Get webhook delivery statistics
   */
  async getDeliveryStats() {
    try {
      const waiting = await this.webhookQueue.getWaiting();
      const active = await this.webhookQueue.getActive();
      const completed = await this.webhookQueue.getCompleted();
      const failed = await this.webhookQueue.getFailed();
      
      return {
        queue: {
          waiting: waiting.length,
          active: active.length,
          completed: completed.length,
          failed: failed.length
        },
        instance: config.cluster.instanceId,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error getting delivery stats:', error.message);
      return null;
    }
  }

  /**
   * Start periodic lock cleanup
   */
  startLockCleanup() {
    setInterval(async () => {
      try {
        const cleaned = await this.distributedLock.cleanupExpiredLocks();
        if (cleaned > 0) {
          console.log(`🧹 Cleaned up ${cleaned} expired webhook locks`);
        }
      } catch (error) {
        console.error('❌ Error during lock cleanup:', error.message);
      }
    }, config.scaling.lockCleanupInterval);
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const queueHealth = await this.webhookQueue.isReady();
      const redisHealth = await this.distributedLock.healthCheck();
      
      return {
        queue: queueHealth,
        redis: redisHealth,
        healthy: queueHealth && redisHealth
      };
    } catch (error) {
      return {
        queue: false,
        redis: false,
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('📴 Shutting down webhook delivery service...');
    
    try {
      await this.webhookQueue.close();
      await this.distributedLock.disconnect();
      console.log('✅ Webhook delivery service shutdown complete');
    } catch (error) {
      console.error('❌ Error during webhook service shutdown:', error.message);
    }
  }
}

module.exports = WebhookDeliveryService;
