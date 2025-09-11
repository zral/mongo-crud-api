const { MongoClient, ObjectId } = require('mongodb');
const config = require('../config');
const WebhookDeliveryService = require('./webhookDelivery');
const ScriptExecutionService = require('./scriptExecution');

class DatabaseService {
  constructor() {
    this.client = null;
    this.db = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = config.database.reconnection.maxAttempts;
    this.reconnectDelay = config.database.reconnection.initialDelay;
    this.maxReconnectDelay = config.database.reconnection.maxDelay;
    this.connectionMonitorInterval = null;
    this.webhookDelivery = new WebhookDeliveryService();
    this.scriptExecution = new ScriptExecutionService();
  }

  async connect() {
    const uri = config.database.uri;
    const dbName = config.database.name;

    try {
      await this.establishConnection(uri, dbName);
      this.startConnectionMonitoring();
      return true;
    } catch (error) {
      console.error('Initial database connection failed:', error.message);
      await this.handleConnectionFailure(uri, dbName);
      return false;
    }
  }

  async establishConnection(uri, dbName) {
    console.log(`Attempting to connect to MongoDB at ${uri}...`);
    
    const options = {
      maxPoolSize: config.database.connection.maxPoolSize,
      minPoolSize: config.database.connection.minPoolSize,
      maxIdleTimeMS: config.database.connection.maxIdleTimeMS,
      serverSelectionTimeoutMS: config.database.connection.serverSelectionTimeoutMS,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true
    };

    this.client = new MongoClient(uri, options);
    await this.client.connect();
    
    // Test the connection
    await this.client.db(dbName).admin().ping();
    
    this.db = this.client.db(dbName);
    this.connected = true;
    this.reconnectAttempts = 0;
    this.reconnectDelay = config.database.reconnection.initialDelay; // Reset delay
    
    console.log(`Successfully connected to MongoDB database: ${dbName}`);
    
    // Initialize database indexes
    await this.initializeDatabase();
    
    // Set database reference for script execution service and restore scheduled scripts
    this.scriptExecution.setDatabase(this.db);
    await this.scriptExecution.restoreScheduledScripts();
  }

  async handleConnectionFailure(uri, dbName) {
    this.connected = false;
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      console.error(`Failed to connect to MongoDB after ${this.maxReconnectAttempts} attempts. Giving up.`);
      throw new Error('Database connection failed permanently');
    }

    const currentDelay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Connection attempt ${this.reconnectAttempts} failed. Retrying in ${currentDelay}ms...`);
    
    await this.sleep(currentDelay);
    
    try {
      await this.establishConnection(uri, dbName);
      this.startConnectionMonitoring();
    } catch (error) {
      console.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error.message);
      await this.handleConnectionFailure(uri, dbName);
    }
  }

  startConnectionMonitoring() {
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
    }

    this.connectionMonitorInterval = setInterval(async () => {
      try {
        if (this.client && this.connected) {
          await this.client.db().admin().ping();
        }
      } catch (error) {
        console.error('Connection monitoring detected failure:', error.message);
        this.connected = false;
        
        const uri = config.database.uri;
        const dbName = config.database.name;
        
        await this.handleConnectionFailure(uri, dbName);
      }
    }, config.database.reconnection.monitorInterval);
  }

  async ensureConnection() {
    if (!this.connected || !this.client) {
      console.log('Database not connected, attempting to reconnect...');
      await this.connect();
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async initializeDatabase() {
    try {
      // Create indexes for better performance
      await this.db.collection('_webhooks').createIndex({ collection: 1, enabled: 1 });
      await this.db.collection('_webhooks').createIndex({ createdAt: 1 });
      
      console.log('Database indexes created successfully');
    } catch (error) {
      console.error('Error creating database indexes:', error.message);
    }
  }

  async disconnect() {
    if (this.connectionMonitorInterval) {
      clearInterval(this.connectionMonitorInterval);
    }
    
    if (this.client) {
      await this.client.close();
      this.connected = false;
      console.log('Disconnected from MongoDB');
    }
  }

  isConnected() {
    return this.connected;
  }

  getDb() {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db;
  }

  // Enhanced database operations with connection checking and retry logic
  async executeWithRetry(operation, operationName = 'database operation') {
    const maxAttempts = 3;
    let attempt = 1;

    while (attempt <= maxAttempts) {
      try {
        await this.ensureConnection();
        return await operation();
      } catch (error) {
        console.error(`${operationName} attempt ${attempt} failed:`, error.message);
        
        if (attempt === maxAttempts) {
          throw error;
        }
        
        // If it's a connection error, try to reconnect
        if (this.isConnectionError(error)) {
          this.connected = false;
          await this.sleep(1000 * attempt); // Progressive delay
        } else {
          throw error; // Non-connection errors should be thrown immediately
        }
        
        attempt++;
      }
    }
  }

  isConnectionError(error) {
    const connectionErrorMessages = [
      'connection closed',
      'connection refused',
      'network error',
      'timeout',
      'server selection timed out',
      'topology was destroyed',
      'no connection available'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return connectionErrorMessages.some(msg => errorMessage.includes(msg));
  }

  // Collection management
  async listCollections() {
    try {
      const collections = await this.db.listCollections().toArray();
      
      // Get enhanced statistics for each collection
      const enhancedCollections = await Promise.all(
        collections.map(async (col) => {
          try {
            const collection = this.db.collection(col.name);
            
            // Get document count
            const documentCount = await collection.countDocuments();
            
            // Get last updated timestamp (most recent document update)
            let lastUpdated = null;
            try {
              const lastDocument = await collection
                .findOne(
                  {},
                  {
                    sort: { updatedAt: -1 },
                    projection: { updatedAt: 1, createdAt: 1 }
                  }
                );
              
              if (lastDocument) {
                lastUpdated = lastDocument.updatedAt || lastDocument.createdAt || null;
              }
            } catch (timestampError) {
              // If updatedAt doesn't exist, try finding the most recent _id (ObjectId contains timestamp)
              try {
                const recentDoc = await collection
                  .findOne({}, { sort: { _id: -1 }, projection: { _id: 1 } });
                if (recentDoc && recentDoc._id && recentDoc._id.getTimestamp) {
                  lastUpdated = recentDoc._id.getTimestamp();
                }
              } catch (idError) {
                // Ignore timestamp extraction errors
              }
            }
            
            return {
              name: col.name,
              type: col.type || 'collection',
              options: col.options || {},
              stats: {
                documentCount,
                lastUpdated: lastUpdated ? lastUpdated.toISOString() : null
              }
            };
          } catch (statError) {
            console.warn(`Failed to get stats for collection ${col.name}:`, statError.message);
            return {
              name: col.name,
              type: col.type || 'collection',
              options: col.options || {},
              stats: {
                documentCount: 0,
                lastUpdated: null
              }
            };
          }
        })
      );
      
      return enhancedCollections;
    } catch (error) {
      throw new Error(`Failed to list collections: ${error.message}`);
    }
  }

  async createCollection(name) {
    try {
      // Check if collection already exists
      const collections = await this.listCollections();
      const exists = collections.some(col => col.name === name);
      
      if (exists) {
        throw new Error(`Collection '${name}' already exists`);
      }

      await this.db.createCollection(name);
      return { name, created: true };
    } catch (error) {
      throw new Error(`Failed to create collection: ${error.message}`);
    }
  }

  async dropCollection(name) {
    try {
      const collection = this.db.collection(name);
      const exists = await collection.countDocuments({}, { limit: 1 });
      
      if (exists === 0) {
        // Check if collection exists but is empty
        const collections = await this.listCollections();
        const collectionExists = collections.some(col => col.name === name);
        if (!collectionExists) {
          throw new Error(`Collection '${name}' does not exist`);
        }
      }

      await this.db.dropCollection(name);
      return { name, dropped: true };
    } catch (error) {
      if (error.message.includes('ns not found')) {
        throw new Error(`Collection '${name}' does not exist`);
      }
      throw new Error(`Failed to drop collection: ${error.message}`);
    }
  }

    // CRUD operations
  async findDocuments(collectionName, filter = {}, options = {}) {
    try {
      const collection = this.db.collection(collectionName);
      const { 
        page = 1, 
        limit = config.api.pagination.defaultPageSize, 
        sort, 
        fields 
      } = options;
      
      // Check if pagination is disabled (for CSV export)
      const noPagination = page === null || limit === null;
      
      // Validate pagination limits
      if (!noPagination && limit > config.api.pagination.maxPageSize) {
        throw new Error(`Limit cannot exceed ${config.api.pagination.maxPageSize}`);
      }
      
      let documents, total;
      
      if (noPagination) {
        // No pagination - return all matching documents
        let query = collection.find(filter);
        
        // Apply field projection if specified
        if (fields && Object.keys(fields).length > 0) {
          query = query.project(fields);
        }
        
        // Apply sorting
        if (sort) {
          const sortObj = {};
          if (sort.startsWith('-')) {
            sortObj[sort.substring(1)] = -1;
          } else {
            sortObj[sort] = 1;
          }
          query = query.sort(sortObj);
        }
        
        documents = await query.toArray();
        total = documents.length;
        
        return {
          data: documents,
          pagination: null, // No pagination info for full export
          filter: filter
        };
      } else {
        // Standard pagination
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Build query with projection
        let query = collection.find(filter);
        
        // Apply field projection if specified
        if (fields && Object.keys(fields).length > 0) {
          query = query.project(fields);
        }
        
        // Apply pagination
        query = query.skip(skip).limit(limitNum);

        // Apply sorting
        if (sort) {
          const sortObj = {};
          if (sort.startsWith('-')) {
            sortObj[sort.substring(1)] = -1;
          } else {
            sortObj[sort] = 1;
          }
          query = query.sort(sortObj);
        }

        documents = await query.toArray();
        total = await collection.countDocuments(filter);

        return {
          data: documents,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum)
          },
          filter: filter // Include applied filter in response
        };
      }
    } catch (error) {
      throw new Error(`Failed to find documents: ${error.message}`);
    }
  }

  async findDocumentById(collectionName, id) {
    try {
      const collection = this.db.collection(collectionName);
      const objectId = this.toObjectId(id);
      const document = await collection.findOne({ _id: objectId });
      
      if (!document) {
        throw new Error(`Document with id '${id}' not found`);
      }
      
      return document;
    } catch (error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to find document: ${error.message}`);
    }
  }

  async insertDocument(collectionName, document) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection(collectionName);
      
      // Add timestamp
      const docWithTimestamp = {
        ...document,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(docWithTimestamp);
      const insertedDoc = await collection.findOne({ _id: result.insertedId });
      
      // Trigger webhooks for create operation
      setImmediate(() => {
        this.triggerWebhooksForOperation(collectionName, 'create', insertedDoc);
        this.triggerScriptsForOperation(collectionName, 'create', insertedDoc);
      });
      
      return insertedDoc;
    }, 'insert document');
  }

  async updateDocument(collectionName, id, update) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection(collectionName);
      const objectId = this.toObjectId(id);
      
      // Get the old document first for webhook
      const oldDocument = await collection.findOne({ _id: objectId });
      if (!oldDocument) {
        throw new Error(`Document with id '${id}' not found`);
      }
      
      // Add timestamp
      const updateWithTimestamp = {
        ...update,
        updatedAt: new Date()
      };

      const result = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: updateWithTimestamp },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Document with id '${id}' not found`);
      }

      // Trigger webhooks for update operation
      setImmediate(() => {
        this.triggerWebhooksForOperation(collectionName, 'update', result, oldDocument);
        this.triggerScriptsForOperation(collectionName, 'update', result, oldDocument);
      });

      return result;
    }, 'update document');
  }

  async deleteDocument(collectionName, id) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection(collectionName);
      const objectId = this.toObjectId(id);
      
      const result = await collection.findOneAndDelete({ _id: objectId });
      
      if (!result) {
        throw new Error(`Document with id '${id}' not found`);
      }

      // Trigger webhooks for delete operation
      setImmediate(() => {
        this.triggerWebhooksForOperation(collectionName, 'delete', null, result);
        this.triggerScriptsForOperation(collectionName, 'delete', null, result);
      });

      return result;
    }, 'delete document');
  }

  // Helper methods
  toObjectId(id) {
    try {
      // If it's already an ObjectId, return it
      if (id instanceof ObjectId) {
        return id;
      }
      
      // If it's a valid ObjectId string (24 hex characters), convert it
      if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
        return new ObjectId(id);
      }
      
      // Otherwise, return the string as-is for custom string IDs
      return id;
    } catch (error) {
      // If ObjectId conversion fails, return the original value
      return id;
    }
  }

  async collectionExists(name) {
    try {
      const collections = await this.listCollections();
      return collections.some(col => col.name === name);
    } catch (error) {
      return false;
    }
  }

  // Webhook management methods
  async getAllWebhooks() {
    try {
      const collection = this.db.collection('_webhooks');
      return await collection.find({}).toArray();
    } catch (error) {
      throw new Error(`Failed to fetch webhooks: ${error.message}`);
    }
  }

  async createWebhook(webhook) {
    try {
      const collection = this.db.collection('_webhooks');
      const result = await collection.insertOne(webhook);
      return { ...webhook, _id: result.insertedId };
    } catch (error) {
      throw new Error(`Failed to create webhook: ${error.message}`);
    }
  }

  async getWebhookById(id) {
    try {
      const collection = this.db.collection('_webhooks');
      const objectId = this.toObjectId(id);
      return await collection.findOne({ _id: objectId });
    } catch (error) {
      throw new Error(`Failed to fetch webhook: ${error.message}`);
    }
  }

  async updateWebhook(id, updates) {
    try {
      const collection = this.db.collection('_webhooks');
      const objectId = this.toObjectId(id);
      
      const result = await collection.findOneAndUpdate(
        { _id: objectId },
        { $set: updates },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error(`Webhook with id '${id}' not found`);
      }

      return result;
    } catch (error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to update webhook: ${error.message}`);
    }
  }

  async deleteWebhook(id) {
    try {
      const collection = this.db.collection('_webhooks');
      const objectId = this.toObjectId(id);
      
      const result = await collection.findOneAndDelete({ _id: objectId });
      
      if (!result) {
        throw new Error(`Webhook with id '${id}' not found`);
      }

      return result;
    } catch (error) {
      if (error.message.includes('not found')) {
        throw error;
      }
      throw new Error(`Failed to delete webhook: ${error.message}`);
    }
  }

  async getWebhooksForCollection(collectionName, event) {
    try {
      const collection = this.db.collection('_webhooks');
      return await collection.find({
        collection: collectionName,
        events: event,
        enabled: true
      }).toArray();
    } catch (error) {
      console.error(`Failed to fetch webhooks for collection ${collectionName}:`, error);
      return [];
    }
  }

  matchesFilter(document, filters) {
    if (!filters || Object.keys(filters).length === 0) {
      return true; // No filters means match all
    }

    for (const [field, condition] of Object.entries(filters)) {
      const value = this.getNestedValue(document, field);
      
      if (typeof condition === 'object' && condition !== null) {
        // Handle operators like $eq, $ne, $gt, $lt, $in, etc.
        for (const [operator, expectedValue] of Object.entries(condition)) {
          switch (operator) {
            case '$eq':
              if (value !== expectedValue) return false;
              break;
            case '$ne':
              if (value === expectedValue) return false;
              break;
            case '$gt':
              if (value <= expectedValue) return false;
              break;
            case '$gte':
              if (value < expectedValue) return false;
              break;
            case '$lt':
              if (value >= expectedValue) return false;
              break;
            case '$lte':
              if (value > expectedValue) return false;
              break;
            case '$in':
              if (!Array.isArray(expectedValue) || !expectedValue.includes(value)) return false;
              break;
            case '$nin':
              if (Array.isArray(expectedValue) && expectedValue.includes(value)) return false;
              break;
            case '$regex':
              const regex = new RegExp(expectedValue, condition.$options || '');
              if (!regex.test(String(value))) return false;
              break;
            case '$exists':
              const exists = value !== undefined;
              if (exists !== expectedValue) return false;
              break;
            default:
              console.warn(`Unknown filter operator: ${operator}`);
          }
        }
      } else {
        // Direct value comparison
        if (value !== condition) return false;
      }
    }
    
    return true;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  async triggerWebhook(url, payload) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MongoCRUD-Webhook/1.0'
        },
        body: JSON.stringify(payload),
        timeout: 10000 // 10 second timeout
      });

      return {
        status: response.status,
        statusText: response.statusText,
        success: response.ok
      };
    } catch (error) {
      console.error(`Failed to trigger webhook ${url}:`, error);
      return {
        status: 0,
        statusText: error.message,
        success: false
      };
    }
  }

  async triggerWebhooksForOperation(collectionName, event, document, oldDocument = null) {
    try {
      const webhooks = await this.getWebhooksForCollection(collectionName, event);
      
      if (webhooks.length === 0) {
        return;
      }

      console.log(`Triggering ${webhooks.length} webhooks for ${event} on ${collectionName}`);

      // Use Promise.allSettled to ensure one failed webhook doesn't block others
      const promises = webhooks.map(async (webhook) => {
        try {
          // Check if document matches webhook filters
          const documentToCheck = event === 'delete' ? oldDocument : document;
          if (!this.matchesFilter(documentToCheck, webhook.filters)) {
            console.log(`Document doesn't match filters for webhook ${webhook.name}`);
            return;
          }

          // Filter out excluded fields from document data
          const filteredDocument = this.filterExcludedFields(document, webhook.excludeFields);
          const filteredOldDocument = oldDocument ? this.filterExcludedFields(oldDocument, webhook.excludeFields) : null;

          const payload = {
            event,
            webhook: {
              id: webhook._id,
              name: webhook.name
            },
            collection: collectionName,
            timestamp: new Date().toISOString(),
            data: {
              document: filteredDocument,
              ...(filteredOldDocument && { oldDocument: filteredOldDocument })
            }
          };

          // Use the new webhook delivery service with rate limiting and retry
          await this.webhookDelivery.deliverWebhook(webhook, payload);
        } catch (error) {
          console.error(`Failed to trigger webhook ${webhook.name}:`, error.message);
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error(`Failed to trigger webhooks for ${event} on ${collectionName}:`, error.message);
    }
  }

  /**
   * Remove specified fields from a document
   * @param {Object} document - The document to filter
   * @param {Array} excludeFields - Array of field names to exclude
   * @returns {Object} - Filtered document
   */
  filterExcludedFields(document, excludeFields = []) {
    if (!excludeFields || excludeFields.length === 0 || !document) {
      return document;
    }

    // Create a deep copy to avoid modifying the original document
    const filtered = JSON.parse(JSON.stringify(document));
    
    // Remove excluded fields
    excludeFields.forEach(field => {
      // Support nested field exclusion with dot notation
      if (field.includes('.')) {
        const parts = field.split('.');
        let current = filtered;
        for (let i = 0; i < parts.length - 1; i++) {
          if (current && typeof current === 'object' && current[parts[i]]) {
            current = current[parts[i]];
          } else {
            return; // Field doesn't exist
          }
        }
        if (current && typeof current === 'object') {
          delete current[parts[parts.length - 1]];
        }
      } else {
        delete filtered[field];
      }
    });

    return filtered;
  }

  // Script management functions
  async triggerScriptsForOperation(collectionName, event, document, oldDocument = null) {
    try {
      const scripts = await this.getScriptsForCollection(collectionName, event);
      
      if (scripts.length === 0) {
        return;
      }

      console.log(`Triggering ${scripts.length} scripts for ${event} on ${collectionName}`);

      // Use Promise.allSettled to ensure one failed script doesn't block others
      const promises = scripts.map(async (script) => {
        try {
          // Check if document matches script filters
          const documentToCheck = event === 'delete' ? oldDocument : document;
          if (!this.matchesFilter(documentToCheck, script.filters)) {
            console.log(`Document doesn't match filters for script ${script.name}`);
            return;
          }

          const payload = {
            event,
            script: {
              id: script._id,
              name: script.name
            },
            collection: collectionName,
            timestamp: new Date().toISOString(),
            data: {
              document: document,
              ...(oldDocument && { oldDocument })
            }
          };

          // Execute the script with rate limiting and retry
          await this.scriptExecution.executeScriptWithRetry(script, payload);
        } catch (error) {
          console.error(`Failed to execute script ${script.name}:`, error.message);
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.error(`Failed to trigger scripts for ${event} on ${collectionName}:`, error.message);
    }
  }

  async getAllScripts() {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection('_scripts');
      return await collection.find({}).toArray();
    }, 'get all scripts');
  }

  async createScript(script) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection('_scripts');
      const result = await collection.insertOne(script);
      return await collection.findOne({ _id: result.insertedId });
    }, 'create script');
  }

  async getScriptById(id) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection('_scripts');
      const objectId = this.toObjectId(id);
      return await collection.findOne({ _id: objectId });
    }, 'get script by id');
  }

  async updateScript(id, update) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection('_scripts');
      const objectId = this.toObjectId(id);
      return await collection.updateOne({ _id: objectId }, { $set: update });
    }, 'update script');
  }

  async deleteScript(id) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection('_scripts');
      const objectId = this.toObjectId(id);
      return await collection.deleteOne({ _id: objectId });
    }, 'delete script');
  }

  async getScriptsForCollection(collectionName, event = null) {
    return await this.executeWithRetry(async () => {
      const collection = this.db.collection('_scripts');
      const query = {
        // Include scripts for specific collection OR global scripts (empty collection)
        $or: [
          { collection: collectionName },
          { collection: "" }
        ],
        enabled: true
      };
      
      if (event) {
        query.events = { $in: [event] };
      }
      
      return await collection.find(query).toArray();
    }, 'get scripts for collection');
  }
}

module.exports = DatabaseService;
