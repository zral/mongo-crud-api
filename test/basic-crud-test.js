const http = require('http');

const API_BASE = 'http://localhost:3003';

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: body ? JSON.parse(body) : null
          };
          resolve(result);
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function runBasicCrudTests() {
  console.log('🧪 Starting Basic CRUD Tests...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const health = await makeRequest('GET', '/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   Response: ${JSON.stringify(health.data, null, 2)}\n`);

    // Test 2: List Collections
    console.log('2. Listing existing collections...');
    const collections = await makeRequest('GET', '/api/management/collections');
    console.log(`   Status: ${collections.status}`);
    console.log(`   Collections: ${collections.data.collections.map(c => c.name).join(', ')}\n`);

    // Test 3: Test Users Collection (should exist from init)
    console.log('3. Testing users collection...');
    const users = await makeRequest('GET', '/api/db/users');
    console.log(`   Status: ${users.status}`);
    console.log(`   Users found: ${users.data?.data?.length || 0}\n`);

    // Test 4: Create a new document
    console.log('4. Creating a new user...');
    const newUser = {
      name: 'Test User',
      email: 'test@example.com',
      age: 28,
      department: 'Testing'
    };
    const createResult = await makeRequest('POST', '/api/db/users', newUser);
    console.log(`   Status: ${createResult.status}`);
    const userId = createResult.data?.data?._id;
    console.log(`   Created user ID: ${userId}\n`);

    if (userId) {
      // Test 5: Get document by ID
      console.log('5. Getting user by ID...');
      const getUser = await makeRequest('GET', `/api/db/users/${userId}`);
      console.log(`   Status: ${getUser.status}`);
      console.log(`   User: ${getUser.data?.data?.name}\n`);

      // Test 6: Update document
      console.log('6. Updating user...');
      const updateData = { age: 29, department: 'Updated Testing' };
      const updateResult = await makeRequest('PUT', `/api/db/users/${userId}`, updateData);
      console.log(`   Status: ${updateResult.status}`);
      console.log(`   Updated age: ${updateResult.data?.data?.age}\n`);

      // Test 7: Delete document
      console.log('7. Deleting user...');
      const deleteResult = await makeRequest('DELETE', `/api/db/users/${userId}`);
      console.log(`   Status: ${deleteResult.status}`);
      console.log(`   Deleted user: ${deleteResult.data?.data?.name}\n`);
    }

    // Test 8: Test pagination
    console.log('8. Testing pagination...');
    const paginatedUsers = await makeRequest('GET', '/api/db/users?page=1&limit=2');
    console.log(`   Status: ${paginatedUsers.status}`);
    console.log(`   Page: ${paginatedUsers.data?.pagination?.page}`);
    console.log(`   Total: ${paginatedUsers.data?.pagination?.total}\n`);

    // Test 9: Test sorting
    console.log('9. Testing sorting...');
    const sortedUsers = await makeRequest('GET', '/api/db/users?sort=-age');
    console.log(`   Status: ${sortedUsers.status}`);
    if (sortedUsers.data?.data?.length > 0) {
      console.log(`   First user age: ${sortedUsers.data.data[0].age}\n`);
    }

    console.log('✅ Basic CRUD tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runBasicCrudTests();
}

module.exports = { runBasicCrudTests, makeRequest };
