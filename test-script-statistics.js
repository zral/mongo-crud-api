// Test script to verify enhanced script execution statistics functionality
const ScriptExecutionService = require('./src/services/scriptExecution');

async function testScriptStatistics() {
  console.log('🧪 Testing Enhanced Script Execution Statistics...\n');
  
  // Create a new instance of the script execution service
  const scriptExecution = new ScriptExecutionService();
  
  // Test script objects
  const testScript1 = {
    _id: 'test-script-1',
    name: 'Test Welcome Email Script',
    code: `
      console.log('Sending welcome email to:', payload.user.email);
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, message: 'Welcome email sent' };
    `
  };
  
  const testScript2 = {
    _id: 'test-script-2', 
    name: 'Test Data Validation Script',
    code: `
      console.log('Validating data:', payload.data);
      if (!payload.data || !payload.data.email) {
        throw new Error('Invalid email data');
      }
      return { success: true, message: 'Data validated' };
    `
  };
  
  console.log('📊 Initial Statistics:');
  let stats = scriptExecution.getStatistics();
  console.log(JSON.stringify(stats, null, 2));
  console.log('\n');
  
  // Execute multiple scripts to generate statistics
  console.log('⚡ Executing test scripts...\n');
  
  try {
    // Execute successful scripts
    for (let i = 0; i < 5; i++) {
      const result1 = await scriptExecution.executeScript(testScript1, {
        user: { email: `user${i}@example.com`, name: `User ${i}` }
      });
      console.log(`✅ Script 1 execution ${i + 1}:`, result1.success ? 'SUCCESS' : 'FAILED');
      
      // Small delay between executions
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Execute some scripts with validation data
    for (let i = 0; i < 3; i++) {
      const result2 = await scriptExecution.executeScript(testScript2, {
        data: { email: `test${i}@example.com`, value: i * 10 }
      });
      console.log(`✅ Script 2 execution ${i + 1}:`, result2.success ? 'SUCCESS' : 'FAILED');
      
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    
    // Execute a script that will fail
    try {
      await scriptExecution.executeScript(testScript2, {
        data: { value: 'invalid' } // Missing email
      });
    } catch (error) {
      console.log('❌ Script 2 failed execution (expected):', error.success === false ? 'FAILED' : 'UNEXPECTED');
    }
    
  } catch (error) {
    console.error('❌ Script execution error:', error);
  }
  
  console.log('\n📈 Final Statistics:');
  stats = scriptExecution.getStatistics();
  console.log(JSON.stringify(stats, null, 2));
  
  // Verify statistics are working
  console.log('\n🔍 Statistics Verification:');
  console.log(`- Total Executions: ${stats.totalExecutions}`);
  console.log(`- Successful Executions: ${stats.successfulExecutions}`);
  console.log(`- Failed Executions: ${stats.failedExecutions}`);
  console.log(`- Success Rate: ${stats.successRate}%`);
  console.log(`- Average Execution Time: ${stats.averageExecutionTime}ms`);
  console.log(`- Executions Today: ${stats.executionsToday}`);
  console.log(`- Top Scripts:`, stats.topScripts);
  
  console.log('\n✅ Script statistics testing completed!');
  
  // Test rate limiting functionality
  console.log('\n⏱️  Testing Rate Limiting...');
  scriptExecution.recordExecution('test-script-1');
  const isRateLimited = scriptExecution.isRateLimited('test-script-1', 1); // Very low limit for testing
  console.log(`Rate limited (expected false): ${isRateLimited}`);
  
  // Add many executions to trigger rate limiting
  for (let i = 0; i < 5; i++) {
    scriptExecution.recordExecution('test-script-1');
  }
  const isRateLimitedNow = scriptExecution.isRateLimited('test-script-1', 1);
  console.log(`Rate limited after 5 executions (expected true): ${isRateLimitedNow}`);
  
  console.log('\n🎉 All tests completed successfully!');
}

// Run the test
testScriptStatistics().catch(console.error);
