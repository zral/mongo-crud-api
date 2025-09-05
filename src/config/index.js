/**
 * Configuration Service
 * Centralizes all application configuration with environment variable support
 */

require('dotenv').config();

class Config {
  constructor() {
    this.loadConfiguration();
  }

  loadConfiguration() {
    // Server Configuration
    this.server = {
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || '0.0.0.0',
      nodeEnv: process.env.NODE_ENV || 'development',
      cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: process.env.CORS_CREDENTIALS === 'true' || false
      },
      middleware: {
        jsonLimit: process.env.JSON_LIMIT || '10mb',
        logFormat: process.env.LOG_FORMAT || 'combined'
      }
    };

    // Database Configuration
    this.database = {
      connectionString: process.env.MONGODB_CONNECTION_STRING || process.env.MONGODB_URI || 'mongodb://localhost:27017',
      databaseName: process.env.MONGODB_DATABASE_NAME || process.env.DATABASE_NAME || 'crud_api',
      uri: process.env.MONGODB_CONNECTION_STRING || process.env.MONGODB_URI || 'mongodb://localhost:27017/crud_api',
      name: process.env.MONGODB_DATABASE_NAME || process.env.DATABASE_NAME || this.extractDbNameFromUri(process.env.MONGODB_URI) || 'crud_api',
      connection: {
        maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
        minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
        maxIdleTimeMS: parseInt(process.env.DB_MAX_IDLE_TIME_MS) || 30000,
        serverSelectionTimeoutMS: parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
        heartbeatFrequencyMS: parseInt(process.env.DB_HEARTBEAT_FREQUENCY_MS) || 10000
      },
      reconnection: {
        maxAttempts: parseInt(process.env.DB_MAX_RECONNECT_ATTEMPTS) || 5,
        initialDelay: parseInt(process.env.DB_RECONNECT_INITIAL_DELAY) || 1000,
        maxDelay: parseInt(process.env.DB_RECONNECT_MAX_DELAY) || 30000,
        monitorInterval: parseInt(process.env.DB_CONNECTION_MONITOR_INTERVAL) || 30000
      }
    };

    // API Configuration
    this.api = {
      pagination: {
        defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE) || 10,
        maxPageSize: parseInt(process.env.MAX_PAGE_SIZE) || 100
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
        maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
        skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL === 'true' || false
      },
      csv: {
        maxExportRecords: parseInt(process.env.CSV_MAX_EXPORT_RECORDS) || 100000,
        delimiter: process.env.CSV_DELIMITER || ',',
        quoteChar: process.env.CSV_QUOTE_CHAR || '"',
        escapeChar: process.env.CSV_ESCAPE_CHAR || '"'
      }
    };

    // OpenAPI Configuration
    this.openapi = {
      title: process.env.OPENAPI_TITLE || 'MongoDB CRUD REST API',
      version: process.env.OPENAPI_VERSION || '1.0.0',
      description: process.env.OPENAPI_DESCRIPTION || this.getDefaultDescription(),
      contact: {
        name: process.env.OPENAPI_CONTACT_NAME || 'API Support',
        email: process.env.OPENAPI_CONTACT_EMAIL || 'support@example.com',
        url: process.env.OPENAPI_CONTACT_URL || null
      },
      license: {
        name: process.env.OPENAPI_LICENSE_NAME || 'MIT',
        url: process.env.OPENAPI_LICENSE_URL || 'https://opensource.org/licenses/MIT'
      },
      servers: this.parseServers(),
      security: {
        bearerFormat: process.env.OPENAPI_BEARER_FORMAT || 'JWT'
      }
    };

    // Webhook Configuration
    this.webhooks = {
      timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 5000,
      maxRetries: parseInt(process.env.WEBHOOK_MAX_RETRIES) || 3,
      retryDelay: parseInt(process.env.WEBHOOK_RETRY_DELAY) || 1000,
      maxRetryDelay: parseInt(process.env.WEBHOOK_MAX_RETRY_DELAY) || 30000,
      rateLimit: {
        defaultMaxRequestsPerMinute: parseInt(process.env.WEBHOOK_DEFAULT_RATE_LIMIT) || 60,
        windowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS) || 60000,
        backoffMultiplier: parseFloat(process.env.WEBHOOK_BACKOFF_MULTIPLIER) || 2
      }
    };

    // Script Configuration
    this.scripts = {
      execution: {
        timeout: parseInt(process.env.SCRIPT_EXECUTION_TIMEOUT) || 30000,
        maxMemory: parseInt(process.env.SCRIPT_MAX_MEMORY) || 128, // MB
        sandboxed: process.env.SCRIPT_SANDBOXED !== 'false',
        // API URL for scripts to make HTTP calls back to the API
        // In Docker Compose: http://nginx:80
        // In Kubernetes: http://crud-api-service:80 or localhost
        // In development: http://localhost:3000
        apiBaseUrl: process.env.SCRIPT_API_BASE_URL || this.getDefaultApiUrl()
      },
      rateLimit: {
        defaultMaxExecutionsPerMinute: parseInt(process.env.SCRIPT_DEFAULT_RATE_LIMIT) || 30,
        maxRetries: parseInt(process.env.SCRIPT_MAX_RETRIES) || 3,
        baseDelayMs: parseInt(process.env.SCRIPT_BASE_DELAY_MS) || 1000,
        maxDelayMs: parseInt(process.env.SCRIPT_MAX_DELAY_MS) || 30000
      },
      cron: {
        timezone: process.env.SCRIPT_CRON_TIMEZONE || 'UTC',
        maxConcurrentJobs: parseInt(process.env.SCRIPT_MAX_CONCURRENT_JOBS) || 10
      }
    };

    // Health Check Configuration
    this.health = {
      endpoint: process.env.HEALTH_ENDPOINT || '/health',
      interval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
      timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000
    };

    // Security Configuration
    this.security = {
      helmet: {
        contentSecurityPolicy: process.env.SECURITY_CSP !== 'false',
        crossOriginEmbedderPolicy: process.env.SECURITY_COEP !== 'false'
      },
      authentication: {
        enabled: process.env.AUTH_ENABLED === 'true' || false,
        jwtSecret: process.env.JWT_SECRET || null,
        jwtExpiration: process.env.JWT_EXPIRATION || '24h'
      }
    };

    // Development Configuration
    this.development = {
      hotReload: process.env.DEV_HOT_RELOAD !== 'false',
      verbose: process.env.DEV_VERBOSE === 'true' || false,
      mockData: process.env.DEV_MOCK_DATA === 'true' || false
    };

    // Redis Configuration
    this.redis = {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES) || 3,
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY) || 100,
      lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
      enableReadyCheck: process.env.REDIS_READY_CHECK !== 'false'
    };

    // Cluster Configuration
    this.cluster = {
      instanceId: process.env.INSTANCE_ID || process.env.HOSTNAME || require('os').hostname(),
      cronLeaderElection: process.env.CRON_LEADER_ELECTION !== 'false',
      webhookProcessingConcurrency: parseInt(process.env.WEBHOOK_CONCURRENCY) || 5,
      enableDistributedLocking: process.env.ENABLE_DISTRIBUTED_LOCKING !== 'false'
    };

    // Scaling Configuration
    this.scaling = {
      maxScriptExecutionTime: parseInt(process.env.MAX_SCRIPT_EXECUTION_TIME) || 300000,
      lockTtl: parseInt(process.env.LOCK_TTL) || 60000,
      leadershipRenewalInterval: parseInt(process.env.LEADERSHIP_RENEWAL_INTERVAL) || 30000,
      lockCleanupInterval: parseInt(process.env.LOCK_CLEANUP_INTERVAL) || 300000 // 5 minutes
    };
  }

  /**
   * Extract database name from MongoDB URI
   */
  extractDbNameFromUri(uri) {
    if (!uri) return null;
    try {
      const match = uri.match(/\/([^/?]+)(\?|$)/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get default API URL for script execution based on environment
   */
  getDefaultApiUrl() {
    // Check for Kubernetes environment
    if (process.env.KUBERNETES_SERVICE_HOST) {
      // In Kubernetes, use the service name
      return 'http://crud-api-service:80';
    }
    
    // Check for Docker Compose environment (nginx container exists)
    if (process.env.NGINX_HOST || process.env.COMPOSE_PROJECT_NAME) {
      return 'http://nginx:80';
    }
    
    // Default to localhost for development
    return `http://localhost:${this.server.port}`;
  }

  /**
   * Parse server URLs from environment
   */
  parseServers() {
    const servers = [];
    
    // Primary server
    const baseUrl = process.env.OPENAPI_BASE_URL || `http://localhost:${this.server.port}`;
    servers.push({
      url: baseUrl,
      description: process.env.OPENAPI_SERVER_DESCRIPTION || 'API Server'
    });

    // Additional servers
    if (process.env.OPENAPI_ADDITIONAL_SERVERS) {
      try {
        const additionalServers = JSON.parse(process.env.OPENAPI_ADDITIONAL_SERVERS);
        servers.push(...additionalServers);
      } catch (error) {
        console.warn('Failed to parse OPENAPI_ADDITIONAL_SERVERS:', error.message);
      }
    }

    return servers;
  }

  /**
   * Get default OpenAPI description
   */
  getDefaultDescription() {
    return `Dynamic MongoDB collection management with comprehensive features:

**Core Features:**
- Full CRUD operations for all MongoDB collections
- Advanced filtering with MongoDB-style queries
- Webhook system for real-time event notifications
- JavaScript automation engine with event scripts and cron scheduling
- CSV export functionality for data analysis

**CSV Export Capabilities:**
- Export collection data in CSV format for analysis and reporting
- Support via Accept headers (text/csv, application/csv) or ?format=csv parameter
- Automatic field detection and header generation
- Smart data conversion (nested objects, arrays, dates)
- Works with all filtering and field selection parameters
- No pagination limits - exports all matching data
- Proper file download headers for browser compatibility

**Data Formats:**
- JSON: Standard API responses with pagination and metadata
- CSV: Complete data exports for spreadsheet applications`;
  }

  /**
   * Validate configuration
   */
  validate() {
    const errors = [];

    // Required configurations
    if (!this.database.uri) {
      errors.push('MONGODB_URI is required');
    }

    if (this.cluster.enableDistributedLocking && !this.redis.url) {
      errors.push('REDIS_URL is required when distributed locking is enabled');
    }

    if (this.security.authentication.enabled && !this.security.authentication.jwtSecret) {
      errors.push('JWT_SECRET is required when authentication is enabled');
    }

    if (this.api.pagination.maxPageSize < this.api.pagination.defaultPageSize) {
      errors.push('MAX_PAGE_SIZE must be greater than or equal to DEFAULT_PAGE_SIZE');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    return true;
  }

  /**
   * Get configuration for a specific module
   */
  get(module) {
    if (module && this[module]) {
      return this[module];
    }
    return this;
  }

  /**
   * Update configuration at runtime (for development/testing)
   */
  update(module, key, value) {
    if (this[module] && this[module][key] !== undefined) {
      this[module][key] = value;
      return true;
    }
    return false;
  }

  /**
   * Get environment-specific configuration summary
   */
  getSummary() {
    return {
      environment: this.server.nodeEnv,
      server: {
        port: this.server.port,
        host: this.server.host
      },
      database: {
        uri: this.database.uri.replace(/\/\/[^@]*@/, '//***:***@'), // Mask credentials
        name: this.database.name
      },
      features: {
        authentication: this.security.authentication.enabled,
        rateLimit: this.api.rateLimit.maxRequests > 0,
        webhooks: this.webhooks.timeout > 0,
        scripts: this.scripts.execution.timeout > 0,
        distributedLocking: this.cluster.enableDistributedLocking,
        clustering: this.cluster.cronLeaderElection
      },
      cluster: {
        instanceId: this.cluster.instanceId,
        enableDistributedLocking: this.cluster.enableDistributedLocking
      }
    };
  }
}

// Create singleton instance
const config = new Config();

// Validate on startup
try {
  config.validate();
  console.log('✅ Configuration loaded and validated successfully');
  if (config.development.verbose) {
    console.log('📋 Configuration Summary:', JSON.stringify(config.getSummary(), null, 2));
  }
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}

module.exports = config;
