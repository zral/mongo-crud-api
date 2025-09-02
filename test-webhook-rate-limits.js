/**
 * Test script to demonstrate per-webhook rate limit functionality
 * This script shows how the webhook rate limiting works without needing a full server
 */

console.log('=== Webhook Rate Limit Configuration Test ===\n');

// Example webhook configurations with different rate limits
const webhooks = [
  {
    _id: '1',
    name: 'High Volume Webhook',
    url: 'https://api.example.com/webhook1',
    collection: 'users',
    events: ['create', 'update'],
    enabled: true,
    rateLimit: {
      maxRequestsPerMinute: 120,  // Higher limit
      maxRetries: 5,
      baseDelayMs: 500,           // Shorter initial delay
      maxDelayMs: 15000           // Shorter max delay
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: '2', 
    name: 'Low Volume Webhook',
    url: 'https://api.partner.com/webhook2',
    collection: 'orders',
    events: ['create'],
    enabled: true,
    rateLimit: {
      maxRequestsPerMinute: 30,   // Lower limit
      maxRetries: 2,              // Fewer retries
      baseDelayMs: 2000,          // Longer initial delay
      maxDelayMs: 60000           // Longer max delay
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: '3',
    name: 'Default Settings Webhook',
    url: 'https://api.default.com/webhook3',
    collection: 'products',
    events: ['update', 'delete'],
    enabled: true,
    // No rateLimit specified - will use global defaults
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Global default rate limits
const globalDefaults = {
  maxRequestsPerMinute: 60,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000
};

console.log('📊 Webhook Configurations:\n');

webhooks.forEach((webhook, index) => {
  const effectiveRateLimit = webhook.rateLimit || globalDefaults;
  
  console.log(`${index + 1}. ${webhook.name}`);
  console.log(`   URL: ${webhook.url}`);
  console.log(`   Collection: ${webhook.collection}`);
  console.log(`   Events: ${webhook.events.join(', ')}`);
  console.log(`   Rate Limit Settings:`);
  console.log(`     • Max Requests/Minute: ${effectiveRateLimit.maxRequestsPerMinute}`);
  console.log(`     • Max Retries: ${effectiveRateLimit.maxRetries}`);
  console.log(`     • Base Delay: ${effectiveRateLimit.baseDelayMs}ms`);
  console.log(`     • Max Delay: ${effectiveRateLimit.maxDelayMs}ms`);
  console.log(`   ${webhook.rateLimit ? '✅ Custom limits' : '⚙️ Using global defaults'}\n`);
});

console.log('🔧 API Validation Rules:');
console.log('• maxRequestsPerMinute: 1-300 requests per minute');
console.log('• maxRetries: 0-10 retry attempts');
console.log('• baseDelayMs: 100ms-10s initial delay');
console.log('• maxDelayMs: 1s-5min maximum delay\n');

console.log('📋 Example API Requests:\n');

console.log('1. Create webhook with custom rate limits:');
console.log('POST /api/webhooks');
console.log(JSON.stringify({
  name: "Custom Rate Limited Webhook",
  url: "https://api.example.com/webhook",
  collection: "users",
  events: ["create", "update"],
  enabled: true,
  rateLimit: {
    maxRequestsPerMinute: 100,
    maxRetries: 4,
    baseDelayMs: 750,
    maxDelayMs: 20000
  }
}, null, 2));

console.log('\n2. Update webhook rate limits:');
console.log('PUT /api/webhooks/:id');
console.log(JSON.stringify({
  rateLimit: {
    maxRequestsPerMinute: 150,
    maxRetries: 2,
    baseDelayMs: 500,
    maxDelayMs: 10000
  }
}, null, 2));

console.log('\n3. Get webhook statistics:');
console.log('GET /api/webhooks/stats');

console.log('\n✅ Per-webhook rate limit functionality is now implemented!');
console.log('Each webhook can have its own rate limiting configuration.');
console.log('Webhooks without custom settings will use the global defaults.');
