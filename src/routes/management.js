const express = require('express');

const router = express.Router();

// Get all collections
router.get('/collections', async (req, res, next) => {
  try {
    const dbService = req.app.locals.dbService;
    const collections = await dbService.listCollections();
    res.json({
      success: true,
      collections,
      count: collections.length
    });
  } catch (error) {
    next(error);
  }
});

// Create new collection
router.post('/collections', async (req, res, next) => {
  try {
    const { name } = req.body;
    const dbService = req.app.locals.dbService;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Collection name is required'
      });
    }

    // Validate collection name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid collection name. Must start with letter or underscore and contain only letters, numbers, and underscores'
      });
    }

    const result = await dbService.createCollection(name);
    res.status(201).json({
      success: true,
      message: `Collection '${name}' created successfully`,
      collection: result
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

// Drop collection
router.delete('/collections/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    const dbService = req.app.locals.dbService;
    
    const result = await dbService.dropCollection(name);
    res.json({
      success: true,
      message: `Collection '${name}' dropped successfully`,
      collection: result
    });
  } catch (error) {
    if (error.message.includes('does not exist')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

// Health check for management API
router.get('/health', async (req, res) => {
  try {
    const collections = await dbService.listCollections();
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      mongodb: {
        connected: dbService.isConnected(),
        collections: collections.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;
