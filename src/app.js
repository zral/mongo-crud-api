const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Load configuration first
const config = require('./config');

const DatabaseService = require('./services/database');
const SchemaDiscoveryService = require('./services/schemaDiscovery');
const OpenApiGenerator = require('./services/openApiGenerator');
const SDKGeneratorService = require('./services/sdkGenerator');

const collectionRoutes = require('./routes/collections');
const managementRoutes = require('./routes/management');
const webhookRoutes = require('./routes/webhooks');
const scriptRoutes = require('./routes/scripts');
const sdkRoutes = require('./routes/sdk');
const bulkDataRoutes = require('./routes/bulkData');
const clusterRoutes = require('./routes/cluster');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Middleware with configuration
app.use(helmet({
  contentSecurityPolicy: config.security.helmet.contentSecurityPolicy,
  crossOriginEmbedderPolicy: config.security.helmet.crossOriginEmbedderPolicy
}));

app.use(cors({
  origin: config.server.cors.origin,
  credentials: config.server.cors.credentials
}));

app.use(morgan(config.server.middleware.logFormat));
app.use(express.json({ limit: config.server.middleware.jsonLimit }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get(config.health.endpoint, (req, res) => {
  const dbService = req.app.locals.dbService;
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mongodb: dbService?.isConnected() ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api/management', managementRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/sdk', sdkRoutes);
app.use('/api/bulk', bulkDataRoutes);
app.use('/api/db', collectionRoutes);
app.use('/api/cluster', clusterRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /health',
      'GET /api/management/collections',
      'POST /api/management/collections',
      'DELETE /api/management/collections/{name}',
      'GET /api/webhooks',
      'POST /api/webhooks',
      'GET /api/webhooks/{id}',
      'PUT /api/webhooks/{id}',
      'DELETE /api/webhooks/{id}',
      'POST /api/webhooks/{id}/test',
      'GET /api/sdk/openapi.json',
      'GET /api/sdk/docs',
      'GET /api/sdk/typescript',
      'GET /api/sdk/schemas',
      'GET /api/db/{collection}',
      'GET /api/db/{collection}/{id}',
      'POST /api/db/{collection}',
      'PUT /api/db/{collection}/{id}',
      'DELETE /api/db/{collection}/{id}'
    ]
  });
});

// Error handler
app.use(errorHandler);

// Start server
async function startServer() {
  try {
    // Initialize database service
    const dbService = new DatabaseService();
    await dbService.connect();
    console.log('Connected to MongoDB');
    
    // Store dbService in app.locals for access in routes
    app.locals.dbService = dbService;
    
    // Initialize SDK services
    const schemaDiscovery = new SchemaDiscoveryService(dbService);
    const openApiGenerator = new OpenApiGenerator(schemaDiscovery);
    const sdkGenerator = new SDKGeneratorService(schemaDiscovery, openApiGenerator);
    
    // Store services in app locals for route access
    app.locals.schemaDiscovery = schemaDiscovery;
    app.locals.openApiGenerator = openApiGenerator;
    app.locals.sdkGenerator = sdkGenerator;
    
    console.log('SDK services initialized');
    
    // Initialize scalability services
    let distributedLock = null;
    let enhancedWebhookDeliveryService = null;
    let enhancedScriptExecutionService = null;

    if (config.cluster.enableDistributedLocking) {
      const DistributedLock = require('./services/distributedLock');
      distributedLock = new DistributedLock(config.redis.url, {
        prefix: config.cluster.instanceId,
        ttl: config.cluster.lockTtl
      });
      
      try {
        await distributedLock.healthCheck();
        app.locals.distributedLock = distributedLock;
        console.log('Distributed locking service initialized');
      } catch (error) {
        console.warn('Distributed locking service failed to initialize:', error.message);
        if (config.cluster.requireRedis) {
          throw new Error('Redis is required for cluster mode but unavailable');
        }
      }
    }

    // Initialize enhanced webhook delivery service
    if (config.webhooks.enhancedDelivery) {
      const EnhancedWebhookDelivery = require('./services/enhancedWebhookDelivery');
      enhancedWebhookDeliveryService = new EnhancedWebhookDelivery(config, distributedLock);
      app.locals.enhancedWebhookDeliveryService = enhancedWebhookDeliveryService;
      
      try {
        await enhancedWebhookDeliveryService.initialize();
        console.log('Enhanced webhook delivery service initialized');
      } catch (error) {
        console.warn('Enhanced webhook delivery failed to initialize:', error.message);
      }
    }

    // Initialize enhanced script execution service
    if (config.scripts.enableEnhancedExecution) {
      const EnhancedScriptExecution = require('./services/enhancedScriptExecution');
      enhancedScriptExecutionService = new EnhancedScriptExecution(config, distributedLock);
      app.locals.enhancedScriptExecutionService = enhancedScriptExecutionService;
      
      try {
        await enhancedScriptExecutionService.initialize();
        console.log('Enhanced script execution service initialized');
        
        if (config.cluster.cronLeaderElection) {
          console.log(`Instance ${config.cluster.instanceId} ready for cron leadership election`);
        }
      } catch (error) {
        console.warn('Enhanced script execution failed to initialize:', error.message);
      }
    }
    
    // Store start time for monitoring
    process.env.START_TIME = new Date().toISOString();
    
    app.listen(config.server.port, config.server.host, () => {
      console.log(`Server running on ${config.server.host}:${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
      console.log(`Instance ID: ${config.cluster.instanceId}`);
      console.log(`Cluster Mode: ${config.cluster.enableDistributedLocking ? 'Enabled' : 'Disabled'}`);
      console.log(`Health check: http://localhost:${config.server.port}${config.health.endpoint}`);
      console.log(`Management API: http://localhost:${config.server.port}/api/management/collections`);
      console.log(`Cluster API: http://localhost:${config.server.port}/api/cluster/status`);
      console.log(`OpenAPI Docs: http://localhost:${config.server.port}/api/sdk/docs`);
      console.log(`SDK Generation: http://localhost:${config.server.port}/api/sdk/typescript`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  
  // Shut down scalability services
  if (app.locals.enhancedScriptExecutionService) {
    try {
      await app.locals.enhancedScriptExecutionService.shutdown();
      console.log('Enhanced script execution service shut down');
    } catch (error) {
      console.error('Error shutting down script service:', error);
    }
  }
  
  if (app.locals.enhancedWebhookDeliveryService) {
    try {
      await app.locals.enhancedWebhookDeliveryService.shutdown();
      console.log('Enhanced webhook delivery service shut down');
    } catch (error) {
      console.error('Error shutting down webhook service:', error);
    }
  }
  
  if (app.locals.distributedLock) {
    try {
      await app.locals.distributedLock.shutdown();
      console.log('Distributed lock service shut down');
    } catch (error) {
      console.error('Error shutting down distributed lock service:', error);
    }
  }
  
  const dbService = app.locals.dbService;
  if (dbService) {
    await dbService.disconnect();
  }
  console.log('Graceful shutdown complete');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  
  // Shut down scalability services  
  if (app.locals.enhancedScriptExecutionService) {
    try {
      await app.locals.enhancedScriptExecutionService.shutdown();
      console.log('Enhanced script execution service shut down');
    } catch (error) {
      console.error('Error shutting down script service:', error);
    }
  }
  
  if (app.locals.enhancedWebhookDeliveryService) {
    try {
      await app.locals.enhancedWebhookDeliveryService.shutdown();
      console.log('Enhanced webhook delivery service shut down');
    } catch (error) {
      console.error('Error shutting down webhook service:', error);
    }
  }
  
  if (app.locals.distributedLock) {
    try {
      await app.locals.distributedLock.shutdown();
      console.log('Distributed lock service shut down');
    } catch (error) {
      console.error('Error shutting down distributed lock service:', error);
    }
  }
  
  const dbService = app.locals.dbService;
  if (dbService) {
    await dbService.disconnect();
  }
  console.log('Graceful shutdown complete');
  process.exit(0);
});

startServer();
