/**
 * Schema Discovery Service
 * Analyzes MongoDB collections to infer schemas for SDK generation
 */

const { ObjectId } = require('mongodb');

class SchemaDiscoveryService {
  constructor(dbService) {
    this.dbService = dbService;
    this.schemaCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Discover schema for a specific collection by analyzing sample documents
   */
  async discoverCollectionSchema(collectionName, sampleSize = 100) {
    const cacheKey = `schema:${collectionName}`;
    const cached = this.schemaCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.schema;
    }

    try {
      const collection = this.dbService.db.collection(collectionName);
      
      // Get sample documents using aggregation
      const samples = await collection
        .aggregate([{ $sample: { size: sampleSize } }])
        .toArray();

      if (samples.length === 0) {
        return this.generateEmptySchema(collectionName);
      }

      const schema = this.analyzeDocuments(samples, collectionName);
      
      // Cache the result
      this.schemaCache.set(cacheKey, {
        schema,
        timestamp: Date.now()
      });

      return schema;
    } catch (error) {
      console.error(`Schema discovery failed for ${collectionName}:`, error);
      return this.generateEmptySchema(collectionName);
    }
  }

  /**
   * Analyze array of documents to determine schema
   */
  analyzeDocuments(documents, collectionName) {
    const fieldTypes = new Map();
    const fieldFrequency = new Map();
    const examples = new Map();

    documents.forEach(doc => {
      this.analyzeDocument(doc, fieldTypes, fieldFrequency, examples, '');
    });

    const properties = {};
    const required = [];

    for (const [fieldPath, types] of fieldTypes) {
      const frequency = fieldFrequency.get(fieldPath) || 0;
      const isRequired = frequency > documents.length * 0.8; // 80% threshold
      
      if (isRequired && fieldPath !== '_id') {
        required.push(fieldPath);
      }

      properties[fieldPath] = this.determineFieldSchema(types, examples.get(fieldPath));
    }

    return {
      type: 'object',
      title: this.capitalizeCollectionName(collectionName),
      description: `Schema for ${collectionName} collection`,
      properties,
      required,
      additionalProperties: true,
      examples: documents.slice(0, 3).map(doc => this.sanitizeExample(doc))
    };
  }

  /**
   * Recursively analyze document structure
   */
  analyzeDocument(obj, fieldTypes, fieldFrequency, examples, prefix) {
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      // Track frequency
      fieldFrequency.set(fieldPath, (fieldFrequency.get(fieldPath) || 0) + 1);
      
      // Track types
      if (!fieldTypes.has(fieldPath)) {
        fieldTypes.set(fieldPath, new Set());
      }
      
      const type = this.getValueType(value);
      fieldTypes.get(fieldPath).add(type);
      
      // Store examples
      if (!examples.has(fieldPath)) {
        examples.set(fieldPath, []);
      }
      examples.get(fieldPath).push(value);
      
      // Recurse for nested objects
      if (type === 'object' && value !== null) {
        this.analyzeDocument(value, fieldTypes, fieldFrequency, examples, fieldPath);
      }
    }
  }

  /**
   * Determine JavaScript/MongoDB type of value
   */
  getValueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (ObjectId.isValid(value) && typeof value === 'object') return 'objectId';
    if (value instanceof Date) return 'date';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }

  /**
   * Generate schema definition for field with multiple types
   */
  determineFieldSchema(types, examples) {
    const typeArray = Array.from(types);
    
    if (typeArray.length === 1) {
      return this.generateSingleTypeSchema(typeArray[0], examples);
    }
    
    // Multiple types - use oneOf
    return {
      oneOf: typeArray.map(type => this.generateSingleTypeSchema(type, examples)),
      description: `Field can be one of: ${typeArray.join(', ')}`
    };
  }

  /**
   * Generate schema for single type
   */
  generateSingleTypeSchema(type, examples = []) {
    const validExamples = examples?.filter(ex => ex !== null && ex !== undefined).slice(0, 3);
    
    switch (type) {
      case 'string':
        return {
          type: 'string',
          examples: validExamples
        };
      case 'number':
        return {
          type: 'number',
          examples: validExamples
        };
      case 'boolean':
        return {
          type: 'boolean',
          examples: validExamples
        };
      case 'array':
        return {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
          examples: validExamples
        };
      case 'object':
        return {
          type: 'object',
          additionalProperties: true,
          examples: validExamples
        };
      case 'objectId':
        return {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'MongoDB ObjectId',
          examples: validExamples?.map(id => id.toString())
        };
      case 'date':
        return {
          type: 'string',
          format: 'date-time',
          examples: validExamples?.length > 0 ? validExamples.map(date => {
            if (date instanceof Date) {
              return date.toISOString();
            } else if (typeof date === 'string') {
              try {
                return new Date(date).toISOString();
              } catch (e) {
                return date;
              }
            }
            return String(date);
          }) : undefined
        };
      default:
        return {
          type: 'object',
          additionalProperties: true
        };
    }
  }

  /**
   * Generate schema for empty collection
   */
  generateEmptySchema(collectionName) {
    return {
      type: 'object',
      title: this.capitalizeCollectionName(collectionName),
      description: `Schema for empty ${collectionName} collection`,
      properties: {
        _id: {
          type: 'string',
          pattern: '^[0-9a-fA-F]{24}$',
          description: 'MongoDB ObjectId'
        }
      },
      additionalProperties: true
    };
  }

  /**
   * Get schemas for all collections
   */
  async getAllCollectionSchemas() {
    const collections = await this.dbService.listCollections();
    const schemas = {};
    
    for (const collection of collections) {
      schemas[collection.name] = await this.discoverCollectionSchema(collection.name);
    }
    
    return schemas;
  }

  /**
   * Capitalize collection name for interface names
   */
  capitalizeCollectionName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  /**
   * Remove sensitive fields from examples
   */
  sanitizeExample(doc) {
    const sanitized = { ...doc };
    delete sanitized.password;
    delete sanitized.secret;
    delete sanitized.token;
    delete sanitized.apiKey;
    
    return JSON.parse(JSON.stringify(sanitized, null, 0));
  }

  /**
   * Clear schema cache
   */
  clearCache() {
    this.schemaCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.schemaCache.size,
      entries: Array.from(this.schemaCache.keys())
    };
  }
}

module.exports = SchemaDiscoveryService;
