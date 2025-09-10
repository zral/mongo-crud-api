/**
 * OpenAPI Specification Generator
 * Generates OpenAPI/Swagger specifications for dynamic MongoDB collections
 */

const swaggerJsdoc = require('swagger-jsdoc');
const config = require('../config');

class OpenApiGenerator {
  constructor(schemaDiscovery) {
    this.schemaDiscovery = schemaDiscovery;
    this.config = config.openapi;
  }

  /**
   * Generate complete OpenAPI specification
   */
  async generateSpec(baseUrl = null) {
    const collections = await this.schemaDiscovery.dbService.listCollections();
    const schemas = await this.schemaDiscovery.getAllCollectionSchemas();

    // Use provided baseUrl or fall back to config
    const serverUrl = baseUrl || (this.config.servers[0] ? this.config.servers[0].url : `http://localhost:${config.server.port}`);

    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: this.config.title,
          version: this.config.version,
          description: this.config.description,
          contact: {
            name: this.config.contact.name,
            email: this.config.contact.email,
            ...(this.config.contact.url && { url: this.config.contact.url })
          },
          license: {
            name: this.config.license.name,
            url: this.config.license.url
          }
        },
        servers: this.config.servers.length > 0 ? this.config.servers : [
          {
            url: serverUrl,
            description: 'API Server'
          }
        ],
        tags: [
          ...this.generateCollectionTags(collections),
          {
            name: 'CSV Export',
            description: 'Export collection data in CSV format for analysis and reporting'
          },
          {
            name: 'Management',
            description: 'Collection and system management operations'
          },
          {
            name: 'Webhooks',
            description: 'Real-time event notifications and webhook management'
          },
          {
            name: 'Scripts',
            description: 'JavaScript automation engine with event scripts and cron scheduling'
          },
          {
            name: 'SDK',
            description: 'SDK generation and API documentation endpoints'
          }
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: this.config.security.bearerFormat
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
      ...this.generateScriptPaths(),
      ...this.generateCollectionPaths(collections, schemas),
      ...this.generateSDKPaths()
    };

    return spec;
  }

  /**
   * Generate collection-specific tags
   */
  generateCollectionTags(collections) {
    return collections.map(collection => ({
      name: collection.name,
      description: `CRUD operations for ${collection.name} collection with JSON and CSV export support`
    }));
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
      EventScript: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: 'Script ID'
          },
          name: {
            type: 'string',
            description: 'Script name'
          },
          description: {
            type: 'string',
            description: 'Script description'
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
            description: 'Events that trigger the script'
          },
          filters: {
            type: 'object',
            description: 'MongoDB query filters to limit script execution'
          },
          code: {
            type: 'string',
            description: 'JavaScript code to execute'
          },
          enabled: {
            type: 'boolean',
            description: 'Whether the script is active'
          },
          rateLimit: {
            type: 'object',
            properties: {
              maxExecutionsPerMinute: {
                type: 'integer',
                minimum: 1,
                maximum: 300,
                description: 'Maximum executions per minute'
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
        required: ['name', 'collection', 'events', 'code']
      },
      ScheduledScript: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Scheduled script name'
          },
          cronExpression: {
            type: 'string',
            description: 'Cron expression for scheduling',
            example: '0 */1 * * *'
          },
          scriptCode: {
            type: 'string',
            description: 'JavaScript code to execute'
          },
          isRunning: {
            type: 'boolean',
            description: 'Whether the scheduled script is active'
          },
          lastExecution: {
            type: 'string',
            format: 'date-time',
            description: 'Last execution timestamp'
          },
          nextExecution: {
            type: 'string',
            format: 'date-time',
            description: 'Next scheduled execution'
          },
          executionCount: {
            type: 'integer',
            description: 'Total number of executions'
          }
        },
        required: ['name', 'cronExpression', 'scriptCode']
      },
      ScriptExecutionResult: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            description: 'Whether the script executed successfully'
          },
          result: {
            description: 'Script execution result'
          },
          error: {
            type: 'string',
            description: 'Error message if execution failed'
          },
          executionTime: {
            type: 'number',
            description: 'Execution time in milliseconds'
          }
        }
      },
      CSVExportResponse: {
        type: 'string',
        description: 'CSV format export of collection data',
        example: '_id,name,email,age,department\n507f1f77bcf86cd799439011,John Doe,john@example.com,30,Engineering\n507f1f77bcf86cd799439012,Jane Smith,jane@example.com,25,Sales',
        'x-content-type': 'text/csv',
        'x-export-features': [
          'Automatic field detection and CSV headers',
          'Nested objects converted to JSON strings',
          'Arrays joined with semicolons',
          'No pagination - exports all matching data',
          'Compatible with filtering and field selection',
          'Proper Content-Disposition headers for downloads'
        ]
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
   * Generate script API paths
   */
  generateScriptPaths() {
    return {
      '/api/scripts': {
        get: {
          tags: ['Scripts'],
          summary: 'List all event scripts',
          description: 'Get all configured event scripts with their settings',
          responses: {
            200: {
              description: 'List of event scripts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          scripts: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/EventScript' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Scripts'],
          summary: 'Create event script',
          description: 'Create a new event script with rate limiting configuration',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EventScript' }
              }
            }
          },
          responses: {
            201: {
              description: 'Script created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/{id}': {
        get: {
          tags: ['Scripts'],
          summary: 'Get event script by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Script ID'
            }
          ],
          responses: {
            200: {
              description: 'Event script details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/EventScript' }
                }
              }
            }
          }
        },
        put: {
          tags: ['Scripts'],
          summary: 'Update event script',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Script ID'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EventScript' }
              }
            }
          },
          responses: {
            200: {
              description: 'Script updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        },
        delete: {
          tags: ['Scripts'],
          summary: 'Delete event script',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Script ID'
            }
          ],
          responses: {
            200: {
              description: 'Script deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/{id}/test': {
        post: {
          tags: ['Scripts'],
          summary: 'Test event script execution',
          description: 'Execute a script with test payload to verify functionality',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Script ID'
            }
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    testPayload: {
                      type: 'object',
                      description: 'Custom test payload (optional)'
                    }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Script test result',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ScriptExecutionResult' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/stats': {
        get: {
          tags: ['Scripts'],
          summary: 'Get script execution statistics',
          description: 'Get statistics about script executions including success rates and performance metrics',
          responses: {
            200: {
              description: 'Script execution statistics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      totalScripts: { type: 'integer' },
                      activeScripts: { type: 'integer' },
                      totalExecutions: { type: 'integer' },
                      successfulExecutions: { type: 'integer' },
                      failedExecutions: { type: 'integer' },
                      averageExecutionTime: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/scripts/schedule': {
        get: {
          tags: ['Scheduled Scripts'],
          summary: 'List all scheduled scripts',
          description: 'Get all configured scheduled scripts with their cron settings',
          responses: {
            200: {
              description: 'List of scheduled scripts',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: { type: 'boolean' },
                      data: {
                        type: 'object',
                        properties: {
                          schedules: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/ScheduledScript' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          tags: ['Scheduled Scripts'],
          summary: 'Create scheduled script',
          description: 'Create a new scheduled script with cron expression',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScheduledScript' }
              }
            }
          },
          responses: {
            201: {
              description: 'Scheduled script created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/schedule/{name}': {
        get: {
          tags: ['Scheduled Scripts'],
          summary: 'Get scheduled script by name',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Scheduled script name'
            }
          ],
          responses: {
            200: {
              description: 'Scheduled script details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ScheduledScript' }
                }
              }
            }
          }
        },
        put: {
          tags: ['Scheduled Scripts'],
          summary: 'Update scheduled script',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Scheduled script name'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ScheduledScript' }
              }
            }
          },
          responses: {
            200: {
              description: 'Scheduled script updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        },
        delete: {
          tags: ['Scheduled Scripts'],
          summary: 'Delete scheduled script',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Scheduled script name'
            }
          ],
          responses: {
            200: {
              description: 'Scheduled script deleted successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/schedule/{name}/pause': {
        post: {
          tags: ['Scheduled Scripts'],
          summary: 'Pause scheduled script',
          description: 'Pause execution of a scheduled script',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Scheduled script name'
            }
          ],
          responses: {
            200: {
              description: 'Scheduled script paused successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/schedule/{name}/resume': {
        post: {
          tags: ['Scheduled Scripts'],
          summary: 'Resume scheduled script',
          description: 'Resume execution of a paused scheduled script',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Scheduled script name'
            }
          ],
          responses: {
            200: {
              description: 'Scheduled script resumed successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/scheduled/{name}/trigger': {
        post: {
          tags: ['Scheduled Scripts'],
          summary: 'Manually trigger scheduled script',
          description: 'Execute a scheduled script immediately regardless of schedule',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Scheduled script name'
            }
          ],
          responses: {
            200: {
              description: 'Scheduled script triggered successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ScriptExecutionResult' }
                }
              }
            }
          }
        }
      },
      '/api/scripts/cron/validate': {
        post: {
          tags: ['Scheduled Scripts'],
          summary: 'Validate cron expression',
          description: 'Validate and parse a cron expression to check if it is valid',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cronExpression: {
                      type: 'string',
                      description: 'Cron expression to validate',
                      example: '0 */1 * * *'
                    }
                  },
                  required: ['cronExpression']
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Cron expression validation result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      valid: { type: 'boolean' },
                      message: { type: 'string' },
                      nextExecutions: {
                        type: 'array',
                        items: { type: 'string', format: 'date-time' },
                        description: 'Next few execution times'
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
      paths[`/api/db/${collectionName}`] = {
        get: {
          tags: [collectionName, 'CSV Export'],
          summary: `List ${collectionName} documents`,
          description: `Retrieve paginated list of documents from ${collectionName} collection with advanced filtering. 

**Output Formats:**
- **JSON**: Standard paginated response with metadata
- **CSV**: Complete data export in CSV format (no pagination)

**CSV Export Features:**
- Automatic field detection and header generation
- Nested objects converted to JSON strings
- Arrays joined with semicolons
- Proper Content-Disposition headers for file downloads
- Works with all filtering and field selection parameters`,
          parameters: [
            {
              name: 'page',
              in: 'query',
              schema: { type: 'integer', minimum: 1, default: 1 },
              description: 'Page number for pagination (ignored for CSV format)'
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
              description: 'Number of documents per page (ignored for CSV format)'
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
              description: 'Comma-separated fields to include in response (works with CSV)'
            },
            {
              name: 'filter',
              in: 'query',
              schema: { type: 'string' },
              description: 'MongoDB-style filter query (JSON string, works with CSV)'
            },
            {
              name: 'format',
              in: 'query',
              schema: { type: 'string', enum: ['json', 'csv'], default: 'json' },
              description: 'Response format. CSV exports all matching data without pagination.'
            }
          ],
          responses: {
            200: {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedResponse' },
                  examples: {
                    standard: {
                      summary: 'Standard paginated response',
                      value: {
                        success: true,
                        data: [
                          { _id: '507f1f77bcf86cd799439011', name: 'John Doe', email: 'john@example.com' }
                        ],
                        pagination: { page: 1, limit: 10, total: 25, pages: 3 }
                      }
                    }
                  }
                },
                'text/csv': {
                  schema: {
                    type: 'string',
                    description: 'CSV format export with automatic headers and data conversion'
                  },
                  examples: {
                    basic: {
                      summary: 'Basic CSV export',
                      value: '_id,name,email,age\n507f1f77bcf86cd799439011,John Doe,john@example.com,30\n507f1f77bcf86cd799439012,Jane Smith,jane@example.com,25'
                    },
                    filtered: {
                      summary: 'Filtered CSV with selected fields',
                      value: 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com'
                    }
                  }
                }
              }
            },
            400: {
              description: 'Bad request - invalid parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
                }
              }
            },
            404: {
              description: 'Collection not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiResponse' }
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
      paths[`/api/db/${collectionName}/{id}`] = {
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
