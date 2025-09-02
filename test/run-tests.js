const { runBasicCrudTests } = require('./basic-crud-test');
const { runManagementTests } = require('./management-test');
const { runLoadTest } = require('./load-test');

async function runAllTests() {
  console.log('🚀 MongoDB CRUD API Test Suite\n');
  console.log('=' .repeat(50));

  try {
    // Wait a moment for API to be ready
    console.log('Waiting for API to be ready...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run Basic CRUD Tests
    console.log('Phase 1: Basic CRUD Operations');
    console.log('-'.repeat(30));
    await runBasicCrudTests();
    console.log('\n');

    // Run Management Tests
    console.log('Phase 2: Management API');
    console.log('-'.repeat(20));
    await runManagementTests();
    console.log('\n');

    // Run Load Tests
    console.log('Phase 3: Load Testing');
    console.log('-'.repeat(20));
    await runLoadTest();
    console.log('\n');

    console.log('=' .repeat(50));
    console.log('🎉 All tests completed successfully!');
    console.log('✅ API is working correctly');
    
  } catch (error) {
    console.log('=' .repeat(50));
    console.error('❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Helper function to check if API is responding
async function waitForApi(maxAttempts = 30) {
  const { makeRequest } = require('./basic-crud-test');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await makeRequest('GET', '/health');
      if (result.status === 200) {
        console.log('✅ API is ready!');
        return true;
      }
    } catch (error) {
      // API not ready yet
    }
    
    console.log(`⏳ Waiting for API... (attempt ${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('API did not become ready within the timeout period');
}

// If running directly, wait for API and run all tests
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--wait')) {
    console.log('🔄 Waiting for API to be ready...');
    waitForApi()
      .then(() => runAllTests())
      .catch(error => {
        console.error('❌ Failed to connect to API:', error.message);
        process.exit(1);
      });
  } else {
    runAllTests();
  }
}

module.exports = { runAllTests, waitForApi };
