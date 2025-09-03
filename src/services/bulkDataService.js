const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

class BulkDataService {
  constructor(dbService) {
    this.dbService = dbService;
  }

  /**
   * Process uploaded file and extract data
   * @param {Object} file - Multer file object
   * @returns {Promise<Array>} Array of parsed data objects
   */
  async processFile(file) {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    switch (fileExtension) {
      case '.csv':
        return this.parseCSV(file);
      case '.xlsx':
      case '.xls':
        return this.parseExcel(file);
      default:
        throw new Error(`Unsupported file format: ${fileExtension}. Supported formats: .csv, .xlsx, .xls`);
    }
  }

  /**
   * Parse CSV file
   * @param {Object} file - Multer file object
   * @returns {Promise<Array>} Array of parsed data objects
   */
  async parseCSV(file) {
    return new Promise((resolve, reject) => {
      const results = [];
      const stream = Readable.from(file.buffer);
      
      stream
        .pipe(csv())
        .on('data', (data) => {
          // Clean up the data and convert empty strings to null
          const cleanData = this.cleanData(data);
          if (Object.keys(cleanData).length > 0) {
            results.push(cleanData);
          }
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        });
    });
  }

  /**
   * Parse Excel file
   * @param {Object} file - Multer file object
   * @returns {Promise<Array>} Array of parsed data objects
   */
  async parseExcel(file) {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      
      // Get the first worksheet
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new Error('Excel file has no worksheets');
      }

      const jsonData = [];
      let headers = [];
      
      // Read all rows
      worksheet.eachRow((row, rowNumber) => {
        const rowValues = [];
        
        // Get values from each cell in the row
        row.eachCell((cell, colNumber) => {
          rowValues[colNumber - 1] = cell.value;
        });
        
        if (rowNumber === 1) {
          // First row contains headers
          headers = rowValues.map(val => val ? String(val).trim() : '');
        } else {
          // Data rows
          const obj = {};
          headers.forEach((header, index) => {
            if (header && header.trim()) {
              const cellValue = rowValues[index];
              obj[header] = cellValue !== null && cellValue !== undefined ? cellValue : null;
            }
          });
          
          const cleanObj = this.cleanData(obj);
          if (Object.keys(cleanObj).length > 0) {
            jsonData.push(cleanObj);
          }
        }
      });

      if (jsonData.length === 0) {
        throw new Error('Excel file contains no data rows');
      }

      return jsonData;
    } catch (error) {
      throw new Error(`Excel parsing error: ${error.message}`);
    }
  }

  /**
   * Clean and normalize data
   * @param {Object} data - Raw data object
   * @returns {Object} Cleaned data object
   */
  cleanData(data) {
    const cleaned = {};
    
    for (const [key, value] of Object.entries(data)) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;

      let cleanValue = value;

      // Handle different data types
      if (typeof value === 'string') {
        cleanValue = value.trim();
        
        // Convert empty strings to null
        if (cleanValue === '') {
          cleanValue = null;
        }
        // Try to parse numbers
        else if (!isNaN(cleanValue) && !isNaN(parseFloat(cleanValue))) {
          cleanValue = parseFloat(cleanValue);
        }
        // Try to parse booleans
        else if (cleanValue.toLowerCase() === 'true') {
          cleanValue = true;
        } else if (cleanValue.toLowerCase() === 'false') {
          cleanValue = false;
        }
        // Try to parse dates (basic ISO format)
        else if (/^\d{4}-\d{2}-\d{2}/.test(cleanValue)) {
          const date = new Date(cleanValue);
          if (!isNaN(date.getTime())) {
            cleanValue = date;
          }
        }
      }

      cleaned[cleanKey] = cleanValue;
    }

    return cleaned;
  }

  /**
   * Bulk insert data into collection with validation and error handling
   * @param {string} collectionName - Name of the collection
   * @param {Array} data - Array of documents to insert
   * @param {Object} options - Insert options
   * @returns {Promise<Object>} Insert result with statistics
   */
  async bulkInsert(collectionName, data, options = {}) {
    const {
      skipValidation = false,
      updateOnDuplicate = false,
      batchSize = 1000
    } = options;

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Data must be a non-empty array');
    }

    const db = this.dbService.getDb();
    const collection = db.collection(collectionName);
    
    const results = {
      totalRecords: data.length,
      insertedCount: 0,
      modifiedCount: 0,
      errors: [],
      duplicates: [],
      skipped: []
    };

    // Process data in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        if (updateOnDuplicate) {
          // Use upsert for each document
          const operations = batch.map(doc => ({
            updateOne: {
              filter: { _id: doc._id || doc.id },
              update: { $set: doc },
              upsert: true
            }
          }));

          const result = await collection.bulkWrite(operations, { ordered: false });
          results.insertedCount += result.upsertedCount || 0;
          results.modifiedCount += result.modifiedCount || 0;
        } else {
          // Regular insert
          const result = await collection.insertMany(batch, { 
            ordered: false,
            ...(!skipValidation && { writeConcern: { w: 'majority' } })
          });
          results.insertedCount += result.insertedCount;
        }
      } catch (error) {
        // Handle bulk write errors
        if (error.writeErrors) {
          error.writeErrors.forEach(writeError => {
            const docIndex = i + writeError.index;
            if (writeError.code === 11000) { // Duplicate key error
              results.duplicates.push({
                index: docIndex,
                document: batch[writeError.index],
                error: 'Duplicate key'
              });
            } else {
              results.errors.push({
                index: docIndex,
                document: batch[writeError.index],
                error: writeError.errmsg
              });
            }
          });
        } else {
          // Other errors
          batch.forEach((doc, batchIndex) => {
            results.errors.push({
              index: i + batchIndex,
              document: doc,
              error: error.message
            });
          });
        }
      }
    }

    // Ensure collection exists (create if it doesn't exist)
    try {
      await this.dbService.createCollection(collectionName);
    } catch (error) {
      // Ignore error if collection already exists
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }

    return results;
  }

  /**
   * Validate file before processing
   * @param {Object} file - Multer file object
   * @param {Object} limits - File limits
   * @returns {Object} Validation result
   */
  validateFile(file, limits = {}) {
    const {
      maxSize = 10 * 1024 * 1024, // 10MB default
      allowedExtensions = ['.csv', '.xlsx', '.xls']
    } = limits;

    const errors = [];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    // Check file extension
    if (!allowedExtensions.includes(fileExtension)) {
      errors.push(`Unsupported file format: ${fileExtension}. Allowed: ${allowedExtensions.join(', ')}`);
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
    }

    // Check if file has content
    if (file.size === 0) {
      errors.push('File is empty');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Preview file data without inserting
   * @param {Object} file - Multer file object
   * @param {number} previewRows - Number of rows to preview
   * @returns {Promise<Object>} Preview data
   */
  async previewFile(file, previewRows = 10) {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
    }

    const data = await this.processFile(file);
    
    return {
      fileName: file.originalname,
      fileSize: file.size,
      totalRows: data.length,
      preview: data.slice(0, previewRows),
      columns: data.length > 0 ? Object.keys(data[0]) : [],
      fileType: path.extname(file.originalname).toLowerCase()
    };
  }
}

module.exports = BulkDataService;
