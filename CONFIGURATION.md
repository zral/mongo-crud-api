# Configuration Management

This document explains the comprehensive configuration system implemented for the MongoDB CRUD API.

## Overview

The application now uses a centralized configuration system that allows all settings to be controlled via environment variables. This eliminates hardcoded values and provides flexibility for different deployment environments.

## Configuration Structure

### Server Configuration
Controls web server behavior and middleware settings.

```bash
# Server Settings
PORT=3000                    # Server port
HOST=0.0.0.0                # Server host binding
NODE_ENV=production          # Environment mode

# CORS Settings
CORS_ORIGIN=*               # Allowed origins (* for all)
CORS_CREDENTIALS=false      # Allow credentials

# Middleware Settings
JSON_LIMIT=10mb             # Request body size limit
LOG_FORMAT=combined         # Morgan log format
```

### Database Configuration
Controls MongoDB connection and behavior.

```bash
# Connection
MONGODB_URI=mongodb://mongo:27017/crud_api
DATABASE_NAME=crud_api      # Override database name

# Connection Pool
DB_MAX_POOL_SIZE=10         # Maximum connections
DB_MIN_POOL_SIZE=2          # Minimum connections
DB_MAX_IDLE_TIME_MS=30000   # Connection idle timeout

# Reconnection
DB_MAX_RECONNECT_ATTEMPTS=5 # Max retry attempts
DB_RECONNECT_INITIAL_DELAY=1000  # Initial retry delay
DB_RECONNECT_MAX_DELAY=30000     # Maximum retry delay
```

### API Configuration
Controls API behavior, pagination, and features.

```bash
# Pagination
DEFAULT_PAGE_SIZE=10        # Default results per page
MAX_PAGE_SIZE=100          # Maximum results per page

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000    # Rate limit window (15 min)
RATE_LIMIT_MAX_REQUESTS=100    # Max requests per window

# CSV Export
CSV_MAX_EXPORT_RECORDS=100000  # Max records in CSV export
CSV_DELIMITER=,                # CSV field delimiter
CSV_QUOTE_CHAR="              # CSV quote character
```

### OpenAPI Configuration
Controls API documentation generation.

```bash
# Basic Info
OPENAPI_TITLE=MongoDB CRUD REST API
OPENAPI_VERSION=1.0.0
OPENAPI_BASE_URL=http://localhost:3000

# Contact Information
OPENAPI_CONTACT_NAME=API Support
OPENAPI_CONTACT_EMAIL=support@example.com
OPENAPI_CONTACT_URL=https://support.example.com

# License
OPENAPI_LICENSE_NAME=MIT
OPENAPI_LICENSE_URL=https://opensource.org/licenses/MIT
```

### Webhook Configuration
Controls webhook delivery behavior.

```bash
# Delivery Settings
WEBHOOK_TIMEOUT=5000           # Request timeout
WEBHOOK_MAX_RETRIES=3          # Maximum retry attempts
WEBHOOK_RETRY_DELAY=1000       # Base retry delay

# Rate Limiting
WEBHOOK_DEFAULT_RATE_LIMIT=60  # Default requests per minute
WEBHOOK_BACKOFF_MULTIPLIER=2   # Exponential backoff multiplier
```

### Script Configuration
Controls JavaScript automation engine.

```bash
# Execution
SCRIPT_EXECUTION_TIMEOUT=30000 # Script timeout (30 seconds)
SCRIPT_MAX_MEMORY=128          # Memory limit (MB)
SCRIPT_SANDBOXED=true          # Enable sandboxing

# Rate Limiting
SCRIPT_DEFAULT_RATE_LIMIT=30   # Executions per minute
SCRIPT_MAX_RETRIES=3           # Max retry attempts

# Cron Jobs
SCRIPT_CRON_TIMEZONE=UTC       # Timezone for cron jobs
SCRIPT_MAX_CONCURRENT_JOBS=10  # Max concurrent cron jobs
```

### Security Configuration
Controls security features and authentication.

```bash
# Security Headers
SECURITY_CSP=true              # Content Security Policy
SECURITY_COEP=true             # Cross-Origin Embedder Policy

# Authentication (Optional)
AUTH_ENABLED=false             # Enable authentication
JWT_SECRET=your-secret-key     # JWT signing key
JWT_EXPIRATION=24h             # JWT expiration time
```

## Configuration Usage

### Accessing Configuration
```javascript
const config = require('./config');

// Access specific modules
const serverConfig = config.server;
const dbConfig = config.database;

// Access specific values
const port = config.server.port;
const maxPageSize = config.api.pagination.maxPageSize;
```

### Environment-Specific Settings

#### Development
```bash
NODE_ENV=development
DEV_VERBOSE=true
DEV_HOT_RELOAD=true
OPENAPI_BASE_URL=http://localhost:3000
```

#### Production
```bash
NODE_ENV=production
DEV_VERBOSE=false
SECURITY_CSP=true
RATE_LIMIT_MAX_REQUESTS=1000
OPENAPI_BASE_URL=https://api.yourdomain.com
```

#### Docker
```bash
MONGODB_URI=mongodb://mongo:27017/crud_api
HOST=0.0.0.0
PORT=3000
```

## Migration from Hardcoded Values

### Before
```javascript
const PORT = process.env.PORT || 3000;
const maxPageSize = 100;
const defaultPageSize = 10;
```

### After
```javascript
const config = require('./config');
const port = config.server.port;
const maxPageSize = config.api.pagination.maxPageSize;
const defaultPageSize = config.api.pagination.defaultPageSize;
```

## Configuration Validation

The system automatically validates configuration on startup:

- Required values are checked
- Cross-dependencies are validated
- Invalid combinations are rejected
- Helpful error messages are provided

```bash
❌ Configuration validation failed:
MONGODB_URI is required
JWT_SECRET is required when authentication is enabled
MAX_PAGE_SIZE must be greater than or equal to DEFAULT_PAGE_SIZE
```

## Benefits

1. **Environment Flexibility**: Easy deployment across different environments
2. **No Hardcoded Values**: All configuration is externalized
3. **Type Safety**: Configuration values are properly typed and validated
4. **Documentation**: Self-documenting configuration with clear structure
5. **Development Experience**: Clear error messages and validation
6. **Production Ready**: Separate settings for different environments

## Docker Integration

Update your `docker-compose.yml` to pass environment variables:

```yaml
services:
  api:
    environment:
      - MONGODB_URI=mongodb://mongo:27017/crud_api
      - NODE_ENV=production
      - RATE_LIMIT_MAX_REQUESTS=1000
      - CSV_MAX_EXPORT_RECORDS=50000
      - OPENAPI_BASE_URL=https://api.yourdomain.com
```

## Best Practices

1. **Use .env files** for local development
2. **Set environment variables** in production
3. **Validate configuration** before deployment
4. **Document custom settings** for your team
5. **Use different settings** per environment
6. **Never commit secrets** to version control

## Troubleshooting

### Configuration Not Loading
- Ensure `.env` file exists in root directory
- Check file permissions
- Verify environment variable syntax

### Validation Errors
- Check required fields are set
- Verify numeric values are valid
- Ensure cross-dependencies are satisfied

### Performance Issues
- Adjust connection pool settings
- Modify rate limiting values
- Tune pagination defaults
