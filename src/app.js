const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const dbService = require('./services/database');
const SchemaDiscoveryService = require('./services/schemaDiscovery');
const OpenApiGenerator = require('./services/openApiGenerator');
const SDKGeneratorService = require('./services/sdkGenerator');

const collectionRoutes = require('./routes/collections');
const managementRoutes = require('./routes/management');
const webhookRoutes = require('./routes/webhooks');
const sdkRoutes = require('./routes/sdk');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mongodb: dbService.isConnected() ? 'connected' : 'disconnected'
  });
});

// API routes
app.use('/api/management', managementRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/sdk', sdkRoutes);
app.use('/api', collectionRoutes);

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
      'GET /api/{collection}',
      'GET /api/{collection}/{id}',
      'POST /api/{collection}',
      'PUT /api/{collection}/{id}',
      'DELETE /api/{collection}/{id}'
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
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`Management API: http://localhost:${PORT}/api/management/collections`);
      console.log(`OpenAPI Docs: http://localhost:${PORT}/api/sdk/docs`);
      console.log(`SDK Generation: http://localhost:${PORT}/api/sdk/typescript`);
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
