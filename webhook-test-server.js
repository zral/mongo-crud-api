const express = require('express');
const app = express();
const PORT = 3003;

// Middleware to parse JSON
app.use(express.json());

// Store received webhooks
const receivedWebhooks = [];

// Webhook endpoint
app.post('/webhook', (req, res) => {
  const timestamp = new Date().toISOString();
  const webhook = {
    timestamp,
    headers: req.headers,
    body: req.body
  };
  
  receivedWebhooks.push(webhook);
  console.log(`\n=== Webhook Received at ${timestamp} ===`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('=================================\n');
  
  res.status(200).json({ message: 'Webhook received successfully' });
});

// Endpoint to view received webhooks
app.get('/webhooks', (req, res) => {
  res.json({
    count: receivedWebhooks.length,
    webhooks: receivedWebhooks
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Webhook test server running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`View received webhooks: http://localhost:${PORT}/webhooks`);
});

module.exports = app;
