# Webhook System - Comprehensive Documentation

## 🎯 Overview

The MongoDB CRUD API includes a sophisticated webhook system that provides real-time notifications for database changes. The system supports event-driven architecture with advanced rate limiting, retry mechanisms, and comprehensive management capabilities.

## 🚀 Key Features

### **Event-Driven Architecture**
- Real-time webhook delivery for database operations
- Support for create, update, and delete events
- MongoDB-style filtering for selective webhook triggering
- Asynchronous processing for high performance

### **Advanced Rate Limiting**
- Per-webhook rate limit configuration
- Sliding window algorithm for accurate rate limiting
- Global defaults with individual webhook overrides
- Automatic cleanup of expired rate limit data

### **Intelligent Retry System**
- Exponential backoff retry mechanism
- Configurable retry attempts and delays
- Background queue processing
- Permanent failure handling after max retries

### **Comprehensive Management**
- Full CRUD operations for webhook management
- Real-time statistics and monitoring
- Test webhook functionality
- Frontend UI for easy management

## 📡 Webhook API Endpoints

### **Core Webhook Management**

#### List All Webhooks
```http
GET /api/webhooks
```

**Response:**
```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "_id": "65f8b123456789abcdef0123",
        "name": "User Management Webhook",
        "url": "https://api.example.com/webhook",
        "collection": "users",
        "events": ["create", "update"],
        "filters": {
          "status": "active",
          "age": { "$gte": 18 }
        },
        "rateLimit": {
          "maxRequestsPerMinute": 120,
          "maxRetries": 5,
          "baseDelayMs": 500,
          "maxDelayMs": 15000
        },
        "enabled": true,
        "createdAt": "2025-09-01T10:00:00.000Z",
        "updatedAt": "2025-09-01T15:30:00.000Z"
      }
    ]
  },
  "count": 1
}
```

#### Create Webhook
```http
POST /api/webhooks
Content-Type: application/json

{
  "name": "High Volume API Webhook",
  "url": "https://api.partner.com/webhook",
  "collection": "orders",
  "events": ["create", "update", "delete"],
  "filters": {
    "status": { "$in": ["pending", "processing"] },
    "total": { "$gte": 100 }
  },
  "rateLimit": {
    "maxRequestsPerMinute": 200,
    "maxRetries": 3,
    "baseDelayMs": 1000,
    "maxDelayMs": 30000
  },
  "enabled": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook created successfully",
  "data": {
    "_id": "65f8b123456789abcdef0124",
    "name": "High Volume API Webhook",
    // ... webhook details
  }
}
```

#### Update Webhook
```http
PUT /api/webhooks/{id}
Content-Type: application/json

{
  "rateLimit": {
    "maxRequestsPerMinute": 150,
    "maxRetries": 4,
    "baseDelayMs": 750,
    "maxDelayMs": 20000
  },
  "filters": {
    "status": "active",
    "priority": { "$in": ["high", "urgent"] }
  }
}
```

#### Delete Webhook
```http
DELETE /api/webhooks/{id}
```

#### Test Webhook
```http
POST /api/webhooks/{id}/test
```

Sends a test payload to verify webhook connectivity and configuration.

### **Statistics and Monitoring**

#### Get Webhook Statistics
```http
GET /api/webhooks/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deliveryStatistics": {
      "delivered": 15432,
      "failed": 287,
      "rateLimited": 145,
      "retryQueueSize": 12,
      "averageResponseTime": "245ms",
      "successRate": "98.2%",
      "totalAttempts": 16951
    },
    "rateLimit": {
      "maxRequestsPerMinute": 60,
      "windowMs": 60000,
      "maxRetries": 3,
      "baseDelayMs": 1000,
      "maxDelayMs": 30000
    },
    "systemHealth": {
      "databaseConnected": true,
      "webhookDeliveryActive": true,
      "retryProcessorRunning": true,
      "backgroundJobsHealthy": true
    },
    "perWebhookStats": [
      {
        "webhookId": "65f8b123456789abcdef0123",
        "name": "User Management Webhook",
        "delivered": 1234,
        "failed": 12,
        "rateLimited": 5,
        "lastDelivery": "2025-09-01T15:45:00.000Z",
        "averageResponseTime": "180ms"
      }
    ]
  }
}
```

## ⚙️ Rate Limiting Configuration

### **Per-Webhook Rate Limits**

Each webhook can have individual rate limit settings:

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

### **Validation Rules**

| Parameter | Range | Default | Description |
|-----------|-------|---------|-------------|
| `maxRequestsPerMinute` | 1-300 | 60 | Maximum requests per minute per webhook URL |
| `maxRetries` | 0-10 | 3 | Maximum retry attempts for failed deliveries |
| `baseDelayMs` | 100-10000 | 1000 | Initial delay between retry attempts |
| `maxDelayMs` | 1000-300000 | 30000 | Maximum delay between retry attempts |

### **Rate Limiting Algorithm**

**Sliding Window Implementation:**
- Uses 1-minute sliding windows for accurate rate limiting
- Per-URL tracking with automatic cleanup
- Memory-efficient with configurable retention
- Real-time rate limit checking and enforcement

**Exponential Backoff:**
```javascript
delay = Math.min(
  baseDelayMs * Math.pow(2, attemptNumber - 1),
  maxDelayMs
)
```

## 🎯 Event Filtering System

### **Supported Events**
- `create` - Triggered when new documents are inserted
- `update` - Triggered when documents are modified
- `delete` - Triggered when documents are removed

### **MongoDB-Style Filters**

Webhooks support full MongoDB query syntax for selective triggering:

#### **Basic Filters**
```json
{
  "filters": {
    "status": "active",
    "age": 25,
    "department": "Engineering"
  }
}
```

#### **Comparison Operators**
```json
{
  "filters": {
    "age": { "$gte": 18, "$lt": 65 },
    "salary": { "$gt": 50000 },
    "score": { "$lte": 100 }
  }
}
```

#### **Array and List Operators**
```json
{
  "filters": {
    "status": { "$in": ["active", "pending", "verified"] },
    "tags": { "$all": ["important", "urgent"] },
    "skills": { "$size": 3 }
  }
}
```

#### **Logical Operators**
```json
{
  "filters": {
    "$or": [
      { "priority": "high" },
      { "urgent": true }
    ],
    "$and": [
      { "status": "active" },
      { "verified": true }
    ]
  }
}
```

#### **Regular Expressions**
```json
{
  "filters": {
    "email": { "$regex": ".*@company\\.com$", "$options": "i" },
    "name": { "$regex": "^John", "$options": "i" }
  }
}
```

#### **Nested Object Filtering**
```json
{
  "filters": {
    "address.city": "Seattle",
    "profile.settings.notifications": true,
    "metadata.tags": { "$in": ["premium", "enterprise"] }
  }
}
```

### **Filter Examples by Use Case**

#### **User Management Webhook**
```json
{
  "name": "Premium User Notifications",
  "collection": "users",
  "events": ["create", "update"],
  "filters": {
    "subscription.tier": { "$in": ["premium", "enterprise"] },
    "status": "active",
    "email": { "$regex": ".*@(company|enterprise)\\.com$" }
  }
}
```

#### **Order Processing Webhook**
```json
{
  "name": "High Value Order Alerts",
  "collection": "orders",
  "events": ["create"],
  "filters": {
    "total": { "$gte": 1000 },
    "status": "pending",
    "customer.type": { "$in": ["enterprise", "vip"] }
  }
}
```

#### **Inventory Management Webhook**
```json
{
  "name": "Low Stock Alerts",
  "collection": "products",
  "events": ["update"],
  "filters": {
    "inventory.quantity": { "$lte": 10 },
    "category": { "$in": ["electronics", "books"] },
    "status": "active"
  }
}
```

## 📦 Webhook Payload Structure

### **Standard Payload Format**

```json
{
  "event": "create",
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
      "status": "active",
      "createdAt": "2025-09-01T15:30:00.000Z"
    },
    "previousDocument": null,  // For update events only
    "changes": {               // For update events only
      "status": { "from": "pending", "to": "active" },
      "updatedAt": { "from": "2025-09-01T15:00:00.000Z", "to": "2025-09-01T15:30:00.000Z" }
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

### **Event-Specific Payloads**

#### **Create Event**
```json
{
  "event": "create",
  "data": {
    "document": { /* new document */ },
    "previousDocument": null
  }
}
```

#### **Update Event**
```json
{
  "event": "update",
  "data": {
    "document": { /* updated document */ },
    "previousDocument": { /* original document */ },
    "changes": {
      "field1": { "from": "oldValue", "to": "newValue" },
      "field2": { "from": 10, "to": 25 }
    }
  }
}
```

#### **Delete Event**
```json
{
  "event": "delete",
  "data": {
    "document": { /* deleted document */ },
    "previousDocument": { /* same as document */ }
  }
}
```

## 🔧 Configuration Examples

### **Development Environment**
```json
{
  "name": "Development Debug Webhook",
  "url": "https://httpbin.org/post",
  "collection": "test_collection",
  "events": ["create", "update", "delete"],
  "filters": {},
  "rateLimit": {
    "maxRequestsPerMinute": 30,
    "maxRetries": 2,
    "baseDelayMs": 2000,
    "maxDelayMs": 10000
  },
  "enabled": true
}
```

### **Production High-Volume**
```json
{
  "name": "Production Order Processor",
  "url": "https://api.production.com/orders/webhook",
  "collection": "orders",
  "events": ["create", "update"],
  "filters": {
    "status": { "$in": ["confirmed", "processing", "shipped"] },
    "total": { "$gte": 10 }
  },
  "rateLimit": {
    "maxRequestsPerMinute": 300,
    "maxRetries": 5,
    "baseDelayMs": 500,
    "maxDelayMs": 30000
  },
  "enabled": true
}
```

### **Partner Integration**
```json
{
  "name": "Partner CRM Integration",
  "url": "https://partner.crm.com/api/webhook/users",
  "collection": "users",
  "events": ["create", "update"],
  "filters": {
    "subscription.tier": { "$in": ["premium", "enterprise"] },
    "status": "active",
    "partner.syncEnabled": true
  },
  "rateLimit": {
    "maxRequestsPerMinute": 60,
    "maxRetries": 3,
    "baseDelayMs": 1000,
    "maxDelayMs": 60000
  },
  "enabled": true
}
```

## 🛡️ Security and Reliability

### **Security Features**
- **URL Validation**: Webhook URLs are validated for proper format
- **Timeout Protection**: 5-second timeout for webhook delivery
- **Rate Limiting**: Protection against webhook endpoint overload
- **Retry Limits**: Prevents infinite retry loops
- **Input Validation**: All webhook parameters are validated

### **Reliability Features**
- **Exponential Backoff**: Intelligent retry timing
- **Circuit Breaker**: Automatic disabling of consistently failing webhooks
- **Queue Management**: Background processing prevents blocking
- **Error Categorization**: Different handling for different error types
- **Health Monitoring**: Continuous monitoring of webhook system health

### **Error Handling**
```javascript
// Webhook delivery error categorization
const errorTypes = {
  NETWORK_ERROR: 'Temporary network issues - will retry',
  TIMEOUT_ERROR: 'Request timeout - will retry',
  HTTP_4XX: 'Client error - will retry with caution',
  HTTP_5XX: 'Server error - will retry',
  RATE_LIMITED: 'Rate limit exceeded - will retry later',
  PERMANENT_FAILURE: 'Max retries exceeded - webhook disabled'
};
```

## 📊 Monitoring and Observability

### **Webhook Delivery Logs**
```
2025-09-01T15:30:15.123Z [INFO] Delivering webhook user-webhook-1 to https://api.example.com/webhook
2025-09-01T15:30:15.145Z [INFO] Webhook user-webhook-1 delivered successfully (180ms)
2025-09-01T15:30:16.234Z [WARN] Webhook order-webhook-2 failed (timeout) - scheduling retry 1
2025-09-01T15:30:18.456Z [INFO] Webhook order-webhook-2 retry 1 succeeded (250ms)
```

### **Performance Metrics**
- **Response Time Distribution**: P50, P95, P99 response times
- **Success Rate**: Percentage of successful deliveries
- **Retry Rate**: Percentage of deliveries requiring retries
- **Queue Depth**: Number of pending webhook deliveries
- **Rate Limit Hits**: Number of rate limit violations

### **Health Check Endpoint**
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "responseTime": "15ms"
  },
  "webhooks": {
    "deliveryService": "active",
    "retryProcessor": "running",
    "queueSize": 3,
    "lastProcessed": "2025-09-01T15:30:00.000Z"
  }
}
```

## 🎨 Frontend Webhook Management

### **Webhook Management Interface**
The frontend provides a comprehensive interface for webhook management:

#### **Features**
- **Webhook List**: View all webhooks with status and rate limit information
- **Create/Edit Forms**: User-friendly forms with validation
- **Rate Limit Configuration**: Visual rate limit setup with tooltips
- **Test Functionality**: One-click webhook testing
- **Statistics Dashboard**: Real-time delivery statistics
- **Filter Builder**: Visual filter construction (planned enhancement)

#### **UI Components**
- **Webhook Table**: Shows name, URL, collection, events, rate limits, and status
- **Rate Limit Fields**: Custom rate limiting configuration with validation
- **Status Indicators**: Visual indicators for webhook health and activity
- **Action Buttons**: Edit, delete, test, and enable/disable webhooks

## 🚀 Getting Started

### **Quick Setup**

1. **Create Your First Webhook**
```bash
curl -X POST http://localhost:3001/api/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Webhook",
    "url": "https://httpbin.org/post",
    "collection": "users",
    "events": ["create"],
    "enabled": true
  }'
```

2. **Test the Webhook**
```bash
curl -X POST http://localhost:3001/api/webhooks/{webhook-id}/test
```

3. **Trigger the Webhook**
```bash
curl -X POST http://localhost:3001/api/db/users \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com"
  }'
```

4. **Monitor Statistics**
```bash
curl http://localhost:3001/api/webhooks/stats
```

### **Best Practices**

#### **Rate Limit Configuration**
- Set conservative limits initially (30-60 req/min)
- Monitor webhook endpoint performance
- Increase limits gradually based on capacity
- Use higher retry counts for critical webhooks

#### **Filter Design**
- Use specific filters to reduce unnecessary webhook traffic
- Test filters thoroughly before deployment
- Consider performance impact of complex filters
- Document filter logic for maintenance

#### **Error Handling**
- Implement idempotent webhook handlers
- Return appropriate HTTP status codes
- Log webhook deliveries for debugging
- Monitor webhook failure rates

#### **Security**
- Use HTTPS endpoints for webhook URLs
- Implement webhook signature verification (planned enhancement)
- Validate webhook payloads in your handlers
- Monitor for unusual webhook activity

This webhook system provides enterprise-grade reliability and flexibility, making it suitable for production deployments with high-volume webhook requirements and complex integration scenarios.
