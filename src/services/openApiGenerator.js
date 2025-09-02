/**
 * OpenAPI Specification Generator
 * Generates OpenAPI/Swagger specifications for dynamic MongoDB collections
 */

const swaggerJsdoc = require('swagger-jsdoc');

class OpenApiGenerator {
  constructor(schemaDiscovery) {
    this.schemaDiscovery = schemaDiscovery;
  }

  /**
   * Generate complete OpenAPI specification
   */
  async generateSpec(baseUrl = 'http://localhost:3001') {
    const collections = await this.schemaDiscovery.dbService.listCollections();
    const schemas = await this.schemaDiscovery.getAllCollectionSchemas();

    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'MongoDB CRUD REST API',
          version: '1.0.0',
          description: 'Dynamic MongoDB collection management with CRUD operations, webhooks, and advanced filtering',
          contact: {
            name: 'API Support',
            email: 'support@example.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: baseUrl,
            description: 'API Server'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          },
          schemas: {
            ...this.generateCommonSchemas(),
            ...this.generateCollectionSchemas(schemas)
          }
        },
        security: [{ bearerAuth: [] }]
      },
      apis: [] // We'll generate paths programmatically
    };

    const spec = swaggerJsdoc(options);
    
    // Add generated paths
    spec.paths = {
      ...this.generateManagementPaths(),
      ...this.generateWebhookPaths(),
      ...this.generateCollectionPaths(collections, schemas),
      ...this.generateSDKPaths()
    };

    return spec;
  }

  /**
   * Generate common schema definitions
   */
  generateCommonSchemas() {
    return {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' }
        },
        required: ['success']
      },
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'array',
            items: { type: 'object' }
          },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' }
            }
          },
          filter: {
            type: 'object',
            description: 'Applied filter information'
          }
        },
        required: ['success', 'data']
      },
      Document: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
            description: 'MongoDB ObjectId'
          }
        },
        additionalProperties: true,
        description: 'MongoDB document with flexible schema'
      },
      Webhook: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            pattern: '^[0-9a-fA-F]{24}$',
            description: 'MongoDB ObjectId'
          },
          name: {
            type: 'string',
            description: 'Webhook name'
          },
          url: {
            type: 'string',
            format: 'uri',
            description: 'Webhook endpoint URL'
          },
          collection: {
            type: 'string',
            description: 'Target collection name'
          },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['create', 'update', 'delete']
            },
            description: 'Events that trigger the webhook'
          },
          filters: {
            type: 'object',
            additionalProperties: true,
            description: 'MongoDB-style filter for selective triggering'
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the webhook is active'
          },
          rateLimit: {
            type: 'object',
            properties: {
              maxRequestsPerMinute: {
                type: 'integer',
                minimum: 1,
                maximum: 300,
                description: 'Maximum requests per minute'
              },
              maxRetries: {
                type: 'integer',
                minimum: 0,
                maximum: 10,
                description: 'Maximum retry attempts'
              },
              baseDelayMs: {
                type: 'integer',
                minimum: 100,
                maximum: 10000,
                description: 'Initial retry delay in milliseconds'
              },
              maxDelayMs: {
                type: 'integer',
                minimum: 1000,
                maximum: 300000,
                description: 'Maximum retry delay in milliseconds'
              }
            }
          },
          createdAt: {
            type: 'string',
            format: 'date-time'
          },
          updatedAt: {
            type: 'string',
            format: 'date-time'
          }
        },
        required: ['name', 'url', 'collection', 'events']
      },
      Collection: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Collection name'
          },
          type: {
            type: 'string',
            description: 'Collection type'
          },
          options: {
            type: 'object',
            description: 'Collection options'
          },
          info: {
            type: 'object',
            properties: {
              readOnly: { type: 'boolean' },
              uuid: { type: 'string' }
            }
          },
          idIndex: {
            type: 'object',
            description: 'Index information'
          }
        }
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false
          },
          error: {
            type: 'string',
            description: 'Error message'
          }
        },
        required: ['success', 'error']
      }
    };
  }

  /**
   * Generate schemas for discovered collections
   */
  generateCollectionSchemas(schemas) {
    const collectionSchemas = {};

    for (const [collectionName, schema] of Object.entries(schemas)) {
      const schemaName = this.capitalizeCollectionName(collectionName);
      collectionSchemas[schemaName] = {
        type: 'object',
        title: schema.title,
        description: schema.description,
        properties: schema.properties || {},
        required: schema.required || [],
        additionalProperties: true,
        examples: schema.examples || []
      };
    }

    return collectionSchemas;
  }

  /**
   * Generate management API paths
   */
  generateManagementPaths() {
    return {
      '/api/management/collections': {
        get: {
          tags: ['Management'],
          summary: 'List all collections',
          description: 'Get list of all MongoDB collections with metadata',
          responses: {
            200: {
              description: 'List of collections',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      collections: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Collection' }
                      },
                      count: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Management'],
          summary: 'Create new collection',
          description: 'Create a new MongoDB collection',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: {
                      type: 'string',
                      pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$',
                      description: 'Collection name'
                    }
                  },
                  required: ['name']
                }
              }
            }
          },
          responses: {
            201: {
              description: 'Collection created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            },
            409: {
              description: 'Collection already exists',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Error' }
                }
              }
            }
          }
        }
      },
      '/api/management/collections/{name}': {
        delete: {
          tags: ['Management'],
          summary: 'Delete collection',
          description: 'Drop a MongoDB collection and all its documents',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Collection name to delete'
            }
          ],
          responses: {
            200: {
              description: 'Collection deleted successfully'
            },
            404: {
              description: 'Collection not found'
            }
          }
        }
      },
      '/api/management/health': {
        get: {
          tags: ['Management'],
          summary: 'Health check',
          description: 'Check API and database health status',
          responses: {
            200: {
              description: 'System is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      status: { type: 'string' },
                      timestamp: { type: 'string', format: 'date-time' },
                      mongodb: {
                        type: 'object',
                        properties: {
                          connected: { type: 'boolean' },
                          collections: { type: 'integer' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  /**
   * Generate webhook API paths
   */
  generateWebhookPaths() {
    return {
      '/api/webhooks': {
        get: {
          tags: ['Webhooks'],
          summary: 'List all webhooks',
          description: 'Get all configured webhooks with their settings',
          responses: {
            200: {
              description: 'List of webhooks',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          webhooks: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Webhook' }
                          }
                        }
                      },
                      count: { type: 'integer' }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Webhooks'],
          summary: 'Create webhook',
          description: 'Create a new webhook with rate limiting configuration',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Webhook' }
              }
            }
          },
          responses: {
            201: {
              description: 'Webhook created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      },
      '/api/webhooks/{id}': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Webhook ID'
            }
          ],
          responses: {
            200: {
              description: 'Webhook details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Webhook' }
                }
              }
            }
          }
        },
        put: {
          tags: ['Webhooks'],
          summary: 'Update webhook',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Webhook' }
              }
            }
          },
          responses: {
            200: {
              description: 'Webhook updated successfully'
            }
          }
        },
        delete: {
          tags: ['Webhooks'],
          summary: 'Delete webhook',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Webhook deleted successfully'
            }
          }
        }
      },
      '/api/webhooks/{id}/test': {
        post: {
          tags: ['Webhooks'],
          summary: 'Test webhook',
          description: 'Send test payload to webhook endpoint',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Test completed'
            }
          }
        }
      },
      '/api/webhooks/stats': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook statistics',
          description: 'Get delivery statistics and system health',
          responses: {
            200: {
              description: 'Webhook statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          deliveryStatistics: { type: 'object' },
                          rateLimit: { type: 'object' },
                          systemHealth: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  /**
   * Generate dynamic collection paths
   */
  generateCollectionPaths(collections, schemas) {
    const paths = {};

    collections.forEach(collection => {
      const collectionName = collection.name;
      const schemaName = this.capitalizeCollectionName(collectionName);
      
      // Collection CRUD operations
      paths[`/api/${collectionName}`] = {
        get: {
          tags: [collectionName],
          summary: `List ${collectionName} documents`,
          description: `Retrieve paginated list of documents from ${collectionName} collection with advanced filtering`,
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
              description: 'Page number for pagination'
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
              description: 'Number of documents per page'
            },
            {
              name: 'sort',
              in: 'query',
              schema: { type: 'string' },
              description: 'Sort field and direction (e.g., "name" or "-date")'
            },
            {
              name: 'fields',
              in: 'query',
              schema: { type: 'string' },
              description: 'Comma-separated fields to include in response'
            },
            {
              name: 'filter',
              in: 'query',
              schema: { type: 'string' },
              description: 'MongoDB-style filter query (JSON string)'
            }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' }
                }
              }
            }
          }
        },
        post: {
          tags: [collectionName],
          summary: `Create ${collectionName} document`,
          description: `Create a new document in the ${collectionName} collection`,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: schemas[collectionName] ? 
                  { $ref: `#/components/schemas/${schemaName}` } :
                  { $ref: '#/components/schemas/Document' }
              }
            }
          },
          responses: {
            201: {
              description: 'Document created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      };

      // Individual document operations
      paths[`/api/${collectionName}/{id}`] = {
        get: {
          tags: [collectionName],
          summary: `Get ${collectionName} document by ID`,
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Document ID'
            }
          ],
          responses: {
            200: {
              description: 'Document found',
              content: {
                'application/json': {
                  schema: schemas[collectionName] ? 
                    { $ref: `#/components/schemas/${schemaName}` } :
                    { $ref: '#/components/schemas/Document' }
                }
              }
            },
            404: {
              description: 'Document not found'
            }
          }
        },
        put: {
          tags: [collectionName],
          summary: `Update ${collectionName} document`,
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: schemas[collectionName] ? 
                  { $ref: `#/components/schemas/${schemaName}` } :
                  { $ref: '#/components/schemas/Document' }
              }
            }
          },
          responses: {
            200: {
              description: 'Document updated successfully'
            }
          }
        },
        delete: {
          tags: [collectionName],
          summary: `Delete ${collectionName} document`,
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            200: {
              description: 'Document deleted successfully'
            }
          }
        }
      };
    });

    return paths;
  }

  /**
   * Generate SDK generation paths
   */
  generateSDKPaths() {
    return {
      '/api/sdk/openapi.json': {
        get: {
          tags: ['SDK'],
          summary: 'Get OpenAPI specification',
          description: 'Download the complete OpenAPI specification for SDK generation',
          responses: {
            200: {
              description: 'OpenAPI specification',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      },
      '/api/sdk/typescript': {
        get: {
          tags: ['SDK'],
          summary: 'Generate TypeScript SDK',
          description: 'Generate and download TypeScript SDK as ZIP file',
          parameters: [
            {
              name: 'packageName',
              in: 'query',
              schema: { type: 'string', default: '@your-org/mongodb-crud-sdk' },
              description: 'NPM package name for the SDK'
            },
            {
              name: 'apiUrl',
              in: 'query',
              schema: { type: 'string' },
              description: 'Base API URL for the SDK (defaults to current server)'
            }
          ],
          responses: {
            200: {
              description: 'TypeScript SDK ZIP file',
              content: {
                'application/zip': {
                  schema: { type: 'string', format: 'binary' }
                }
              }
            }
          }
        }
      },
      '/api/sdk/schemas': {
        get: {
          tags: ['SDK'],
          summary: 'Get collection schemas',
          description: 'Get inferred schemas for all collections',
          responses: {
            200: {
              description: 'Collection schemas',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    additionalProperties: {
                      type: 'object',
                      description: 'Collection schema'
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
  }

  /**
   * Capitalize collection name for schema names
   */
  capitalizeCollectionName(name) {
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
}

module.exports = OpenApiGenerator;
