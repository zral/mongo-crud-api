const express = require('express');
const dbService = require('../services/database');
const FilterService = require('../services/filterService');
const { Parser } = require('json2csv');

const router = express.Router();

// Middleware to validate collection name
const validateCollectionName = (req, res, next) => {
  const { collection } = req.params;
  
  if (!collection) {
    return res.status(400).json({
      success: false,
      error: 'Collection name is required'
    });
  }

  // Basic validation
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(collection)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid collection name format'
    });
  }

  next();
};

// GET /api/:collection - Get all documents in collection with advanced filtering
router.get('/:collection', validateCollectionName, async (req, res, next) => {
  try {
    const { collection } = req.params;
    const { page, limit, sort, fields, format, ...queryParams } = req.query;

    // Check if collection exists
    const exists = await dbService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Collection '${collection}' does not exist`
      });
    }

    // Build comprehensive filter from query parameters
    const filter = FilterService.buildCollectionFilter(queryParams);
    
    // Parse field selection for projection
    const projection = FilterService.parseFieldSelection(fields);

    // Check if CSV format is requested
    const acceptHeader = req.get('Accept');
    const requestsCSV = format === 'csv' || acceptHeader === 'text/csv' || acceptHeader === 'application/csv';
    
    // Build options object
    const options = { 
      page: requestsCSV ? null : page,  // Disable pagination for CSV
      limit: requestsCSV ? null : limit, // Disable limit for CSV
      sort,
      fields: projection
    };

    const result = await dbService.findDocuments(collection, filter, options);
    
    if (requestsCSV) {
      // Convert to CSV format
      if (!result.data || result.data.length === 0) {
        // Return empty CSV with headers if no data
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${collection}.csv"`
        });
        return res.send('');
      }

      try {
        // Get all unique fields from the data for CSV headers
        const allFields = new Set();
        result.data.forEach(doc => {
          Object.keys(doc).forEach(key => allFields.add(key));
        });

        const parser = new Parser({
          fields: Array.from(allFields),
          transforms: [
            // Handle nested objects by converting to JSON strings
            (item) => {
              const transformed = {};
              for (const [key, value] of Object.entries(item)) {
                if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                  transformed[key] = JSON.stringify(value);
                } else if (Array.isArray(value)) {
                  transformed[key] = value.join('; ');
                } else {
                  transformed[key] = value;
                }
              }
              return transformed;
            }
          ]
        });
        
        const csv = parser.parse(result.data);
        
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${collection}.csv"`
        });
        
        return res.send(csv);
      } catch (csvError) {
        return res.status(500).json({
          success: false,
          error: 'Failed to convert data to CSV format',
          details: csvError.message
        });
      }
    }
    
    // Default JSON response
    res.json({
      success: true,
      collection,
      ...result,
      appliedFilter: filter,
      appliedProjection: projection
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/:collection/:id - Get document by ID
router.get('/:collection/:id', validateCollectionName, async (req, res, next) => {
  try {
    const { collection, id } = req.params;

    // Check if collection exists
    const exists = await dbService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Collection '${collection}' does not exist`
      });
    }

    const document = await dbService.findDocumentById(collection, id);
    
    res.json({
      success: true,
      collection,
      data: document
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Invalid ObjectId')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

// POST /api/:collection - Create new document
router.post('/:collection', validateCollectionName, async (req, res, next) => {
  try {
    const { collection } = req.params;
    const document = req.body;

    if (!document || Object.keys(document).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Document data is required'
      });
    }

    // Collection will be created automatically if it doesn't exist
    const result = await dbService.insertDocument(collection, document);
    
    res.status(201).json({
      success: true,
      collection,
      message: 'Document created successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/:collection/:id - Update document by ID
router.put('/:collection/:id', validateCollectionName, async (req, res, next) => {
  try {
    const { collection, id } = req.params;
    const update = req.body;

    if (!update || Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Update data is required'
      });
    }

    // Check if collection exists
    const exists = await dbService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Collection '${collection}' does not exist`
      });
    }

    const result = await dbService.updateDocument(collection, id, update);
    
    res.json({
      success: true,
      collection,
      message: 'Document updated successfully',
      data: result
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Invalid ObjectId')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

// DELETE /api/:collection/:id - Delete document by ID
router.delete('/:collection/:id', validateCollectionName, async (req, res, next) => {
  try {
    const { collection, id } = req.params;

    // Check if collection exists
    const exists = await dbService.collectionExists(collection);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: `Collection '${collection}' does not exist`
      });
    }

    const result = await dbService.deleteDocument(collection, id);
    
    res.json({
      success: true,
      collection,
      message: 'Document deleted successfully',
      data: result
    });
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('Invalid ObjectId')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    next(error);
  }
});

module.exports = router;
