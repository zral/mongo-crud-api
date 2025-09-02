# MongoDB CRUD REST API with React Frontend

# MongoDB CRUD REST API with React Frontend

An enterprise-grade Node.js application that dynamically exposes MongoDB collections as REST endpoints with comprehensive CRUD functionality, advanced webhook system, intelligent rate limiting, and a modern React web interface.

## 🚀 Features

### **Core Functionality**
- **Dynamic Collection Exposure**: Automatically exposes all MongoDB collections as REST endpoints
- **Full CRUD Operations**: Complete Create, Read, Update, Delete operations for each collection
- **Advanced Filtering**: MongoDB-style query filters with comparison operators, ranges, and regex
- **Auto-Discovery**: New collections are automatically available as endpoints
- **Management API**: Add and remove collections through REST endpoints
- **Bulk Data Upload**: Import CSV and Excel files with intelligent data processing and error handling

### **Bulk Data Processing**
- **Multi-Format Support**: CSV (.csv) and Excel (.xlsx, .xls) file uploads
- **Intelligent Data Processing**: Automatic type detection (numbers, dates, booleans)
- **Batch Processing**: Configurable batch sizes for large file uploads (up to 10MB)

## 🚀 Features

### **Core Functionality**
- **Dynamic Collection Exposure**: Automatically exposes all MongoDB collections as REST endpoints
- **Full CRUD Operations**: Complete Create, Read, Update, Delete operations for each collection
- **Advanced Filtering**: MongoDB-style query filters with comparison operators, ranges, and regex
- **Auto-Discovery**: New collections are automatically available as endpoints
- **Management API**: Add and remove collections through REST endpoints
- **Bulk Data Upload**: Import CSV and Excel files with intelligent data processing and error handling

### **Enterprise Webhook System**
- **Real-time Event Delivery**: HTTP webhooks triggered by database operations (create, update, delete)
- **Advanced Rate Limiting**: Per-webhook rate limits (1-300 req/min) with sliding window algorithm
- **Intelligent Retry System**: Exponential backoff retry mechanism with configurable limits
- **MongoDB-Style Filtering**: Complex document filtering for selective webhook triggering
- **Comprehensive Management**: Full CRUD operations for webhook configuration

### **SDK Generation & Documentation**
- **TypeScript SDK Generation**: Auto-generated type-safe client libraries
- **OpenAPI/Swagger Specification**: Complete API documentation with interactive explorer
- **Schema Discovery**: Intelligent schema inference from existing data
- **Multi-Language Support**: Ready for SDK generation in any language supporting OpenAPI
- **Interactive Documentation**: Swagger UI at `/api/sdk/docs` with live API testing

### **Production Features**
- **Database Resilience**: Connection retry logic with exponential backoff
- **Rate Limiting**: Configurable rate limiting to prevent abuse
- **Health Monitoring**: Continuous connection monitoring and automatic recovery
- **Security Validation**: Input sanitization and dangerous operator filtering
- **Error Handling**: Comprehensive error handling with detailed logging
- **Performance Optimization**: Connection pooling and efficient algorithms

### **Modern Web Interface**
- **React Frontend**: Modern web interface with responsive design
- **Real-time Management**: Live webhook and collection management
- **Bulk Data Upload Interface**: Drag-and-drop file upload with preview functionality
- **Data Import Wizard**: Step-by-step guide for CSV/Excel imports with validation
- **Rate Limit Configuration**: Visual rate limit setup with validation
- **Statistics Dashboard**: Real-time delivery statistics and monitoring
- **Dark/Light Theme**: Theme selection for user preference

## Components

- **Backend API**: Node.js Express server with MongoDB integration
- **Frontend**: React application with modern UI for data management
- **Database**: MongoDB with optimized `mongo:7` image

## 🌐 SaaS Landing Page

A professional marketing landing page is available that positions this solution as **"CrudAPI Pro"** - a compelling SaaS product for developers who need instant backend solutions.

**View the landing page**: [`landing.html`](./landing.html)

The landing page includes:
- 🎯 **Compelling value proposition**: "Stop Building Backends. Start Building Dreams"
- 💰 **Professional pricing tiers**: Freemium to Enterprise ($0-$99/month)  
- 🏆 **Developer testimonials** showcasing time savings and productivity gains
- ⚡ **Feature highlights** emphasizing speed, ease-of-use, and production readiness
- 🔗 **Live demo links** connecting directly to your running application

Perfect for presenting this solution to stakeholders, investors, or as a foundation for a commercial SaaS offering.

## 🎯 Quick Start

```bash
# Start all services with Docker Compose
docker-compose up -d

# Access the application
Frontend: http://localhost:3002
API: http://localhost:3003  
MongoDB: localhost:27017

# Quick API test
curl http://localhost:3003/api/management/collections
- **Update Options**: Configurable upsert behavior for duplicate handling

### **SDK Generation & Documentation**
- **TypeScript SDK Generation**: Auto-generated type-safe client libraries
- **OpenAPI/Swagger Specification**: Complete API documentation with interactive explorer
- **Schema Discovery**: Intelligent schema inference from existing data
- **Multi-Language Support**: Ready for SDK generation in any language supporting OpenAPI
- **Interactive Documentation**: Swagger UI at `/api/sdk/docs` with live API testing

### **Enterprise Webhook System**
- **Real-time Event Delivery**: HTTP webhooks triggered by database operations
- **Advanced Rate Limiting**: Per-webhook rate limits (1-300 req/min) with sliding window algorithm
- **Intelligent Retry System**: Exponential backoff retry mechanism with configurable limits
- **MongoDB-Style Filtering**: Complex document filtering for selective webhook triggering
- **Comprehensive Management**: Full CRUD operations for webhook configuration

### **Resilience & Performance**
- **Database Connection Retry**: Exponential backoff reconnection with health monitoring
- **Background Processing**: Asynchronous webhook delivery with queue management
- **Circuit Breaker**: Automatic failure detection and recovery
- **Production-Ready**: Health checks, error handling, and comprehensive logging

### **Modern Web Interface**
- **React Frontend**: Modern web interface with responsive design
- **Real-time Management**: Live webhook and collection management
- **Bulk Data Upload Interface**: Drag-and-drop file upload with preview functionality
- **Data Import Wizard**: Step-by-step guide for CSV/Excel imports with validation
- **Rate Limit Configuration**: Visual rate limit setup with validation
- **Statistics Dashboard**: Real-time delivery statistics and monitoring

### **DevOps Ready**
- **Docker Support**: Multi-stage containerized builds with minimal Alpine images
- **Docker Compose**: Complete orchestration with MongoDB, API, and Frontend
- **Health Monitoring**: Built-in health checks and system monitoring
- **Testing Suite**: Comprehensive test scripts for all functionality

## Components

- **Backend API**: Node.js Express server with MongoDB integration
- **Frontend**: React application with modern UI for data management
- **Database**: MongoDB with optimized `mongo:7` image

## 🌐 SaaS Landing Page

A professional marketing landing page is available that positions this solution as **"CrudAPI Pro"** - a compelling SaaS product for developers who need instant backend solutions.

**View the landing page**: [`landing.html`](./landing.html)

The landing page includes:
- 🎯 **Compelling value proposition**: "Stop Building Backends. Start Building Dreams"
- 💰 **Professional pricing tiers**: Freemium to Enterprise ($0-$99/month)
- 🏆 **Developer testimonials** showcasing time savings and productivity gains
- ⚡ **Feature highlights** emphasizing speed, ease-of-use, and production readiness
- 🔗 **Live demo links** connecting directly to your running application

Perfect for presenting this solution to stakeholders, investors, or as a foundation for a commercial SaaS offering.

## 🎯 Quick Start

```bash
# Start all services with Docker Compose
docker-compose up -d

# Access the application
Frontend: http://localhost:3002
API: http://localhost:3003  
MongoDB: localhost:27017

# Quick API test
curl http://localhost:3003/api/management/collections

# Create a webhook with rate limiting
curl -X POST http://localhost:3003/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Events",
    "url": "https://httpbin.org/post",
    "collection": "users",
    "events": ["create", "update"],
    "filters": {"status": "active"},
    "rateLimit": {
      "maxRequestsPerMinute": 120,
      "maxRetries": 3,
      "baseDelayMs": 1000,
      "maxDelayMs": 30000
    }
  }'
```

## 📡 API Endpoints

### **Collection CRUD Operations**
Dynamic endpoints for each collection `{collection}`:

```http
GET    /api/{collection}           # Get all documents with filtering
GET    /api/{collection}/{id}      # Get document by ID
POST   /api/{collection}           # Create new document
PUT    /api/{collection}/{id}      # Update document by ID
DELETE /api/{collection}/{id}      # Delete document by ID
```

### **Advanced Collection Filtering**
Support for MongoDB-style queries with comparison operators:

```bash
# Basic filtering
GET /api/users?filter={"status":"active"}

# Comparison operators  
GET /api/users?filter={"age":{"$gte":18,"$lt":65}}

# Array operators
GET /api/products?filter={"category":{"$in":["electronics","books"]}}

# Regular expressions
GET /api/users?filter={"email":{"$regex":".*@company\\.com$"}}

# Complex filtering with logical operators
GET /api/orders?filter={"$and":[{"total":{"$gte":100}},{"status":"pending"}]}

# Pagination and sorting
GET /api/users?page=2&limit=20&sort=-createdAt
```

### **Management API**

```http
GET    /api/management/collections    # List all collections
POST   /api/management/collections    # Create new collection
DELETE /api/management/collections/{name}  # Drop collection
GET    /api/management/health         # Health check with system status
```

### **Webhook Management API**

```http
GET    /api/webhooks                  # List all webhooks with rate limits
POST   /api/webhooks                  # Create webhook with rate limiting
GET    /api/webhooks/{id}             # Get specific webhook details
PUT    /api/webhooks/{id}             # Update webhook and rate limits
DELETE /api/webhooks/{id}             # Delete webhook
POST   /api/webhooks/{id}/test        # Test webhook delivery
GET    /api/webhooks/stats            # Get delivery statistics
```

### **SDK Generation & Documentation API**

```http
GET    /api/sdk/info                  # SDK generation information and collection metadata
GET    /api/sdk/schemas               # Get inferred schemas for all collections  
GET    /api/sdk/schemas/{collection}  # Get detailed schema for specific collection
GET    /api/sdk/openapi.json          # Download complete OpenAPI specification
GET    /api/sdk/typescript            # Generate and download TypeScript SDK (ZIP)
GET    /api/sdk/docs                  # Interactive Swagger UI documentation
```

### **Bulk Data Upload API**

```http
POST   /api/bulk/{collection}/preview # Preview CSV/Excel file before upload
POST   /api/bulk/{collection}/upload  # Upload bulk data from CSV/Excel files
GET    /api/bulk/{collection}/template # Download CSV template for collection
```

**Bulk Upload Example:**
```bash
# Preview a CSV file before uploading
curl -X POST -F "file=@employees.csv" \
  -F "previewRows=5" \
  http://localhost:3003/api/bulk/employees/preview

# Upload CSV with options
curl -X POST -F "file=@employees.csv" \
  -F "updateOnDuplicate=true" \
  -F "batchSize=1000" \
  http://localhost:3003/api/bulk/employees/upload

# Download template
curl -X GET "http://localhost:3003/api/bulk/employees/template?sampleData=true" \
  -o employees_template.csv
```

**Supported File Formats:**
- CSV (.csv) - Comma-separated values
- Excel (.xlsx, .xls) - Microsoft Excel spreadsheets
- Maximum file size: 10MB
- Intelligent data type detection (numbers, dates, booleans)

## 🎣 Enterprise Webhook System

### **Core Features**
- **Event-Driven Architecture**: Real-time webhook delivery for database operations
- **Per-Webhook Rate Limiting**: Individual rate limits from 1-300 requests/minute
- **Intelligent Retry System**: Exponential backoff with configurable retry attempts
- **Advanced Filtering**: MongoDB-style filters for selective webhook triggering
- **Background Processing**: Asynchronous delivery with queue management

### **Rate Limiting Configuration**

Each webhook supports individual rate limit settings:

```json
{
  "rateLimit": {
    "maxRequestsPerMinute": 120,    // 1-300 requests per minute
    "maxRetries": 5,                // 0-10 retry attempts
    "baseDelayMs": 500,             // 100ms-10s initial delay
    "maxDelayMs": 15000             // 1s-5min maximum delay
  }
}
```

### **Creating Advanced Webhooks**

```bash
# High-volume production webhook
curl -X POST http://localhost:3003/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Order Processor",
    "url": "https://api.production.com/webhook",
    "collection": "orders",
    "events": ["create", "update"],
    "filters": {
      "status": {"$in": ["confirmed", "processing"]},
      "total": {"$gte": 100}
    },
    "rateLimit": {
      "maxRequestsPerMinute": 200,
      "maxRetries": 5,
      "baseDelayMs": 500,
      "maxDelayMs": 30000
    },
    "enabled": true
  }'

# User management webhook with email filtering  
curl -X POST http://localhost:3003/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium User Notifications",
    "url": "https://crm.company.com/webhook",
    "collection": "users", 
    "events": ["create", "update"],
    "filters": {
      "subscription.tier": {"$in": ["premium", "enterprise"]},
      "email": {"$regex": ".*@(company|enterprise)\\.com$"},
      "status": "active"
    },
    "rateLimit": {
      "maxRequestsPerMinute": 60,
      "maxRetries": 3,
      "baseDelayMs": 1000,
      "maxDelayMs": 60000
    }
  }'
```

### **Webhook Payload Structure**

Webhooks receive rich payloads with complete context:

```json
{
  "event": "create|update|delete",
  "collection": "users",
  "timestamp": "2025-09-01T15:30:00.000Z",
  "webhook": {
    "id": "65f8b123456789abcdef0123",
    "name": "User Management Webhook"
  },
  "data": {
    "document": {
      "_id": "65f8b123456789abcdef0125",
      "name": "John Doe",
      "email": "john.doe@example.com",
      "status": "active"
    },
    "previousDocument": null,  // For update events
    "changes": {               // For update events  
      "status": {"from": "pending", "to": "active"}
    }
  },
  "metadata": {
    "deliveryId": "webhook-1756767637412-zstpxh5kh",
    "attemptNumber": 1,
    "rateLimitInfo": {
      "maxRequestsPerMinute": 120,
      "remainingRequests": 119,
      "resetTime": "2025-09-01T15:31:00.000Z"
    }
  }
}
```

### **Advanced Filter Examples**

```json
// E-commerce: High-value orders from VIP customers
{
  "total": {"$gte": 1000},
  "customer.type": {"$in": ["vip", "enterprise"]},
  "status": "pending"
}

// User Management: Active premium users with recent activity
{
  "subscription.tier": {"$in": ["premium", "enterprise"]}, 
  "status": "active",
  "lastActivity": {"$gte": "2025-09-01T00:00:00.000Z"}
}

// Inventory: Low stock alerts for active products
{
  "inventory.quantity": {"$lte": 10},
  "category": {"$in": ["electronics", "books"]},
  "status": "active"
}

// Support: Urgent tickets requiring immediate attention
{
  "$or": [
    {"priority": "urgent"},
    {"escalated": true}
  ],
  "status": {"$in": ["open", "pending"]}
}
```

### **Webhook Statistics and Monitoring**

```bash
# Get comprehensive webhook statistics
curl http://localhost:3003/api/webhooks/stats

# Response includes:
{
  "deliveryStatistics": {
    "delivered": 15432,
    "failed": 287, 
    "rateLimited": 145,
    "retryQueueSize": 12,
    "successRate": "98.2%"
  },
  "perWebhookStats": [...],  // Individual webhook performance
  "systemHealth": {...}      // Overall system status
}
```

```json
{
  "event": "create|update|delete",
  "webhook": {
    "id": "webhook-id",
    "name": "webhook-name"
  },
  "collection": "collection-name",
  "timestamp": "2025-09-02T10:30:00.000Z",
  "data": {
    "document": { /* current document */ },
    "oldDocument": { /* previous document (update/delete only) */ }
  }
}
```

#### Filter Examples

```json
// Match documents where age is greater than 18
{"age": {"$gt": 18}}

// Match documents with specific status
{"status": "active"}

// Match documents with email containing specific domain
{"email": {"$regex": "@company\\.com$"}}

// Match documents with tags array containing "premium"
{"tags": {"$in": ["premium"]}}

// Match all documents (no filtering)
{}
```

#### Supported Filter Operators

- `$eq` - Equal to
- `$ne` - Not equal to
- `$gt` - Greater than
- `$gte` - Greater than or equal to
- `$lt` - Less than
- `$lte` - Less than or equal to
- `$in` - In array
- `$nin` - Not in array
- `$regex` - Regular expression match
- `$exists` - Field exists

## 🛠️ SDK Generation & Developer Tools

### **Auto-Generated TypeScript SDKs**

Generate production-ready TypeScript client libraries with full type safety:

```bash
# Download TypeScript SDK as ZIP file
curl -X GET "http://localhost:3003/api/sdk/typescript" \
  -H "Accept: application/zip" \
  -o "mongodb-crud-sdk.zip"

# Or specify custom package name and API URL
curl -X GET "http://localhost:3003/api/sdk/typescript?packageName=@myorg/api-client&apiUrl=https://api.production.com" \
  -H "Accept: application/zip" \
  -o "custom-sdk.zip"
```

### **Interactive API Documentation**

Access comprehensive Swagger UI documentation at:
```
http://localhost:3003/api/sdk/docs
```

Features:
- **Live API Testing**: Test all endpoints directly from the browser
- **Schema Visualization**: View auto-generated data schemas
- **Request/Response Examples**: Real-world usage examples
- **Authentication Testing**: JWT token testing support

### **Schema Discovery**

Get intelligent schema inference for your collections:

```bash
# Get schemas for all collections
curl http://localhost:3003/api/sdk/schemas

# Get detailed schema for specific collection
curl http://localhost:3003/api/sdk/schemas/users
```

### **OpenAPI Specification**

Download the complete OpenAPI 3.0 specification:

```bash
# Get OpenAPI spec
curl http://localhost:3003/api/sdk/openapi.json
```

### **Using Generated TypeScript SDK**

```typescript
import { MongoDBCrudSDK } from '@your-org/mongodb-crud-sdk';

// Initialize SDK
const sdk = new MongoDBCrudSDK('http://localhost:3003');

// Optional: Set authentication token
sdk.setAuthToken('your-jwt-token');

// Use collection clients with full type safety
const users = await sdk.users.list({ 
  filter: { age: { $gte: 18 } },
  page: 1,
  limit: 20 
});

const newUser = await sdk.users.create({
  name: 'John Doe',
  email: 'john@example.com',
  age: 25
});

// Webhook management
const webhooks = await sdk.webhooks.list();
const webhook = await sdk.webhooks.create({
  name: 'User Events',
  url: 'https://api.myapp.com/webhook',
  collection: 'users',
  events: ['create', 'update'],
  rateLimit: { maxRequestsPerMinute: 120 }
});
```

## Query Parameters

- `page` - Page number for pagination (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `sort` - Sort field (prefix with - for descending)

Example: `GET /api/users?page=2&limit=20&sort=-createdAt`

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Start the application and MongoDB
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop the application
docker-compose down
```

The API will be available at `http://localhost:3003`
The React Frontend will be available at `http://localhost:3002`

## 🖥️ React Frontend Features

### **Modern Web Interface**
The React frontend provides comprehensive management capabilities with a professional, responsive design.

#### **Dashboard Features**
- **Multi-Tab Interface**: Collection management, webhook management, and statistics
- **Real-Time Updates**: Automatic refresh of data and status information
- **Professional Design**: Clean, modern UI with consistent styling
- **Responsive Layout**: Works seamlessly on desktop, tablet, and mobile devices

#### **Collection Management**
- **Data Viewing**: Browse documents with pagination and sorting
- **CRUD Operations**: Create, read, update, and delete documents
- **Advanced Filtering**: Visual filter builder with MongoDB-style queries
- **JSON Editor**: Syntax-highlighted JSON editing with validation
- **Export/Import**: Data export and bulk import capabilities

#### **Webhook Management Interface**
- **Visual Configuration**: Easy webhook setup with form validation
- **Rate Limit Settings**: Configure per-webhook rate limits with visual feedback
- **Filter Builder**: MongoDB-style filter configuration with syntax highlighting
- **Testing Tools**: Built-in webhook testing and validation
- **Statistics Dashboard**: Real-time delivery statistics and performance metrics
- **Status Management**: Enable/disable webhooks with visual indicators

#### **Advanced UI Features**
- **Rate Limit Configuration**: Visual rate limit setup with tooltips and validation
  - Configurable request limits (1-300 req/min)
  - Retry settings with bounds checking  
  - Real-time validation feedback
- **Webhook Testing**: One-click webhook testing with response display
- **Error Handling**: Clear error messages and validation feedback
- **Performance Monitoring**: Real-time webhook delivery statistics
- **Responsive Tables**: Sortable, filterable data tables with pagination

#### **User Experience**
- **Toast Notifications**: Real-time feedback for all operations
- **Loading States**: Professional loading indicators for async operations
- **Form Validation**: Client-side validation with helpful error messages
- **Keyboard Shortcuts**: Efficient navigation and operation shortcuts
- **Dark/Light Theme**: Theme selection for user preference

## � Bulk Data Upload & Processing

### **Overview**
The bulk data upload functionality allows you to import large datasets from CSV and Excel files directly into MongoDB collections through both the API and web interface. This powerful feature streamlines data migration, initial database population, and ongoing data synchronization tasks that would otherwise require complex scripting or manual data entry.

**Key Benefits:**
- **Time Efficiency**: Import thousands of records in seconds instead of manual entry
- **Data Validation**: Intelligent preview and validation before committing data
- **Flexible Processing**: Support for both CSV and Excel formats with automatic type detection
- **Production Ready**: Batch processing with configurable sizes for optimal performance
- **Error Resilience**: Comprehensive error reporting with row-level feedback for data quality issues
- **Template Generation**: Auto-generated CSV templates based on existing collection schemas
- **Update Flexibility**: Configurable upsert behavior for handling duplicate records

**Use Cases:**
- **Data Migration**: Moving data from legacy systems or other databases
- **Initial Setup**: Populating new databases with seed data or reference information
- **Regular Imports**: Scheduled data imports from external systems or data exports
- **Data Synchronization**: Keeping MongoDB collections in sync with external data sources
- **Bulk Updates**: Updating multiple records efficiently through file uploads

### **Supported File Formats**
- **CSV Files** (.csv): Comma-separated values with automatic delimiter detection
- **Excel Files** (.xlsx, .xls): Microsoft Excel spreadsheets (first sheet is used)
- **File Size Limit**: Up to 10MB per upload
- **Data Types**: Automatic detection of numbers, dates, booleans, and strings

### **Web Interface Usage**

1. **Access Bulk Upload**
   - Navigate to any collection in the web interface
   - Click the "Bulk Upload" button (📤 icon)
   - A modal will open with upload options

2. **File Selection & Preview**
   - Select your CSV or Excel file
   - Click "Preview Data" to validate format
   - Review column mapping and data types
   - Check total rows and detected columns

3. **Upload Options**
   - **Update on Duplicate**: Update existing documents with matching keys
   - **Skip Validation**: Faster uploads with reduced safety checks
   - **Batch Size**: Configure processing batch size (100-5000, default: 1000)

4. **Template Generation**
   - Click "Download Template" to get a CSV template
   - Templates include sample data and proper column headers
   - Based on existing collection schema or default structure

### **API Usage Examples**

**Preview File Before Upload:**
```bash
curl -X POST -F "file=@employees.csv" \
  -F "previewRows=10" \
  http://localhost:3003/api/bulk/employees/preview
```

**Upload with Options:**
```bash
curl -X POST -F "file=@employees.csv" \
  -F "updateOnDuplicate=true" \
  -F "skipValidation=false" \
  -F "batchSize=1000" \
  http://localhost:3003/api/bulk/employees/upload
```

**Download Template:**
```bash
curl -X GET "http://localhost:3003/api/bulk/employees/template?sampleData=true" \
  -H "Accept: text/csv" \
  -o employees_template.csv
```

### **Data Processing Features**

**Intelligent Type Detection:**
- Numbers: Automatic conversion of numeric strings
- Dates: ISO format detection (YYYY-MM-DD, etc.)
- Booleans: "true"/"false", "yes"/"no" conversion
- Null Values: Empty cells converted to null

**Error Handling:**
- Row-level error reporting with line numbers
- Duplicate key detection and handling
- Validation error details for debugging
- Partial success with detailed statistics

**Processing Statistics:**
```json
{
  "totalRecords": 1000,
  "insertedCount": 950,
  "modifiedCount": 30,
  "errors": [
    {
      "index": 45,
      "document": {...},
      "error": "Duplicate key error"
    }
  ],
  "duplicates": [...],
  "skipped": [...]
}
```

### **Best Practices**

1. **File Preparation**
   - Use clear, descriptive column headers
   - Ensure consistent data formats within columns
   - Remove empty rows and unnecessary columns
   - Validate data before upload

2. **Performance Optimization**
   - Use appropriate batch sizes (500-2000 for best performance)
   - Consider skipping validation for trusted data sources
   - Upload during off-peak hours for large datasets

3. **Error Management**
   - Always preview data before uploading
   - Review error reports for data quality issues
   - Use update mode for incremental data loads

## 🔧 Installation & Development

### **Quick Start with Docker Compose (Recommended)**

```bash
# Clone and start the application
git clone <repository-url>
cd MongoCRUD
docker-compose up -d

# Verify all services are running
docker-compose ps

# Check logs if needed
docker-compose logs -f

# Access the applications
# Frontend: http://localhost:3002
# API: http://localhost:3003
# MongoDB: localhost:27017
```

### **Windows Quick Start**

```cmd
# Use the provided Windows scripts
scripts\start.bat          # Start all services
scripts\simple-test.bat     # Test API functionality
scripts\test-frontend.bat   # Test frontend integration
```

### **Local Development Setup**

```bash
# Install dependencies
npm install
cd frontend && npm install && cd ..

# Set environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string

# Start MongoDB (if running locally)
mongod --dbpath /path/to/data

# Start the API server (development mode)
npm run dev

# Start the frontend (in another terminal)
cd frontend && npm start
```

### **Environment Configuration**

```bash
# .env file settings
MONGODB_URI=mongodb://localhost:27017/crud_api
PORT=3003
NODE_ENV=development
WEBHOOK_TIMEOUT=5000
RATE_LIMIT_WINDOW_MS=60000
```

## 🧪 Testing & Validation

### **Comprehensive Testing Suite**

```bash
# Run all tests
npm test

# Individual test suites
node test/basic-crud-test.js          # Basic CRUD operations
node test/management-test.js          # Collection management
node test/complete-system-test.js     # End-to-end system tests
node test/load-test.js               # Performance and load testing

# Windows batch scripts
scripts\test.bat                     # Run full test suite
scripts\test-complete-system.ps1     # PowerShell system tests
```

### **Webhook Testing**

```bash
# Start local webhook test server
node webhook-test-server.js

# Test webhook functionality
node test-webhook-rate-limits.js     # Rate limiting tests
node test-collection-filters.js      # Filter validation tests

# API webhook testing
curl -X POST http://localhost:3003/api/webhooks/{id}/test
```

### **Performance Testing**

```bash
# Load testing with rate limits
node test-rate-limit-api.js

# Filter performance testing
node test-filter-debug.js

# Complete system stress testing
node test/load-test.js
```

## 🛡️ Security & Production Readiness

### **Security Features**
- **Input Validation**: All API inputs are validated and sanitized
- **Rate Limiting**: Built-in rate limiting for API endpoints and webhooks
- **Timeout Protection**: Request timeouts prevent resource exhaustion
- **Error Handling**: Secure error messages without information leakage
- **MongoDB Injection Protection**: Query parameterization and validation

### **Production Features**
- **Health Checks**: Comprehensive health monitoring endpoints
- **Error Recovery**: Automatic retry mechanisms with exponential backoff
- **Circuit Breaker**: Automatic failure detection and recovery
- **Logging**: Structured logging for monitoring and debugging
- **Metrics**: Performance metrics and statistics collection

### **Monitoring & Observability**
- **Health Endpoints**: `/health` for system status monitoring
- **Webhook Statistics**: Real-time delivery statistics and performance metrics
- **Database Health**: Connection monitoring with automatic reconnection
- **Error Tracking**: Comprehensive error logging and categorization

## 🏗️ Architecture & Technology Stack

### **Technology Stack**
- **Backend**: Node.js 18 + Express.js + MongoDB Driver
- **Frontend**: React 18 + Modern JavaScript (ES6+)
- **Database**: MongoDB 7.0 with optimized indexing
- **Containerization**: Docker + Docker Compose
- **Base Images**: Alpine Linux for minimal footprint

### **System Architecture**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend│    │   Node.js API   │    │   MongoDB 7.0   │
│   (Port 3002)   │───▶│   (Port 3003)   │───▶│   (Port 27017)  │
│   207MB         │    │   219MB         │    │   1.13GB        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │  Webhook System │
                    │  - Rate Limiting│
                    │  - Retry Logic  │
                    │  - Queue Mgmt   │
                    └─────────────────┘
```

### **Project Structure**

```
MongoCRUD/
├── src/                           # Backend API source code
│   ├── app.js                     # Main application entry point
│   ├── routes/                    # API route handlers
│   │   ├── collections.js         # CRUD operations with advanced filtering
│   │   ├── management.js          # Collection management
│   │   └── webhooks.js            # Webhook management with rate limiting
│   ├── services/                  # Business logic services
│   │   ├── database.js            # Database connection with retry logic
│   │   ├── webhookDelivery.js     # Webhook delivery with rate limiting
│   │   └── filterService.js       # Advanced filtering engine
│   └── middleware/                # Custom middleware
│       └── errorHandler.js        # Global error handling
├── frontend/                      # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── CollectionInterface.js  # Collection management UI
│   │   │   ├── WebhookInterface.js     # Webhook management with rate limits
│   │   │   ├── DocumentModal.js        # Document editing interface
│   │   │   └── ManagementInterface.js  # System management UI
│   │   └── services/
│   │       └── api.js             # API client with error handling
├── test/                          # Comprehensive test suite
│   ├── basic-crud-test.js         # CRUD operation tests
│   ├── management-test.js         # Collection management tests
│   ├── complete-system-test.js    # End-to-end system tests
│   └── load-test.js              # Performance and load tests
├── scripts/                       # Utility and deployment scripts
│   ├── start.bat                  # Windows startup script
│   ├── test-api.ps1              # PowerShell API testing
│   └── test-complete-system.ps1   # System integration tests
├── docker-compose.yml             # Service orchestration
├── Dockerfile                     # Multi-stage container build
└── webhook-test-server.js         # Local webhook testing server
```

### **Container Optimization**

**Optimized Docker Images:**
- **Frontend**: `mongocrud-frontend` (207MB) - React app with Node.js 18 Alpine
- **Backend API**: `mongocrud-api` (219MB) - Node.js 18 Alpine with optimized dependencies  
- **Database**: `mongo:7` (1.13GB) - MongoDB 7.0 (90MB smaller than latest)

**Total Stack Size**: ~1.55GB (optimized from ~1.64GB)

### **Performance Characteristics**

| Component | Feature | Performance |
|-----------|---------|-------------|
| **API** | Response Time | < 50ms (simple queries) |
| **Webhooks** | Delivery Rate | Up to 300 req/min per webhook |
| **Database** | Reconnection | 1s-30s exponential backoff |
| **Frontend** | Load Time | < 2s initial load |
| **Filtering** | Complex Queries | < 100ms (indexed fields) |

### **Scalability Features**
- **Horizontal Scaling**: Stateless API design supports load balancers
- **Database Sharding**: MongoDB clustering ready
- **Webhook Queue**: Background processing prevents blocking
- **Rate Limiting**: Per-webhook and global rate controls
- **Health Monitoring**: Built-in monitoring for auto-scaling triggers

## 📚 Documentation

- **[IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)**: Detailed technical implementation
- **[PROJECT_SUMMARY.md](PROJECT_SUMMARY.md)**: High-level project overview
- **[WEBHOOKS_SUMMARY.md](WEBHOOKS_SUMMARY.md)**: Comprehensive webhook documentation
- **[COLLECTION_FILTERING_SUMMARY.md](COLLECTION_FILTERING_SUMMARY.md)**: Advanced filtering guide

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Enterprise-Ready MongoDB CRUD API with Advanced Webhook Management** - Built for production environments requiring reliable data operations, real-time event processing, and comprehensive management capabilities.
