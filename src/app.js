const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// Load configuration first
const config = require('./config');

const dbService = require('./services/database');
const SchemaDiscoveryService = require('./services/schemaDiscovery');
const OpenApiGenerator = require('./services/openApiGenerator');
const SDKGeneratorService = require('./services/sdkGenerator');

const collectionRoutes = require('./routes/collections');
const managementRoutes = require('./routes/management');
const webhookRoutes = require('./routes/webhooks');
const scriptRoutes = require('./routes/scripts');
const sdkRoutes = require('./routes/sdk');
const bulkDataRoutes = require('./routes/bulkData');
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
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mongodb: dbService.isConnected() ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api/management', managementRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/scripts', scriptRoutes);
app.use('/api/sdk', sdkRoutes);
app.use('/api/bulk', bulkDataRoutes);
app.use('/api/db', collectionRoutes);

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
    await dbService.connect();
    console.log('Connected to MongoDB');
    
    // Initialize SDK services
    const schemaDiscovery = new SchemaDiscoveryService(dbService);
    const openApiGenerator = new OpenApiGenerator(schemaDiscovery);
    const sdkGenerator = new SDKGeneratorService(schemaDiscovery, openApiGenerator);
    
    // Store services in app locals for route access
    app.locals.schemaDiscovery = schemaDiscovery;
    app.locals.openApiGenerator = openApiGenerator;
    app.locals.sdkGenerator = sdkGenerator;
    
    console.log('SDK services initialized');
    
    app.listen(config.server.port, config.server.host, () => {
      console.log(`Server running on ${config.server.host}:${config.server.port}`);
      console.log(`Environment: ${config.server.nodeEnv}`);
      console.log(`Health check: http://localhost:${config.server.port}${config.health.endpoint}`);
      console.log(`Management API: http://localhost:${config.server.port}/api/management/collections`);
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
  await dbService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await dbService.disconnect();
  process.exit(0);
});

startServer();
