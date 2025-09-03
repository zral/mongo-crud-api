const express = require('express');
const multer = require('multer');
const BulkDataService = require('../services/bulkDataService');
const dbService = require('../services/database');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const fileExtension = file.originalname.toLowerCase().split('.').pop();
    
    if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(`.${fileExtension}`)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'), false);
    }
  }
});

// Initialize bulk data service
const bulkDataService = new BulkDataService(dbService);

/**
 * @swagger
 * /api/bulk/{collection}/preview:
 *   post:
 *     summary: Preview bulk data upload without inserting
 *     tags: [Bulk Data]
 *     parameters:
 *       - in: path
 *         name: collection
 *         required: true
 *         schema:
 *           type: string
 *         description: Collection name
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or Excel file to preview
 *               previewRows:
 *                 type: integer
 *                 description: Number of rows to preview (default 10)
 *     responses:
 *       200:
 *         description: File preview data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 preview:
 *                   type: object
 *                   properties:
 *                     fileName:
 *                       type: string
 *                     fileSize:
 *                       type: integer
 *                     totalRows:
 *                       type: integer
 *                     preview:
 *                       type: array
 *                     columns:
 *                       type: array
 *                     fileType:
 *                       type: string
 */
router.post('/:collection/preview', upload.single('file'), async (req, res) => {
  try {
    const { collection } = req.params;
    const previewRows = parseInt(req.body.previewRows) || 10;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const preview = await bulkDataService.previewFile(req.file, previewRows);

    res.json({
      success: true,
      collection,
      preview
    });
  } catch (error) {
    console.error('Preview error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bulk/{collection}/upload:
 *   post:
 *     summary: Upload bulk data to collection
 *     tags: [Bulk Data]
 *     parameters:
 *       - in: path
 *         name: collection
 *         required: true
 *         schema:
 *           type: string
 *         description: Collection name
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or Excel file to upload
 *               updateOnDuplicate:
 *                 type: boolean
 *                 description: Update existing documents on duplicate keys
 *               skipValidation:
 *                 type: boolean
 *                 description: Skip document validation
 *               batchSize:
 *                 type: integer
 *                 description: Batch size for processing (default 1000)
 *     responses:
 *       200:
 *         description: Upload results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 results:
 *                   type: object
 *                   properties:
 *                     totalRecords:
 *                       type: integer
 *                     insertedCount:
 *                       type: integer
 *                     modifiedCount:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                     duplicates:
 *                       type: array
 */
router.post('/:collection/upload', upload.single('file'), async (req, res) => {
  try {
    const { collection } = req.params;
    const {
      updateOnDuplicate = false,
      skipValidation = false,
      batchSize = 1000
    } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Process the file
    const data = await bulkDataService.processFile(req.file);

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid data found in file'
      });
    }

    // Bulk insert
    const results = await bulkDataService.bulkInsert(collection, data, {
      updateOnDuplicate: updateOnDuplicate === 'true',
      skipValidation: skipValidation === 'true',
      batchSize: parseInt(batchSize) || 1000
    });

    res.json({
      success: true,
      collection,
      file: {
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      },
      results
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @swagger
 * /api/bulk/{collection}/template:
 *   get:
 *     summary: Download CSV template for collection
 *     tags: [Bulk Data]
 *     parameters:
 *       - in: path
 *         name: collection
 *         required: true
 *         schema:
 *           type: string
 *         description: Collection name
 *       - in: query
 *         name: sampleData
 *         schema:
 *           type: boolean
 *         description: Include sample data in template
 *     responses:
 *       200:
 *         description: CSV template file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/:collection/template', async (req, res) => {
  try {
    const { collection } = req.params;
    const { sampleData = false } = req.query;

    const db = dbService.getDb();
    const coll = db.collection(collection);

    // Get sample document to infer schema
    const sampleDoc = await coll.findOne({});
    
    let headers = [];
    let sampleRows = [];

    if (sampleDoc) {
      // Extract headers from sample document
      headers = Object.keys(sampleDoc).filter(key => key !== '_id');
      
      if (sampleData === 'true') {
        // Get a few sample documents
        const samples = await coll.find({}).limit(3).toArray();
        sampleRows = samples.map(doc => {
          const row = {};
          headers.forEach(header => {
            row[header] = doc[header] || '';
          });
          return row;
        });
      }
    } else {
      // Default headers for new collection
      headers = ['name', 'description', 'value', 'category', 'created_at'];
      
      if (sampleData === 'true') {
        sampleRows = [
          {
            name: 'Sample Item 1',
            description: 'This is a sample description',
            value: 100,
            category: 'Sample Category',
            created_at: '2025-09-02'
          },
          {
            name: 'Sample Item 2',
            description: 'Another sample description',
            value: 200,
            category: 'Another Category',
            created_at: '2025-09-02'
          }
        ];
      }
    }

    // Generate CSV content
    let csvContent = headers.join(',') + '\n';
    
    if (sampleRows.length > 0) {
      sampleRows.forEach(row => {
        const values = headers.map(header => {
          const value = row[header] || '';
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += values.join(',') + '\n';
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${collection}_template.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file is allowed.'
      });
    }
  }
  
  res.status(400).json({
    success: false,
    message: error.message
  });
});

module.exports = router;
