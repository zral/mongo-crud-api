const express = require('express');
const config = require('../config');
const WebhookDeliveryService = require('../services/webhookDelivery');

const router = express.Router();
const { ObjectId } = require('mongodb');

// Get all webhooks
router.get('/', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const webhooks = await dbService.getAllWebhooks();
    res.json({
      success: true,
      data: { webhooks },
      count: webhooks.length
    });
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Create a new webhook
router.post('/', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const { name, url, collection, events, filters, enabled = true, rateLimit, excludeFields } = req.body;

    // Validate required fields
    if (!name || !url || !collection || !events) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name, URL, collection, and events are required'
      });
    }

    // Validate events array
    const validEvents = ['create', 'update', 'delete'];
    const invalidEvents = events.filter(event => !validEvents.includes(event));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid events: ${invalidEvents.join(', ')}. Valid events are: ${validEvents.join(', ')}`
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (urlError) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid URL format'
      });
    }

    // Validate excludeFields if provided
    if (excludeFields && !Array.isArray(excludeFields)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'excludeFields must be an array of field names'
      });
    }

    // Validate and set rate limit settings
    const defaultRateLimit = {
      maxRequestsPerMinute: 60,
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    };

    let webhookRateLimit = defaultRateLimit;
    if (rateLimit) {
      webhookRateLimit = {
        maxRequestsPerMinute: Math.min(Math.max(rateLimit.maxRequestsPerMinute || 60, 1), 300), // 1-300 requests per minute
        maxRetries: Math.min(Math.max(rateLimit.maxRetries || 3, 0), 10), // 0-10 retries
        baseDelayMs: Math.min(Math.max(rateLimit.baseDelayMs || 1000, 100), 10000), // 100ms-10s base delay
        maxDelayMs: Math.min(Math.max(rateLimit.maxDelayMs || 30000, 1000), 300000) // 1s-5min max delay
      };
    }

    const webhook = {
      name,
      url,
      collection,
      events,
      filters: filters || {},
      excludeFields: excludeFields || [],
      enabled,
      rateLimit: webhookRateLimit,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await dbService.createWebhook(webhook);
    
    res.status(201).json({
      success: true,
      message: 'Webhook created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get webhook delivery statistics
router.get('/stats', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const stats = dbService.webhookDelivery.getStatistics();
    res.json({
      success: true,
      data: {
        deliveryStatistics: stats,
        rateLimit: {
          maxRequestsPerMinute: dbService.webhookDelivery.rateLimit.maxRequestsPerMinute,
          windowMs: dbService.webhookDelivery.rateLimit.windowMs,
          maxRetries: dbService.webhookDelivery.rateLimit.maxRetries,
          baseDelayMs: dbService.webhookDelivery.rateLimit.baseDelayMs,
          maxDelayMs: dbService.webhookDelivery.rateLimit.maxDelayMs
        }
      }
    });
  } catch (error) {
    console.error('Error fetching webhook statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get a specific webhook
router.get('/:id', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const { id } = req.params;
    const webhook = await dbService.getWebhookById(id);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Webhook not found'
      });
    }

    res.json({
      success: true,
      data: webhook
    });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Update a webhook
router.put('/:id', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const { id } = req.params;
    const { name, url, collection, events, filters, enabled, rateLimit, excludeFields } = req.body;

    // Validate events if provided
    if (events) {
      const validEvents = ['create', 'update', 'delete'];
      const invalidEvents = events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Invalid events: ${invalidEvents.join(', ')}. Valid events are: ${validEvents.join(', ')}`
        });
      }
    }

    // Validate URL format if provided
    if (url) {
      try {
        new URL(url);
      } catch (urlError) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid URL format'
        });
      }
    }

    // Validate excludeFields if provided
    if (excludeFields && !Array.isArray(excludeFields)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'excludeFields must be an array of field names'
      });
    }

    // Validate and set rate limit settings
    let webhookRateLimit = undefined;
    if (rateLimit) {
      webhookRateLimit = {
        maxRequestsPerMinute: Math.min(Math.max(rateLimit.maxRequestsPerMinute || 60, 1), 300), // 1-300 requests per minute
        maxRetries: Math.min(Math.max(rateLimit.maxRetries || 3, 0), 10), // 0-10 retries
        baseDelayMs: Math.min(Math.max(rateLimit.baseDelayMs || 1000, 100), 10000), // 100ms-10s base delay
        maxDelayMs: Math.min(Math.max(rateLimit.maxDelayMs || 30000, 1000), 300000) // 1s-5min max delay
      };
    }

    const updateData = {
      ...(name && { name }),
      ...(url && { url }),
      ...(collection && { collection }),
      ...(events && { events }),
      ...(filters !== undefined && { filters }),
      ...(excludeFields !== undefined && { excludeFields }),
      ...(enabled !== undefined && { enabled }),
      ...(webhookRateLimit && { rateLimit: webhookRateLimit }),
      updatedAt: new Date()
    };

    const result = await dbService.updateWebhook(id, updateData);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Webhook not found'
      });
    }

    res.json({
      success: true,
      message: 'Webhook updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Delete a webhook
router.delete('/:id', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const { id } = req.params;
    const result = await dbService.deleteWebhook(id);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Webhook not found'
      });
    }

    res.json({
      success: true,
      message: 'Webhook deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Test a webhook
router.post('/:id/test', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const { id } = req.params;
    const webhook = await dbService.getWebhookById(id);
    
    if (!webhook) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Webhook not found'
      });
    }

    const testPayload = {
      event: 'test',
      webhook: {
        id: webhook._id,
        name: webhook.name
      },
      collection: webhook.collection,
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook delivery',
        testId: `test-${Date.now()}`
      }
    };

    // Use the webhook delivery service for testing
    await dbService.webhookDelivery.deliverWebhook(webhook, testPayload);

    res.json({
      success: true,
      message: 'Test webhook sent successfully',
      data: {
        webhook: webhook.name,
        url: webhook.url,
        payload: testPayload
      }
    });
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
