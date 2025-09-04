/**
 * Cluster Management Routes
 * Provides monitoring and management endpoints for the distributed system
 */

const express = require('express');
const config = require('../config');

const router = express.Router();

/**
 * GET /api/cluster/status
 * Get overall cluster status
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      instance: {
        id: config.cluster.instanceId,
        startTime: process.env.START_TIME || new Date().toISOString(),
        uptime: process.uptime(),
        nodeVersion: process.version,
        environment: config.server.nodeEnv
      },
      features: {
        distributedLocking: config.cluster.enableDistributedLocking,
        cronLeaderElection: config.cluster.cronLeaderElection,
        webhookProcessing: true
      },
      services: {},
      timestamp: new Date().toISOString()
    };

    // Get service statuses
    const scriptService = req.app.locals.enhancedScriptExecutionService;
    const webhookService = req.app.locals.enhancedWebhookDeliveryService;
    const distributedLock = req.app.locals.distributedLock;

    // Script execution service status
    if (scriptService) {
      status.services.scripts = scriptService.getExecutionStats();
    }

    // Webhook delivery service status
    if (webhookService) {
      status.services.webhooks = await webhookService.getDeliveryStats();
    }

    // Distributed locking status
    if (distributedLock) {
      status.services.distributedLock = {
        healthy: await distributedLock.healthCheck(),
        activeLocks: (await distributedLock.listActiveLocks()).length
      };
    }

    // Database status
    const dbService = req.app.locals.dbService;
    if (dbService) {
      status.services.database = {
        connected: dbService.isConnected(),
        collections: (await dbService.listCollections()).length
      };
    }

    res.json({
      success: true,
      status
    });

  } catch (error) {
    console.error('Error getting cluster status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/cluster/leadership
 * Get leadership information
 */
router.get('/leadership', async (req, res) => {
  try {
    const leadership = {};

    const scriptService = req.app.locals.enhancedScriptExecutionService;
    if (scriptService?.leaderElection) {
      leadership.cron = {
        current: scriptService.leaderElection.getLeadershipStatus(),
        leader: await scriptService.leaderElection.getCurrentLeader()
      };
    }

    res.json({
      success: true,
      leadership,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cluster/leadership/resign
 * Resign from leadership (for graceful failover)
 */
router.post('/leadership/resign', async (req, res) => {
  try {
    const { service } = req.body;
    
    const scriptService = req.app.locals.enhancedScriptExecutionService;
    
    if (service === 'cron' && scriptService?.leaderElection) {
      if (!scriptService.leaderElection.isLeader) {
        return res.status(400).json({
          success: false,
          message: 'This instance is not the current cron leader'
        });
      }

      await scriptService.leaderElection.resignLeadership();
      
      res.json({
        success: true,
        message: 'Cron leadership resigned successfully',
        instance: config.cluster.instanceId
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid service or service not available'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cluster/leadership/force
 * Force leadership election
 */
router.post('/leadership/force', async (req, res) => {
  try {
    const { service } = req.body;
    
    const scriptService = req.app.locals.enhancedScriptExecutionService;
    
    if (service === 'cron' && scriptService?.leaderElection) {
      const acquired = await scriptService.leaderElection.forceElection();
      
      res.json({
        success: true,
        acquired,
        message: acquired ? 'Leadership acquired' : 'Failed to acquire leadership',
        instance: config.cluster.instanceId
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid service or service not available'
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cluster/locks
 * List active distributed locks
 */
router.get('/locks', async (req, res) => {
  try {
    const distributedLock = req.app.locals.distributedLock;
    
    if (!distributedLock) {
      return res.status(503).json({
        success: false,
        message: 'Distributed locking not available'
      });
    }

    const locks = await distributedLock.listActiveLocks();
    
    res.json({
      success: true,
      locks: locks.map(lock => ({
        key: lock.key,
        instanceId: lock.instanceId,
        timestamp: new Date(lock.timestamp),
        ttl: lock.ttl,
        isOwned: lock.isOwned
      })),
      count: locks.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cluster/locks/cleanup
 * Clean up expired locks
 */
router.post('/locks/cleanup', async (req, res) => {
  try {
    const distributedLock = req.app.locals.distributedLock;
    
    if (!distributedLock) {
      return res.status(503).json({
        success: false,
        message: 'Distributed locking not available'
      });
    }

    const cleaned = await distributedLock.cleanupExpiredLocks();
    
    res.json({
      success: true,
      cleaned,
      message: `Cleaned up ${cleaned} expired locks`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cluster/webhooks/queue
 * Get webhook queue status
 */
router.get('/webhooks/queue', async (req, res) => {
  try {
    const webhookService = req.app.locals.enhancedWebhookDeliveryService;
    
    if (!webhookService) {
      return res.status(503).json({
        success: false,
        message: 'Enhanced webhook service not available'
      });
    }

    const stats = await webhookService.getDeliveryStats();
    
    res.json({
      success: true,
      queue: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cluster/scripts/executions
 * Get script execution statistics
 */
router.get('/scripts/executions', async (req, res) => {
  try {
    const scriptService = req.app.locals.enhancedScriptExecutionService;
    
    if (!scriptService) {
      return res.status(503).json({
        success: false,
        message: 'Enhanced script service not available'
      });
    }

    const stats = scriptService.getExecutionStats();
    
    res.json({
      success: true,
      executions: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cluster/health
 * Comprehensive health check for cluster components
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      instance: config.cluster.instanceId,
      overall: 'healthy',
      components: {},
      timestamp: new Date().toISOString()
    };

    let hasUnhealthy = false;

    // Check database
    const dbService = req.app.locals.dbService;
    if (dbService) {
      health.components.database = {
        status: dbService.isConnected() ? 'healthy' : 'unhealthy',
        connected: dbService.isConnected()
      };
      if (!dbService.isConnected()) hasUnhealthy = true;
    }

    // Check Redis/distributed locking
    const distributedLock = req.app.locals.distributedLock;
    if (distributedLock) {
      const redisHealthy = await distributedLock.healthCheck();
      health.components.redis = {
        status: redisHealthy ? 'healthy' : 'unhealthy',
        connected: redisHealthy
      };
      if (!redisHealthy) hasUnhealthy = true;
    }

    // Check webhook service
    const webhookService = req.app.locals.enhancedWebhookDeliveryService;
    if (webhookService) {
      const webhookHealth = await webhookService.healthCheck();
      health.components.webhooks = {
        status: webhookHealth.healthy ? 'healthy' : 'unhealthy',
        ...webhookHealth
      };
      if (!webhookHealth.healthy) hasUnhealthy = true;
    }

    // Check script service
    const scriptService = req.app.locals.enhancedScriptExecutionService;
    if (scriptService) {
      health.components.scripts = {
        status: 'healthy',
        isLeader: scriptService.leaderElection?.isLeader || false,
        runningExecutions: scriptService.runningExecutions?.size || 0
      };
    }

    // Set overall status
    health.overall = hasUnhealthy ? 'unhealthy' : 'healthy';

    const statusCode = hasUnhealthy ? 503 : 200;
    
    res.status(statusCode).json({
      success: !hasUnhealthy,
      health
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      health: {
        overall: 'unhealthy',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/cluster/metrics
 * Get cluster metrics for monitoring
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      instance: config.cluster.instanceId,
      timestamp: new Date().toISOString(),
      process: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      services: {}
    };

    // Add service-specific metrics
    const scriptService = req.app.locals.enhancedScriptExecutionService;
    if (scriptService) {
      metrics.services.scripts = scriptService.getExecutionStats();
    }

    const webhookService = req.app.locals.enhancedWebhookDeliveryService;
    if (webhookService) {
      metrics.services.webhooks = await webhookService.getDeliveryStats();
    }

    const distributedLock = req.app.locals.distributedLock;
    if (distributedLock) {
      const locks = await distributedLock.listActiveLocks();
      metrics.services.locks = {
        total: locks.length,
        owned: locks.filter(l => l.isOwned).length
      };
    }

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
