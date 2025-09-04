const config = require('../config');

class WebhookDeliveryService {
  constructor() {
    // Rate limiting: Map of webhook URLs to their last delivery times and counts
    this.rateLimitMap = new Map();
    
    // Delivery queue for failed webhooks
    this.deliveryQueue = [];
    
    // Rate limiting configuration from config
    this.rateLimit = {
      maxRequestsPerMinute: config.webhooks.rateLimit.defaultMaxRequestsPerMinute,
      windowMs: config.webhooks.rateLimit.windowMs,
      backoffMultiplier: config.webhooks.rateLimit.backoffMultiplier,
      maxRetries: config.webhooks.maxRetries,
      baseDelayMs: config.webhooks.retryDelay,
      maxDelayMs: config.webhooks.maxRetryDelay
    };
    
    // Start processing retry queue
    this.startRetryProcessor();
  }

  /**
   * Check if a webhook URL is rate limited
   */
  isRateLimited(url, maxRequestsPerMinute = this.rateLimit.maxRequestsPerMinute) {
    const now = Date.now();
    const urlData = this.rateLimitMap.get(url);
    
    if (!urlData) {
      return false;
    }
    
    // Clean old entries outside the time window
    urlData.requests = urlData.requests.filter(
      timestamp => now - timestamp < this.rateLimit.windowMs
    );
    
    // Check if we've exceeded the rate limit
    if (urlData.requests.length >= maxRequestsPerMinute) {
      console.log(`Rate limit exceeded for webhook URL: ${url} (${urlData.requests.length}/${maxRequestsPerMinute} requests)`);
      return true;
    }
    
    return false;
  }

  /**
   * Record a webhook delivery attempt
   */
  recordDeliveryAttempt(url) {
    const now = Date.now();
    const urlData = this.rateLimitMap.get(url) || { requests: [] };
    
    urlData.requests.push(now);
    this.rateLimitMap.set(url, urlData);
  }

  /**
   * Deliver webhook with retry mechanism
   */
  async deliverWebhook(webhook, payload) {
    const deliveryId = `${webhook.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`Delivering webhook ${deliveryId} to ${webhook.url}`);
    
    try {
      await this.attemptDelivery(webhook, payload, deliveryId);
      console.log(`Webhook ${deliveryId} delivered successfully`);
    } catch (error) {
      console.error(`Failed to deliver webhook ${deliveryId}:`, error.message);
      
      // Use webhook-specific rate limits if available, otherwise use global defaults
      const webhookRateLimit = webhook.rateLimit || this.rateLimit;
      
      // Add to retry queue
      this.addToRetryQueue({
        webhook,
        payload,
        deliveryId,
        attempts: 1,
        nextRetryAt: Date.now() + webhookRateLimit.baseDelayMs,
        lastError: error.message
      });
    }
  }

  /**
   * Attempt webhook delivery with rate limiting
   */
  async attemptDelivery(webhook, payload, deliveryId, attemptNumber = 1) {
    // Use webhook-specific rate limits if available, otherwise use global defaults
    const webhookRateLimit = webhook.rateLimit || this.rateLimit;
    
    // Check rate limiting using webhook-specific limits
    if (this.isRateLimited(webhook.url, webhookRateLimit.maxRequestsPerMinute)) {
      throw new Error(`Rate limit exceeded for webhook URL: ${webhook.url} (limit: ${webhookRateLimit.maxRequestsPerMinute} req/min)`);
    }

    // Record the delivery attempt
    this.recordDeliveryAttempt(webhook.url);

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MongoCRUD-Webhook/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Webhook-Name': webhook.name,
        'X-Delivery-ID': deliveryId,
        'X-Attempt-Number': attemptNumber.toString(),
        'X-Rate-Limit': `${webhookRateLimit.maxRequestsPerMinute}/min`,
        'X-Max-Retries': webhookRateLimit.maxRetries.toString()
      },
      body: JSON.stringify(payload),
      timeout: config.webhooks.timeout
    };

    console.log(`Attempting webhook delivery ${deliveryId} (attempt ${attemptNumber}) to ${webhook.url}`);

    // Use dynamic import for node-fetch
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(webhook.url, requestOptions);

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  /**
   * Add failed webhook to retry queue
   */
  addToRetryQueue(retryItem) {
    // Use webhook-specific rate limits if available, otherwise use global defaults
    const webhookRateLimit = retryItem.webhook.rateLimit || this.rateLimit;
    
    // Check if we've exceeded max retries
    if (retryItem.attempts >= webhookRateLimit.maxRetries) {
      console.error(`Webhook ${retryItem.deliveryId} failed permanently after ${retryItem.attempts} attempts (maxRetries: ${webhookRateLimit.maxRetries})`);
      return;
    }

    // Calculate next retry delay with exponential backoff using webhook-specific settings
    const delayMs = Math.min(
      webhookRateLimit.baseDelayMs * Math.pow(this.rateLimit.backoffMultiplier, retryItem.attempts),
      webhookRateLimit.maxDelayMs
    );

    retryItem.nextRetryAt = Date.now() + delayMs;
    this.deliveryQueue.push(retryItem);

    console.log(`Webhook ${retryItem.deliveryId} scheduled for retry ${retryItem.attempts + 1} in ${delayMs}ms (maxRetries: ${webhookRateLimit.maxRetries}, maxDelay: ${webhookRateLimit.maxDelayMs}ms)`);
  }

  /**
   * Start the retry processor
   */
  startRetryProcessor() {
    setInterval(() => {
      this.processRetryQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process the retry queue
   */
  async processRetryQueue() {
    const now = Date.now();
    const readyForRetry = this.deliveryQueue.filter(item => item.nextRetryAt <= now);

    if (readyForRetry.length === 0) {
      return;
    }

    console.log(`Processing ${readyForRetry.length} webhook retries`);

    // Remove processed items from queue
    this.deliveryQueue = this.deliveryQueue.filter(item => item.nextRetryAt > now);

    // Process each retry
    for (const retryItem of readyForRetry) {
      try {
        await this.attemptDelivery(
          retryItem.webhook,
          retryItem.payload,
          retryItem.deliveryId,
          retryItem.attempts + 1
        );
        
        console.log(`Webhook ${retryItem.deliveryId} retry ${retryItem.attempts + 1} succeeded`);
      } catch (error) {
        console.error(`Webhook ${retryItem.deliveryId} retry ${retryItem.attempts + 1} failed:`, error.message);
        
        // Schedule another retry
        retryItem.attempts += 1;
        retryItem.lastError = error.message;
        this.addToRetryQueue(retryItem);
      }
    }
  }

  /**
   * Get statistics about webhook deliveries
   */
  getStatistics() {
    const totalUrls = this.rateLimitMap.size;
    const queueSize = this.deliveryQueue.length;
    
    const rateLimitInfo = Array.from(this.rateLimitMap.entries()).map(([url, data]) => ({
      url,
      recentRequests: data.requests.length,
      isLimited: this.isRateLimited(url)
    }));

    return {
      totalWebhookUrls: totalUrls,
      pendingRetries: queueSize,
      rateLimitStatus: rateLimitInfo
    };
  }

  /**
   * Clear rate limit data for a specific URL (useful for testing)
   */
  clearRateLimit(url) {
    this.rateLimitMap.delete(url);
  }

  /**
   * Clear all rate limit data
   */
  clearAllRateLimits() {
    this.rateLimitMap.clear();
  }
}

module.exports = WebhookDeliveryService;
