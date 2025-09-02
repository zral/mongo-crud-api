/**
 * SDK Generation Routes
 * Provides endpoints for SDK generation and OpenAPI specification
 */

const express = require('express');
const archiver = require('archiver');
const swaggerUi = require('swagger-ui-express');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

// Middleware to ensure services are available
const ensureServices = (req, res, next) => {
  if (!req.app.locals.schemaDiscovery || !req.app.locals.openApiGenerator || !req.app.locals.sdkGenerator) {
    return res.status(500).json({
      success: false,
      error: 'SDK services not initialized'
    });
  }
  next();
};

/**
 * Get OpenAPI specification
 */
router.get('/openapi.json', ensureServices, async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const spec = await req.app.locals.openApiGenerator.generateSpec(baseUrl);
    
    res.json(spec);
  } catch (error) {
    next(error);
  }
});

/**
 * Swagger UI documentation
 */
// Serve static assets first (CSS, JS files)
router.use('/docs', swaggerUi.serve);

// Handle both /docs and /docs/ paths
router.get('/docs/*', ensureServices, async (req, res, next) => {
  try {    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const spec = await req.app.locals.openApiGenerator.generateSpec(baseUrl);
    
    const swaggerUiSetup = swaggerUi.setup(spec, {
      customSiteTitle: 'MongoDB CRUD API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        url: `/api/sdk/openapi.json`
      }
    });
    
    swaggerUiSetup(req, res, next);
  } catch (error) {
    next(error);
  }
});

// Handle the main docs page
router.get('/docs', ensureServices, async (req, res, next) => {
  try {    
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const spec = await req.app.locals.openApiGenerator.generateSpec(baseUrl);
    
    const swaggerUiSetup = swaggerUi.setup(spec, {
      customSiteTitle: 'MongoDB CRUD API Documentation',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        url: `/api/sdk/openapi.json`
      }
    });
    
    swaggerUiSetup(req, res, next);
  } catch (error) {
    next(error);
  }
});

/**
 * Generate TypeScript SDK
 */
router.get('/typescript', ensureServices, async (req, res, next) => {
  try {
    const { packageName = '@your-org/mongodb-crud-sdk', apiUrl } = req.query;
    const baseUrl = apiUrl || `${req.protocol}://${req.get('host')}`;
    
    console.log('Generating TypeScript SDK...');
    
    // Generate SDK in temporary directory
    const tempDir = path.join(__dirname, '../../temp', `sdk-${Date.now()}`);
    
    const result = await req.app.locals.sdkGenerator.generateTypeScriptSDK({
      outputDir: tempDir,
      packageName,
      apiUrl: baseUrl
    });

    console.log('SDK generated successfully:', result);

    // Create ZIP archive
    const archive = archiver('zip', { 
      zlib: { level: 9 } 
    });
    
    // Set response headers for download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${packageName.replace(/[@\/]/g, '-')}-sdk.zip"`);
    
    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create SDK archive' });
      }
    });

    archive.on('warning', (err) => {
      console.warn('Archive warning:', err);
    });

    // Pipe archive to response
    archive.pipe(res);
    
    // Add all files from SDK directory
    archive.directory(tempDir, false);
    
    // Finalize the archive
    await archive.finalize();
    
    console.log('SDK ZIP sent successfully');

    // Clean up temporary directory after a delay
    setTimeout(async () => {
      try {
        await fs.rmdir(tempDir, { recursive: true });
        console.log('Temporary SDK directory cleaned up');
      } catch (error) {
        console.warn('Failed to clean up temporary directory:', error);
      }
    }, 5000);

  } catch (error) {
    console.error('SDK generation failed:', error);
    next(error);
  }
});

/**
 * Get collection schemas
 */
router.get('/schemas', ensureServices, async (req, res, next) => {
  try {
    const schemas = await req.app.locals.schemaDiscovery.getAllCollectionSchemas();
    
    res.json({
      success: true,
      data: schemas,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get schema for specific collection
 */
router.get('/schemas/:collection', ensureServices, async (req, res, next) => {
  try {
    const { collection } = req.params;
    const { sampleSize = 100 } = req.query;
    
    const schema = await req.app.locals.schemaDiscovery.discoverCollectionSchema(
      collection, 
      parseInt(sampleSize)
    );
    
    res.json({
      success: true,
      data: schema,
      collection,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh schema cache
 */
router.post('/schemas/refresh', ensureServices, async (req, res, next) => {
  try {
    req.app.locals.schemaDiscovery.clearCache();
    
    const schemas = await req.app.locals.schemaDiscovery.getAllCollectionSchemas();
    
    res.json({
      success: true,
      message: 'Schema cache refreshed',
      data: schemas,
      refreshedAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get schema cache statistics
 */
router.get('/schemas/cache/stats', ensureServices, (req, res) => {
  const stats = req.app.locals.schemaDiscovery.getCacheStats();
  
  res.json({
    success: true,
    data: stats
  });
});

/**
 * SDK generation status and info
 */
router.get('/info', ensureServices, async (req, res, next) => {
  try {
    const collections = await req.app.locals.schemaDiscovery.dbService.listCollections();
    const cacheStats = req.app.locals.schemaDiscovery.getCacheStats();
    
    res.json({
      success: true,
      data: {
        available: true,
        collections: collections.map(c => c.name),
        collectionsCount: collections.length,
        schemaCache: cacheStats,
        supportedFormats: ['typescript'],
        endpoints: {
          openapi: '/api/sdk/openapi.json',
          docs: '/api/sdk/docs',
          typescript: '/api/sdk/typescript',
          schemas: '/api/sdk/schemas'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
