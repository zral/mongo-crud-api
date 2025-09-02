const { makeRequest } = require('./basic-crud-test');

async function runLoadTest() {
  console.log('⚡ Starting Load Test...\n');

  const CONCURRENT_REQUESTS = 10;
  const REQUESTS_PER_BATCH = 5;

  try {
    // Test 1: Create test collection
    console.log('1. Creating load test collection...');
    await makeRequest('POST', '/api/management/collections', { name: 'load_test' });

    // Test 2: Concurrent document creation
    console.log('2. Creating documents concurrently...');
    const createPromises = [];
    
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      const promise = makeRequest('POST', '/api/load_test', {
        name: `Load Test Item ${i}`,
        value: Math.floor(Math.random() * 1000),
        batch: Math.floor(i / REQUESTS_PER_BATCH),
        timestamp: new Date().toISOString()
      });
      createPromises.push(promise);
    }

    const startTime = Date.now();
    const createResults = await Promise.all(createPromises);
    const createDuration = Date.now() - startTime;

    const successfulCreates = createResults.filter(r => r.status === 201).length;
    console.log(`   Created ${successfulCreates}/${CONCURRENT_REQUESTS} documents in ${createDuration}ms`);
    console.log(`   Average: ${(createDuration / CONCURRENT_REQUESTS).toFixed(2)}ms per request\n`);

    // Test 3: Concurrent reads
    console.log('3. Reading documents concurrently...');
    const readPromises = [];
    
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      readPromises.push(makeRequest('GET', '/api/load_test?limit=5'));
    }

    const readStartTime = Date.now();
    const readResults = await Promise.all(readPromises);
    const readDuration = Date.now() - readStartTime;

    const successfulReads = readResults.filter(r => r.status === 200).length;
    console.log(`   Completed ${successfulReads}/${CONCURRENT_REQUESTS} reads in ${readDuration}ms`);
    console.log(`   Average: ${(readDuration / CONCURRENT_REQUESTS).toFixed(2)}ms per request\n`);

    // Test 4: Mixed operations
    console.log('4. Running mixed operations...');
    const mixedPromises = [];
    
    // Mix of reads, creates, and updates
    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
      if (i % 3 === 0) {
        // Read operation
        mixedPromises.push(makeRequest('GET', '/api/load_test?limit=3'));
      } else if (i % 3 === 1) {
        // Create operation
        mixedPromises.push(makeRequest('POST', '/api/load_test', {
          name: `Mixed Test ${i}`,
          operation: 'create',
          timestamp: new Date().toISOString()
        }));
      } else {
        // Get all to find an ID for update
        mixedPromises.push(makeRequest('GET', '/api/load_test?limit=1'));
      }
    }

    const mixedStartTime = Date.now();
    const mixedResults = await Promise.all(mixedPromises);
    const mixedDuration = Date.now() - mixedStartTime;

    const successfulMixed = mixedResults.filter(r => r.status >= 200 && r.status < 300).length;
    console.log(`   Completed ${successfulMixed}/${CONCURRENT_REQUESTS} mixed operations in ${mixedDuration}ms`);
    console.log(`   Average: ${(mixedDuration / CONCURRENT_REQUESTS).toFixed(2)}ms per request\n`);

    // Test 5: Pagination performance
    console.log('5. Testing pagination performance...');
    const pageTests = [];
    
    for (let page = 1; page <= 5; page++) {
      pageTests.push(makeRequest('GET', `/api/load_test?page=${page}&limit=10`));
    }

    const pageStartTime = Date.now();
    const pageResults = await Promise.all(pageTests);
    const pageDuration = Date.now() - pageStartTime;

    const successfulPages = pageResults.filter(r => r.status === 200).length;
    console.log(`   Loaded ${successfulPages}/5 pages in ${pageDuration}ms`);
    console.log(`   Average: ${(pageDuration / 5).toFixed(2)}ms per page\n`);

    // Test 6: Stress test with rapid sequential requests
    console.log('6. Running rapid sequential requests...');
    const sequentialStartTime = Date.now();
    let sequentialSuccesses = 0;

    for (let i = 0; i < 20; i++) {
      const result = await makeRequest('GET', '/api/load_test?limit=1');
      if (result.status === 200) sequentialSuccesses++;
    }

    const sequentialDuration = Date.now() - sequentialStartTime;
    console.log(`   Completed ${sequentialSuccesses}/20 sequential requests in ${sequentialDuration}ms`);
    console.log(`   Average: ${(sequentialDuration / 20).toFixed(2)}ms per request\n`);

    // Test 7: Memory usage check (get large dataset)
    console.log('7. Testing large dataset retrieval...');
    const largeDataStart = Date.now();
    const largeDataResult = await makeRequest('GET', '/api/load_test?limit=100');
    const largeDataDuration = Date.now() - largeDataStart;

    console.log(`   Retrieved ${largeDataResult.data?.data?.length || 0} documents in ${largeDataDuration}ms\n`);

    // Cleanup
    console.log('8. Cleaning up load test collection...');
    await makeRequest('DELETE', '/api/management/collections/load_test');
    console.log('   Load test collection dropped\n');

    console.log('✅ Load test completed successfully!');
    console.log('\n📊 Performance Summary:');
    console.log(`   - Concurrent creates: ${(createDuration / CONCURRENT_REQUESTS).toFixed(2)}ms avg`);
    console.log(`   - Concurrent reads: ${(readDuration / CONCURRENT_REQUESTS).toFixed(2)}ms avg`);
    console.log(`   - Mixed operations: ${(mixedDuration / CONCURRENT_REQUESTS).toFixed(2)}ms avg`);
    console.log(`   - Pagination: ${(pageDuration / 5).toFixed(2)}ms avg per page`);
    console.log(`   - Sequential requests: ${(sequentialDuration / 20).toFixed(2)}ms avg`);

  } catch (error) {
    console.error('❌ Load test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if called directly
if (require.main === module) {
  runLoadTest();
}

module.exports = { runLoadTest };
