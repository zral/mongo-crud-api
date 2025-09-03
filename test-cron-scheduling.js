// Test script to verify cron scheduling functionality
const ScriptExecutionService = require('./src/services/scriptExecution');

async function testCronScheduling() {
  console.log('🕐 Testing Cron Scheduling Functionality...\n');
  
  // Create a new instance of the script execution service
  const scriptExecution = new ScriptExecutionService();
  
  // Test script for cron scheduling
  const testScript = {
    _id: 'cron-test-script',
    name: 'Test Cron Script',
    code: `
      console.log('🎯 Cron script executed at:', new Date().toISOString());
      console.log('📦 Payload received:', JSON.stringify(payload, null, 2));
      
      if (payload.scheduled) {
        console.log('✅ This execution was triggered by cron schedule');
      }
      
      return { 
        success: true, 
        message: 'Cron execution completed',
        executedAt: new Date().toISOString(),
        payload: payload
      };
    `
  };
  
  console.log('📊 Initial Cron Statistics:');
  let cronStats = scriptExecution.getCronStatistics();
  console.log(JSON.stringify(cronStats, null, 2));
  console.log('\n');
  
  // Test 1: Validate cron expressions
  console.log('🔍 Testing Cron Expression Validation...');
  const validCron = '*/10 * * * * *'; // Every 10 seconds
  const invalidCron = 'invalid expression';
  
  console.log(`Valid cron "${validCron}":`, scriptExecution.validateCronExpression(validCron));
  console.log(`Invalid cron "${invalidCron}":`, scriptExecution.validateCronExpression(invalidCron));
  console.log('');
  
  // Test 2: Schedule a script
  console.log('📅 Scheduling test script...');
  try {
    const scheduleResult = scriptExecution.scheduleScript(
      testScript, 
      validCron, 
      { 
        testData: 'cron-test', 
        environment: 'testing',
        cronTest: true
      }
    );
    console.log('✅ Schedule result:', scheduleResult);
  } catch (error) {
    console.error('❌ Scheduling failed:', error.message);
  }
  
  // Test 3: Check scheduled scripts
  console.log('\n📋 Checking scheduled scripts...');
  const scheduledScripts = scriptExecution.getScheduledScripts();
  console.log('Scheduled scripts:', JSON.stringify(scheduledScripts, null, 2));
  
  // Test 4: Update cron statistics
  console.log('\n📈 Updated Cron Statistics:');
  cronStats = scriptExecution.getCronStatistics();
  console.log(JSON.stringify(cronStats, null, 2));
  
  // Test 5: Wait for a few executions (since we set it to every 10 seconds)
  console.log('\n⏳ Waiting 35 seconds to observe cron executions...');
  await new Promise(resolve => setTimeout(resolve, 35000));
  
  // Check statistics after some executions
  console.log('\n📊 Statistics after executions:');
  cronStats = scriptExecution.getCronStatistics();
  console.log(JSON.stringify(cronStats, null, 2));
  
  // Test 6: Reschedule the script
  console.log('\n🔄 Testing reschedule functionality...');
  const newCron = '*/30 * * * * *'; // Every 30 seconds
  try {
    const rescheduleResult = scriptExecution.rescheduleScript('cron-test-script', newCron);
    console.log('✅ Reschedule result:', rescheduleResult);
  } catch (error) {
    console.error('❌ Reschedule failed:', error.message);
  }
  
  // Test 7: Update payload
  console.log('\n📝 Testing payload update...');
  try {
    const updateResult = scriptExecution.updateScheduledScriptPayload('cron-test-script', {
      updated: true,
      timestamp: new Date().toISOString()
    });
    console.log('✅ Payload update result:', updateResult);
  } catch (error) {
    console.error('❌ Payload update failed:', error.message);
  }
  
  // Test 8: Stop and start all scheduled scripts
  console.log('\n⏸️ Testing stop/start functionality...');
  const stopResult = scriptExecution.stopAllScheduledScripts();
  console.log('Stop result:', stopResult);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const startResult = scriptExecution.startAllScheduledScripts();
  console.log('Start result:', startResult);
  
  // Test 9: Final cleanup - unschedule the script
  console.log('\n🗑️ Cleaning up - unscheduling test script...');
  try {
    const unscheduleResult = scriptExecution.unscheduleScript('cron-test-script');
    console.log('✅ Unschedule result:', unscheduleResult);
  } catch (error) {
    console.error('❌ Unschedule failed:', error.message);
  }
  
  // Final statistics
  console.log('\n📊 Final Cron Statistics:');
  cronStats = scriptExecution.getCronStatistics();
  console.log(JSON.stringify(cronStats, null, 2));
  
  console.log('\n🎉 Cron scheduling test completed!');
  
  // Exit gracefully
  process.exit(0);
}

// Run the test
testCronScheduling().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
