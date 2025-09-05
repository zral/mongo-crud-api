# JavaScript Automation Scripts

This document provides comprehensive information about the JavaScript automation engine built into the MongoDB CRUD API.

## Overview

The JavaScript automation engine allows you to execute custom JavaScript code in response to database operations (CREATE, UPDATE, DELETE). Scripts run in a secure, sandboxed environment with access to a built-in API client and utility functions.

## Key Features

- **Event-Driven Execution**: Automatically triggered by database operations
- **Secure VM Sandboxing**: Scripts run in isolated Node.js VM with timeout protection
- **Built-in API Client**: HTTP client for making requests to any collection endpoint
- **Advanced Filtering**: MongoDB-style filters for selective execution
- **Rate Limiting**: Configurable execution limits with exponential backoff
- **Real-time Testing**: Test scripts with sample data before deployment
- **Comprehensive Logging**: Built-in debugging and monitoring utilities

## API Endpoints

### Script Management

```http
GET    /api/scripts                   # List all scripts
POST   /api/scripts                   # Create new script
GET    /api/scripts/{id}              # Get script by ID
PUT    /api/scripts/{id}              # Update script
DELETE /api/scripts/{id}              # Delete script
POST   /api/scripts/{id}/test         # Test script execution
GET    /api/scripts/stats             # Get execution statistics
POST   /api/scripts/clear-rate-limits # Clear rate limits
```

### Cron Scheduling

```http
POST   /api/scripts/schedule          # Schedule script with cron expression
DELETE /api/scripts/schedule/{name}   # Unschedule script
PUT    /api/scripts/schedule/{name}   # Reschedule script
GET    /api/scripts/scheduled/list    # List all scheduled scripts
GET    /api/scripts/scheduled/{name}  # Get schedule details
POST   /api/scripts/scheduled/{name}/trigger # Manually trigger scheduled script
POST   /api/scripts/cron/validate     # Validate cron expression
GET    /api/scripts/cron/statistics   # Get cron execution statistics
DELETE /api/scripts/cron/statistics/reset # Reset cron statistics
```

### Create Script

```bash
curl -X POST http://localhost:3003/api/scripts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Profile Creator",
    "description": "Creates user profile when new user is registered",
    "collection": "users",
    "events": ["create"],
    "filters": {"verified": true},
    "enabled": true,
    "code": "// Your JavaScript code here",
    "rateLimit": {
      "maxExecutionsPerMinute": 60,
      "maxRetries": 3,
      "baseDelayMs": 1000,
      "maxDelayMs": 30000
    }
  }'
```

## Cron Scheduling

The JavaScript automation engine supports full cron-style scheduling for timed script execution. Scripts can be scheduled to run at specific times or intervals using standard cron expressions.

### Schedule Script

```bash
curl -X POST http://localhost:3003/api/scripts/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "name": "daily-cleanup",
    "cronExpression": "0 2 * * *",
    "scriptCode": "console.log(\"Running daily cleanup at\", new Date())"
  }'
```

### Cron Expression Format

```
┌─────────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)  
│ │ ┌─────────── day of month (1 - 31)
│ │ │ ┌───────── month (1 - 12)
│ │ │ │ ┌─────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * *
```

### Common Cron Patterns

```bash
*/5 * * * *   # Every 5 minutes
0 */2 * * *   # Every 2 hours
0 9 * * *     # Daily at 9:00 AM
0 9 * * 1     # Every Monday at 9:00 AM
0 0 1 * *     # First day of every month at midnight
0 0 * * 0     # Every Sunday at midnight
*/15 9-17 * * 1-5  # Every 15 minutes during business hours (9-5, Mon-Fri)
```

### Schedule Management

```bash
# List all scheduled scripts
curl http://localhost:3003/api/scripts/scheduled/list

# Get specific schedule details
curl http://localhost:3003/api/scripts/scheduled/daily-cleanup

# Update schedule
curl -X PUT http://localhost:3003/api/scripts/schedule/daily-cleanup \
  -H "Content-Type: application/json" \
  -d '{
    "cronExpression": "0 3 * * *",
    "scriptCode": "console.log(\"Updated cleanup time to 3 AM\")"
  }'

# Manually trigger scheduled script
curl -X POST http://localhost:3003/api/scripts/scheduled/daily-cleanup/trigger

# Unschedule script
curl -X DELETE http://localhost:3003/api/scripts/schedule/daily-cleanup

# Get cron statistics
curl http://localhost:3003/api/scripts/cron/statistics

# Validate cron expression
curl http://localhost:3003/api/scripts/cron/validate/0%202%20*%20*%20*
```

### Cron Statistics

The system tracks comprehensive statistics for scheduled scripts:

```json
{
  "totalExecutions": 1250,
  "successfulExecutions": 1248,
  "failedExecutions": 2,
  "averageExecutionTime": 125,
  "lastExecuted": "2025-09-03T02:00:00.000Z",
  "nextExecution": "2025-09-04T02:00:00.000Z",
  "schedules": [
    {
      "name": "daily-cleanup",
      "cronExpression": "0 2 * * *",
      "executions": 30,
      "lastRun": "2025-09-03T02:00:00.000Z",
      "nextRun": "2025-09-04T02:00:00.000Z",
      "status": "active"
    }
  ]
}
```

### Manual Script Triggers

Scheduled scripts can be triggered manually for testing or on-demand execution. This is useful for:

- **Testing**: Verify script behavior before deployment
- **Debugging**: Troubleshoot script issues without waiting for the next scheduled execution
- **On-Demand Execution**: Run maintenance or cleanup scripts when needed
- **Development**: Test script changes immediately

**Manual Trigger Request:**
```bash
curl -X POST http://localhost:3003/api/scripts/scheduled/daily-cleanup/trigger
```

**Success Response:**
```json
{
  "success": true,
  "message": "Script \"daily-cleanup\" triggered successfully",
  "data": {
    "scriptName": "daily-cleanup",
    "executionTime": "2025-09-05T17:36:45.053Z",
    "result": {
      "success": true,
      "output": "Cleanup completed successfully"
    }
  }
}
```

**Error Response (Script Not Found):**
```json
{
  "success": false,
  "error": "Not Found",
  "message": "Scheduled script not found: invalid-script-name"
}
```

**Manual Trigger Payload:**
When manually triggered, scripts receive a special payload indicating the manual execution:

```javascript
{
  "trigger": "manual",
  "scheduled": true,
  "manualTrigger": true,
  "executionTime": "2025-09-05T17:36:45.053Z",
  "cronExpression": "0 2 * * *"
}
```

## Script Execution Context

### Event Payload (`payload`)

Every script receives a `payload` object containing:

```javascript
{
  "event": "create|update|delete",
  "collection": "collection-name",
  "timestamp": "2025-09-03T10:30:00.000Z",
  "data": {
    "document": { /* current document */ },
    "oldDocument": { /* previous document (update/delete only) */ }
  }
}
```

### API Client (`api`)

Built-in HTTP client for making requests:

```javascript
### API Client (`api`)

Built-in HTTP client for making requests:

```javascript
// GET request
const users = await api.get('/api/db/users?status=active');

// POST request
const newDoc = await api.post('/api/db/notifications', {
  message: "Welcome!",
  userId: payload.data.document._id
});

// PUT request
const updated = await api.put('/api/db/users/123', {
  lastLogin: new Date()
});
```

// DELETE request
await api.delete('/api/db/temp_data/456');
```

### Utility Functions (`utils`)

Helper functions for common operations:

```javascript
// Logging functions
utils.log('Info message', data);
utils.error('Error message', error);

// Timestamp functions
const now = utils.now();           // ISO 8601 string
const timestamp = utils.timestamp(); // Unix timestamp (seconds)
```

## Example Scripts

### 1. User Welcome Email

Send welcome email when new verified user is created:

```javascript
if (payload.event === 'create' && payload.collection === 'users') {
  const user = payload.data.document;
  
  if (user.verified) {
    utils.log('Sending welcome email to:', user.email);
    
    const emailData = {
      to: user.email,
      subject: 'Welcome to our platform!',
      template: 'welcome',
      variables: {
        firstName: user.firstName,
        userId: user._id
      }
    };
    
    try {
      const result = await api.post('/api/email-service', emailData);
      utils.log('Welcome email sent:', result.data.messageId);
      return { success: true, emailId: result.data.messageId };
    } catch (error) {
      utils.error('Failed to send welcome email:', error.message);
      return { success: false, error: error.message };
    }
  }
}

return { success: true, message: 'No action needed' };
```

### 2. Order Status Notifications

Notify customer when order status changes:

```javascript
if (payload.event === 'update' && payload.collection === 'orders') {
  const newOrder = payload.data.document;
  const oldOrder = payload.data.oldDocument;
  
  // Check if status changed
  if (oldOrder.status !== newOrder.status) {
    utils.log('Order status changed:', {
      orderId: newOrder._id,
      from: oldOrder.status,
      to: newOrder.status
    });
    
    // Get customer details
    try {
      const customer = await api.get(`/api/customers/${newOrder.customerId}`);
      
      const notification = {
        customerId: newOrder.customerId,
        email: customer.data.email,
        type: 'order_status_update',
        data: {
          orderId: newOrder._id,
          orderNumber: newOrder.number,
          newStatus: newOrder.status,
          estimatedDelivery: newOrder.estimatedDelivery
        }
      };
      
      const result = await api.post('/api/db/notifications', notification);
      utils.log('Status notification sent:', result.data._id);
      
      return { 
        success: true, 
        notificationId: result.data._id,
        statusChange: `${oldOrder.status} → ${newOrder.status}`
      };
    } catch (error) {
      utils.error('Failed to send status notification:', error.message);
      return { success: false, error: error.message };
    }
  }
}

return { success: true, message: 'No status change detected' };
```

### 3. Inventory Management

Update inventory when order is completed:

```javascript
if (payload.event === 'update' && payload.collection === 'orders') {
  const newOrder = payload.data.document;
  const oldOrder = payload.data.oldDocument;
  
  // Check if order was just completed
  if (oldOrder.status !== 'completed' && newOrder.status === 'completed') {
    utils.log('Processing completed order:', newOrder._id);
    
    for (const item of newOrder.items) {
      try {
        // Get current inventory
        const inventory = await api.get(`/api/inventory?productId=${item.productId}`);
        
        if (inventory.data.length > 0) {
          const currentStock = inventory.data[0];
          const newQuantity = currentStock.quantity - item.quantity;
          
          // Update inventory
          await api.put(`/api/inventory/${currentStock._id}`, {
            quantity: Math.max(0, newQuantity),
            lastUpdated: utils.now(),
            lastOrderId: newOrder._id
          });
          
          utils.log('Inventory updated:', {
            productId: item.productId,
            oldQuantity: currentStock.quantity,
            newQuantity: Math.max(0, newQuantity)
          });
          
          // Create low stock alert if needed
          if (newQuantity <= 5) {
            await api.post('/api/db/alerts', {
              type: 'low_stock',
              productId: item.productId,
              currentQuantity: newQuantity,
              threshold: 5,
              orderId: newOrder._id
            });
            utils.log('Low stock alert created for product:', item.productId);
          }
        }
      } catch (error) {
        utils.error('Failed to update inventory for product:', item.productId, error.message);
      }
    }
    
    return { success: true, itemsProcessed: newOrder.items.length };
  }
}

return { success: true, message: 'Order not completed' };
```

### 4. Data Validation & Enhancement

Validate and enhance data on creation:

```javascript
if (payload.event === 'create' && payload.collection === 'products') {
  const product = payload.data.document;
  
  utils.log('Validating new product:', product.name);
  
  // Validation checks
  if (!product.sku || product.sku.length < 3) {
    utils.error('Invalid SKU:', product.sku);
    return { success: false, error: 'SKU must be at least 3 characters' };
  }
  
  if (product.price <= 0) {
    utils.error('Invalid price:', product.price);
    return { success: false, error: 'Price must be greater than 0' };
  }
  
  // Check for duplicate SKU
  try {
    const existing = await api.get(`/api/db/products?sku=${product.sku}`);
    if (existing.data.length > 0) {
      utils.error('Duplicate SKU found:', product.sku);
      return { success: false, error: 'SKU already exists' };
    }
  } catch (error) {
    utils.error('Error checking SKU:', error.message);
    return { success: false, error: 'Failed to validate SKU' };
  }
  
  // Generate additional product data
  const enhancedData = {
    slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    searchTags: product.name.toLowerCase().split(' '),
    createdBy: 'system',
    validatedAt: utils.now()
  };
  
  try {
    // Update the product with enhanced data
    await api.put(`/api/db/products/${product._id}`, enhancedData);
    utils.log('Product enhanced with additional data:', enhancedData);
    
    return { 
      success: true, 
      enhanced: true, 
      slug: enhancedData.slug,
      tags: enhancedData.searchTags.length
    };
  } catch (error) {
    utils.error('Failed to enhance product:', error.message);
    return { success: false, error: 'Failed to enhance product data' };
  }
}

return { success: true, message: 'No enhancement needed' };
```

### 5. Audit Logging

Create comprehensive audit logs for sensitive operations:

```javascript
// Monitor changes to sensitive collections
const sensitiveCollections = ['users', 'admin_settings', 'permissions', 'billing'];

if (sensitiveCollections.includes(payload.collection)) {
  utils.log('Creating audit log for sensitive operation:', {
    collection: payload.collection,
    event: payload.event,
    documentId: payload.data.document._id
  });
  
  const auditEntry = {
    collection: payload.collection,
    operation: payload.event,
    documentId: payload.data.document._id,
    timestamp: utils.timestamp(),
    isoTimestamp: utils.now(),
    metadata: {
      userAgent: 'automation-script',
      source: 'javascript-automation'
    }
  };
  
  // Add change details for updates
  if (payload.event === 'update') {
    auditEntry.changes = {
      before: payload.data.oldDocument,
      after: payload.data.document
    };
    
    // Identify changed fields
    const changedFields = [];
    for (const key in payload.data.document) {
      if (JSON.stringify(payload.data.oldDocument[key]) !== JSON.stringify(payload.data.document[key])) {
        changedFields.push(key);
      }
    }
    auditEntry.changedFields = changedFields;
  }
  
  try {
    const auditResult = await api.post('/api/db/audit_logs', auditEntry);
    utils.log('Audit log created:', auditResult.data._id);
    
    // Create alert for critical changes
    if (payload.collection === 'permissions' || payload.collection === 'admin_settings') {
      await api.post('/api/db/security_alerts', {
        type: 'sensitive_data_change',
        collection: payload.collection,
        operation: payload.event,
        documentId: payload.data.document._id,
        auditLogId: auditResult.data._id,
        timestamp: utils.now()
      });
      utils.log('Security alert created for sensitive change');
    }
    
    return { 
      success: true, 
      auditLogId: auditResult.data._id,
      changedFields: auditEntry.changedFields || [],
      securityAlert: ['permissions', 'admin_settings'].includes(payload.collection)
    };
  } catch (error) {
    utils.error('Failed to create audit log:', error.message);
    return { success: false, error: 'Audit logging failed' };
  }
}

return { success: true, message: 'Collection not monitored' };
```

## Configuration Options

### Rate Limiting

Configure execution limits to prevent overload:

```javascript
{
  "rateLimit": {
    "maxExecutionsPerMinute": 60,  // Maximum executions per minute
    "maxRetries": 3,               // Number of retry attempts
    "baseDelayMs": 1000,           // Initial retry delay (milliseconds)
    "maxDelayMs": 30000            // Maximum retry delay (milliseconds)
  }
}
```

### Event Filtering

Control when scripts execute:

```javascript
{
  "collection": "users",           // Specific collection or empty for all
  "events": ["create", "update"],  // Array of events to monitor
  "filters": {                     // MongoDB-style filters
    "verified": true,
    "status": {"$in": ["active", "pending"]},
    "createdAt": {"$gte": "2025-01-01"}
  }
}
```

## Error Handling Best Practices

### 1. Always Use Try-Catch

```javascript
try {
  const result = await api.post('/api/db/collection', data);
  utils.log('Operation successful:', result.data._id);
  return { success: true, data: result.data };
} catch (error) {
  utils.error('Operation failed:', error.message);
  return { success: false, error: error.message };
}
```

### 2. Validate Input Data

```javascript
if (!payload.data.document.email) {
  utils.error('Missing required field: email');
  return { success: false, error: 'Email is required' };
}

if (typeof payload.data.document.age !== 'number') {
  utils.error('Invalid data type for age:', typeof payload.data.document.age);
  return { success: false, error: 'Age must be a number' };
}
```

### 3. Provide Meaningful Return Values

```javascript
return {
  success: true,
  message: 'User notification sent successfully',
  data: {
    notificationId: 'notif_123',
    recipientEmail: 'user@example.com',
    timestamp: utils.now()
  }
};
```

## Performance Tips

1. **Use Filters Effectively**: Apply MongoDB-style filters to reduce unnecessary script executions
2. **Implement Proper Error Handling**: Always catch and handle API errors gracefully
3. **Log Appropriately**: Use `utils.log()` for debugging but avoid excessive logging in production
4. **Return Early**: Use early returns to avoid unnecessary processing
5. **Batch Operations**: When possible, batch multiple API calls together
6. **Set Appropriate Rate Limits**: Configure rate limits based on your script's complexity and API usage

## Security Considerations

1. **VM Sandboxing**: Scripts run in isolated VM with limited access to system resources
2. **Timeout Protection**: 30-second execution timeout prevents infinite loops
3. **Rate Limiting**: Configurable execution limits prevent resource abuse
4. **Input Validation**: Always validate payload data before processing
5. **Error Isolation**: Script errors don't affect the main application
6. **API Access Control**: Scripts use the same API endpoints with the same validation rules

## Monitoring and Debugging

### Execution Statistics

Monitor script performance:

```bash
curl http://localhost:3003/api/scripts/stats
```

### Script Logs

Use utility functions for debugging:

```javascript
utils.log('Debug information:', { userId: user._id, action: 'welcome_email' });
utils.error('Processing failed:', error.message);
```

### Testing Scripts

Test scripts before deployment:

```bash
curl -X POST http://localhost:3003/api/scripts/{scriptId}/test \
  -H "Content-Type: application/json" \
  -d '{
    "testPayload": {
      "event": "create",
      "collection": "users",
      "data": {
        "document": {
          "_id": "test_id",
          "email": "test@example.com",
          "verified": true
        }
      }
    }
  }'
```

## Troubleshooting

### Common Issues

1. **Script Not Executing**
   - Check if script is enabled
   - Verify event filters match the operation
   - Check collection filter settings

2. **API Calls Failing**
   - Verify endpoint URLs are correct
   - Check request data format
   - Review API response for error details

3. **Rate Limit Errors**
   - Increase rate limit settings
   - Implement better error handling
   - Add delays between API calls

4. **Timeout Errors**
   - Optimize script performance
   - Reduce API call complexity
   - Break large operations into smaller chunks

### Debug Script Template

```javascript
// Debug information
utils.log('Script execution started:', {
  event: payload.event,
  collection: payload.collection,
  documentId: payload.data.document._id,
  timestamp: utils.now()
});

try {
  // Your script logic here
  
  utils.log('Script execution completed successfully');
  return { success: true, message: 'Processed successfully' };
} catch (error) {
  utils.error('Script execution failed:', {
    error: error.message,
    stack: error.stack,
    payload: payload
  });
  return { success: false, error: error.message };
}
```
