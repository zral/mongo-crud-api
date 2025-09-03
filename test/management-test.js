const { makeRequest } = require('./basic-crud-test');

async function runManagementTests() {
  console.log('🔧 Starting Management API Tests...\n');

  try {
    // Test 1: Management Health Check
    console.log('1. Testing management health check...');
    const health = await makeRequest('GET', '/api/management/health');
    console.log(`   Status: ${health.status}`);
    console.log(`   MongoDB connected: ${health.data?.mongodb?.connected}\n`);

    // Test 2: List all collections
    console.log('2. Listing all collections...');
    const collections = await makeRequest('GET', '/api/management/collections');
    console.log(`   Status: ${collections.status}`);
    const initialCollections = collections.data?.collections || [];
    console.log(`   Initial collections: ${initialCollections.map(c => c.name).join(', ')}\n`);

    // Test 3: Create a new collection
    console.log('3. Creating new collection "test_items"...');
    const createCollection = await makeRequest('POST', '/api/management/collections', {
      name: 'test_items'
    });
    console.log(`   Status: ${createCollection.status}`);
    console.log(`   Message: ${createCollection.data?.message}\n`);

    // Test 4: Verify collection was created
    console.log('4. Verifying collection was created...');
    const updatedCollections = await makeRequest('GET', '/api/management/collections');
    const newCollections = updatedCollections.data?.collections || [];
    const hasTestItems = newCollections.some(c => c.name === 'test_items');
    console.log(`   Test_items collection exists: ${hasTestItems}\n`);

    // Test 5: Add data to the new collection
    console.log('5. Adding data to new collection...');
    const testItem = {
      name: 'Test Item 1',
      value: 100,
      active: true
    };
    const addData = await makeRequest('POST', '/api/db/test_items', testItem);
    console.log(`   Status: ${addData.status}`);
    console.log(`   Created item: ${addData.data?.data?.name}\n`);

    // Test 6: Retrieve data from new collection
    console.log('6. Retrieving data from new collection...');
    const getData = await makeRequest('GET', '/api/test_items');
    console.log(`   Status: ${getData.status}`);
    console.log(`   Items found: ${getData.data?.data?.length || 0}\n`);

    // Test 7: Try to create collection with invalid name
    console.log('7. Testing invalid collection name...');
    const invalidCollection = await makeRequest('POST', '/api/management/collections', {
      name: '123invalid'
    });
    console.log(`   Status: ${invalidCollection.status}`);
    console.log(`   Error: ${invalidCollection.data?.error}\n`);

    // Test 8: Try to create duplicate collection
    console.log('8. Testing duplicate collection creation...');
    const duplicateCollection = await makeRequest('POST', '/api/management/collections', {
      name: 'test_items'
    });
    console.log(`   Status: ${duplicateCollection.status}`);
    console.log(`   Error: ${duplicateCollection.data?.error}\n`);

    // Test 9: Drop the test collection
    console.log('9. Dropping test collection...');
    const dropCollection = await makeRequest('DELETE', '/api/management/collections/test_items');
    console.log(`   Status: ${dropCollection.status}`);
    console.log(`   Message: ${dropCollection.data?.message}\n`);

    // Test 10: Verify collection was dropped
    console.log('10. Verifying collection was dropped...');
    const finalCollections = await makeRequest('GET', '/api/management/collections');
    const finalList = finalCollections.data?.collections || [];
    const stillHasTestItems = finalList.some(c => c.name === 'test_items');
    console.log(`    Test_items collection still exists: ${stillHasTestItems}\n`);

    // Test 11: Try to drop non-existent collection
    console.log('11. Testing drop of non-existent collection...');
    const dropNonExistent = await makeRequest('DELETE', '/api/management/collections/nonexistent');
    console.log(`    Status: ${dropNonExistent.status}`);
    console.log(`    Error: ${dropNonExistent.data?.error}\n`);

    console.log('✅ Management API tests completed successfully!');

  } catch (error) {
    console.error('❌ Management test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runManagementTests();
}

module.exports = { runManagementTests };
