/**
 * Enhanced Script Execution Service with Distributed Coordination
 * Handles script execution with leader election for cron jobs and distributed locking for event scripts
 */

const EventEmitter = require('events');
const cron = require('node-cron');
const vm = require('vm');
const crypto = require('crypto');
const config = require('../config');
const DistributedLock = require('./distributedLock');
const LeaderElection = require('./leaderElection');

class EnhancedScriptExecutionService extends EventEmitter {
  constructor(databaseService) {
    super();
    this.databaseService = databaseService;
    this.distributedLock = new DistributedLock();
    this.leaderElection = new LeaderElection('cron-scheduler');
    
    this.cronJobs = new Map(); // Local cron jobs when leader
    this.scheduledScripts = new Map(); // Script definitions
    this.runningExecutions = new Map(); // Track running executions
    this.isShuttingDown = false;
    
    this.setupLeadershipHandlers();
    this.setupGracefulShutdown();
    
    // Start leader election if clustering is enabled
    if (config.cluster.cronLeaderElection) {
      this.startLeaderElection();
    }
  }

  setupLeadershipHandlers() {
    this.leaderElection.on('leadershipAcquired', async (data) => {
      console.log('👑 Acquired cron leadership, starting scheduled scripts...');
      await this.restoreScheduledScripts();
      this.emit('cronLeadershipAcquired', data);
    });

    this.leaderElection.on('leadershipLost', (data) => {
      console.log('💔 Lost cron leadership, stopping scheduled scripts...');
      this.stopAllCronJobs();
      this.emit('cronLeadershipLost', data);
    });

    this.leaderElection.on('leadershipResigned', (data) => {
      console.log('👋 Resigned cron leadership gracefully');
      this.stopAllCronJobs();
      this.emit('cronLeadershipResigned', data);
    });
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      
      this.isShuttingDown = true;
      console.log(`📴 Received ${signal}, shutting down script execution service...`);
      
      // Stop all cron jobs immediately
      await this.stopAllCronJobs();
      
      // Wait for running executions to complete (with timeout)
      await this.waitForRunningExecutions(30000); // 30 second timeout
      
      // Stop leader election
      if (this.leaderElection) {
        await this.leaderElection.stop();
      }
      
      // Disconnect from Redis
      await this.distributedLock.disconnect();
      
      console.log('✅ Script execution service shutdown complete');
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    process.on('SIGUSR2', shutdown);
  }

  async startLeaderElection() {
    try {
      await this.leaderElection.startElection();
    } catch (error) {
      console.error('❌ Failed to start cron leader election:', error.message);
    }
  }

  /**
   * Execute event-triggered script with distributed locking
   */
  async executeEventScript(collection, event, document, previousDocument = null) {
    if (this.isShuttingDown) return;

    const documentId = document._id?.toString() || 'unknown';
    const lockKey = `script:event:${collection}:${event}:${documentId}`;
    
    const lock = await this.distributedLock.acquireLock(lockKey, 30000); // 30 second timeout
    
    if (!lock) {
      console.log(`🔒 Event script execution for ${lockKey} already in progress on another instance`);
      return { skipped: true, reason: 'Already processing on another instance' };
    }

    try {
      console.log(`⚡ Executing event scripts for ${collection}:${event}:${documentId}`);
      
      const scripts = await this.getEventScripts(collection, event);
      const results = [];
      
      for (const script of scripts) {
        try {
          const result = await this.executeScriptWithContext(script, {
            collection,
            event,
            document,
            previousDocument,
            type: 'event',
            executionId: crypto.randomUUID(),
            timestamp: new Date().toISOString()
          });
          
          results.push({
            scriptId: script._id.toString(),
            scriptName: script.name,
            success: true,
            result
          });
          
        } catch (error) {
          console.error(`❌ Event script ${script.name} failed:`, error.message);
          
          results.push({
            scriptId: script._id.toString(),
            scriptName: script.name,
            success: false,
            error: error.message
          });
        }
      }
      
      console.log(`✅ Completed ${results.length} event scripts for ${collection}:${event}:${documentId}`);
      
      return {
        success: true,
        executedScripts: results.length,
        results,
        collection,
        event,
        documentId
      };
      
    } catch (error) {
      console.error(`❌ Error executing event scripts for ${lockKey}:`, error.message);
      throw error;
    } finally {
      await this.distributedLock.releaseLock(lockKey, lock);
    }
  }

  /**
   * Schedule a cron job (only executed by leader)
   */
  async scheduleScript(scriptId, cronExpression, scriptCode, scriptOptions = {}) {
    try {
      // Always persist to database regardless of leadership
      await this.persistScheduledScript(scriptId, cronExpression, scriptCode, scriptOptions);
      
      // Only actually schedule if we're the leader
      if (this.leaderElection.isLeader) {
        return await this.scheduleScriptInternal(scriptId, cronExpression, scriptCode, scriptOptions);
      } else {
        console.log(`📝 Script ${scriptId} persisted, waiting for cron leadership to schedule`);
        return { success: true, scheduled: false, reason: 'Not cron leader' };
      }
    } catch (error) {
      console.error(`❌ Failed to schedule script ${scriptId}:`, error.message);
      throw error;
    }
  }

  /**
   * Internal method to actually schedule the cron job
   */
  async scheduleScriptInternal(scriptId, cronExpression, scriptCode, scriptOptions = {}) {
    if (!this.leaderElection.isLeader) {
      console.log(`⚠️  Not cron leader, cannot schedule script ${scriptId}`);
      return { success: false, reason: 'Not cron leader' };
    }

    try {
      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Create cron job with distributed locking for execution
      const job = cron.schedule(cronExpression, async () => {
        await this.executeCronScript(scriptId, scriptCode, scriptOptions);
      }, { 
        scheduled: false,
        timezone: scriptOptions.timezone || config.scripts.cron.timezone || 'UTC'
      });

      // Store job reference
      this.cronJobs.set(scriptId, job);
      this.scheduledScripts.set(scriptId, {
        cronExpression,
        scriptCode,
        scriptOptions,
        job,
        scheduledAt: new Date().toISOString(),
        isPaused: false
      });

      // Start the job
      job.start();
      
      console.log(`⏰ Scheduled cron script ${scriptId} with expression: ${cronExpression}`);
      
      return { 
        success: true, 
        scheduled: true, 
        scriptId, 
        cronExpression,
        scheduledBy: config.cluster.instanceId
      };
      
    } catch (error) {
      console.error(`❌ Failed to schedule script ${scriptId}:`, error.message);
      throw error;
    }
  }

  /**
   * Execute a cron script with distributed locking
   */
  async executeCronScript(scriptId, scriptCode, scriptOptions = {}) {
    const executionId = `${scriptId}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const lockKey = `cron:execution:${executionId}`;
    
    const lock = await this.distributedLock.acquireLock(
      lockKey, 
      config.scaling.maxScriptExecutionTime || 300000
    );
    
    if (!lock) {
      console.log(`🔒 Cron execution ${executionId} already running on another instance`);
      return;
    }

    try {
      console.log(`⏰ Executing scheduled script: ${scriptId} (${executionId})`);
      
      const result = await this.executeScriptWithContext(scriptCode, {
        scriptId,
        executionId,
        type: 'scheduled',
        timestamp: new Date().toISOString(),
        cronExpression: this.scheduledScripts.get(scriptId)?.cronExpression,
        ...scriptOptions
      });
      
      // Update last execution time
      await this.updateLastExecution(scriptId, executionId, true);
      
      console.log(`✅ Cron script ${scriptId} completed successfully`);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Cron script ${scriptId} failed:`, error.message);
      
      // Track failure
      await this.updateLastExecution(scriptId, executionId, false, error.message);
      
      throw error;
    } finally {
      await this.distributedLock.releaseLock(lockKey, lock);
    }
  }

  /**
   * Execute script with proper context and sandboxing
   */
  async executeScriptWithContext(scriptCode, context) {
    const executionId = context.executionId || crypto.randomUUID();
    
    // Track running execution
    this.runningExecutions.set(executionId, {
      startTime: Date.now(),
      context,
      timeout: null
    });

    try {
      // Create execution timeout
      const timeoutPromise = new Promise((_, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Script execution timeout after ${config.scripts.execution.timeout}ms`));
        }, config.scripts.execution.timeout);
        
        this.runningExecutions.get(executionId).timeout = timeout;
      });

      // Create script execution promise
      const executionPromise = this.executeInSandbox(scriptCode, context);

      // Race between execution and timeout
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      return result;
      
    } catch (error) {
      console.error(`❌ Script execution ${executionId} failed:`, error.message);
      throw error;
    } finally {
      // Clean up tracking
      const execution = this.runningExecutions.get(executionId);
      if (execution?.timeout) {
        clearTimeout(execution.timeout);
      }
      this.runningExecutions.delete(executionId);
    }
  }

  /**
   * Execute script in sandboxed environment
   */
  async executeInSandbox(scriptCode, context) {
    const sandbox = {
      // Provided context
      payload: {
        collection: context.collection,
        event: context.event,
        data: {
          document: context.document,
          previousDocument: context.previousDocument
        },
        executionId: context.executionId,
        timestamp: context.timestamp,
        type: context.type
      },
      
      // Utility functions
      utils: {
        log: (...args) => console.log(`[Script ${context.executionId}]`, ...args),
        error: (...args) => console.error(`[Script ${context.executionId}]`, ...args),
        warn: (...args) => console.warn(`[Script ${context.executionId}]`, ...args)
      },
      
      // API access (simplified for now)
      api: {
        get: async (path) => { /* Implement API calls */ },
        post: async (path, data) => { /* Implement API calls */ },
        put: async (path, data) => { /* Implement API calls */ },
        delete: async (path) => { /* Implement API calls */ }
      },
      
      // Standard globals
      console: {
        log: (...args) => console.log(`[Script ${context.executionId}]`, ...args),
        error: (...args) => console.error(`[Script ${context.executionId}]`, ...args),
        warn: (...args) => console.warn(`[Script ${context.executionId}]`, ...args)
      },
      
      // Built-in modules (restricted)
      JSON,
      Date,
      Math,
      setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 10000)), // Max 10 second delays
      setInterval: () => { throw new Error('setInterval not allowed in scripts'); },
      
      // Result container
      __result: undefined
    };

    // Create VM context
    const vmContext = vm.createContext(sandbox);
    
    // Wrap script to capture return value
    const wrappedScript = `
      (async function() {
        ${scriptCode}
      })().then(result => {
        __result = result;
      }).catch(error => {
        __result = { error: error.message, stack: error.stack };
      });
    `;

    try {
      // Execute script
      vm.runInContext(wrappedScript, vmContext, {
        timeout: config.scripts.execution.timeout,
        filename: `script-${context.executionId}.js`
      });

      // Wait for async execution to complete
      let attempts = 0;
      const maxAttempts = config.scripts.execution.timeout / 100;
      
      while (sandbox.__result === undefined && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (sandbox.__result === undefined) {
        throw new Error('Script execution did not complete within timeout');
      }

      if (sandbox.__result?.error) {
        throw new Error(sandbox.__result.error);
      }

      return sandbox.__result;
      
    } catch (error) {
      throw new Error(`Script execution error: ${error.message}`);
    }
  }

  /**
   * Restore scheduled scripts from database (called when becoming leader)
   */
  async restoreScheduledScripts() {
    if (!this.leaderElection.isLeader) return;
    
    try {
      console.log('🔄 Restoring scheduled scripts from database...');
      
      const scheduledScripts = await this.databaseService.getCollection('_scheduled_scripts')
        .find({ isActive: true }).toArray();
      
      let restored = 0;
      
      for (const script of scheduledScripts) {
        try {
          await this.scheduleScriptInternal(
            script.scriptId, 
            script.cronExpression, 
            script.scriptCode,
            script.scriptOptions || {}
          );
          restored++;
        } catch (error) {
          console.error(`❌ Failed to restore script ${script.scriptId}:`, error.message);
        }
      }
      
      console.log(`✅ Restored ${restored}/${scheduledScripts.length} scheduled scripts`);
      
    } catch (error) {
      console.error('❌ Error restoring scheduled scripts:', error.message);
    }
  }

  /**
   * Stop all cron jobs
   */
  async stopAllCronJobs() {
    console.log('🛑 Stopping all cron jobs...');
    
    for (const [scriptId, job] of this.cronJobs) {
      try {
        job.stop();
        job.destroy();
        console.log(`⏹️  Stopped cron job: ${scriptId}`);
      } catch (error) {
        console.error(`❌ Error stopping cron job ${scriptId}:`, error.message);
      }
    }
    
    this.cronJobs.clear();
    this.scheduledScripts.clear();
    
    console.log('✅ All cron jobs stopped');
  }

  /**
   * Pause a scheduled script
   */
  async pauseScheduledScript(scriptId) {
    if (!this.leaderElection.isLeader) {
      return { success: false, message: 'Not the cron leader, cannot pause scripts' };
    }

    const job = this.cronJobs.get(scriptId);
    const scheduledScript = this.scheduledScripts.get(scriptId);
    
    if (!job || !scheduledScript) {
      return { success: false, message: `No scheduled job found for script: ${scriptId}` };
    }

    if (scheduledScript.isPaused) {
      return { success: false, message: `Script ${scriptId} is already paused` };
    }

    try {
      job.stop();
      scheduledScript.isPaused = true;
      
      // Update database state
      await this.updateScheduledScriptState(scriptId, false);
      
      console.log(`⏸️ Paused scheduled script: ${scriptId}`);
      
      return {
        success: true,
        message: `Script ${scriptId} has been paused`,
        status: 'paused'
      };
    } catch (error) {
      console.error(`❌ Error pausing script ${scriptId}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Resume a paused scheduled script
   */
  async resumeScheduledScript(scriptId) {
    if (!this.leaderElection.isLeader) {
      return { success: false, message: 'Not the cron leader, cannot resume scripts' };
    }

    const job = this.cronJobs.get(scriptId);
    const scheduledScript = this.scheduledScripts.get(scriptId);
    
    if (!job || !scheduledScript) {
      return { success: false, message: `No scheduled job found for script: ${scriptId}` };
    }

    if (!scheduledScript.isPaused) {
      return { success: false, message: `Script ${scriptId} is already running` };
    }

    try {
      job.start();
      scheduledScript.isPaused = false;
      
      // Update database state
      await this.updateScheduledScriptState(scriptId, true);
      
      console.log(`▶️ Resumed scheduled script: ${scriptId}`);
      
      return {
        success: true,
        message: `Script ${scriptId} has been resumed`,
        status: 'running'
      };
    } catch (error) {
      console.error(`❌ Error resuming script ${scriptId}:`, error.message);
      return { success: false, message: error.message };
    }
  }

  /**
   * Update scheduled script state in database
   */
  async updateScheduledScriptState(scriptId, isActive) {
    try {
      await this.databaseService.getCollection('_scheduled_scripts')
        .updateOne(
          { scriptId },
          { 
            $set: { 
              isActive,
              updatedAt: new Date()
            }
          }
        );
    } catch (error) {
      console.error(`❌ Error updating script state in database:`, error.message);
    }
  }

  /**
   * Unschedule a script
   */
  async unscheduleScript(scriptId) {
    try {
      // Remove from database
      await this.removeScheduledScriptFromDB(scriptId);
      
      // Stop local cron job if it exists
      const job = this.cronJobs.get(scriptId);
      if (job) {
        job.stop();
        job.destroy();
        this.cronJobs.delete(scriptId);
        this.scheduledScripts.delete(scriptId);
        console.log(`⏹️  Unscheduled script: ${scriptId}`);
      }
      
      return { success: true, scriptId };
    } catch (error) {
      console.error(`❌ Failed to unschedule script ${scriptId}:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for running executions to complete
   */
  async waitForRunningExecutions(timeout = 30000) {
    if (this.runningExecutions.size === 0) return;
    
    console.log(`⏳ Waiting for ${this.runningExecutions.size} running executions to complete...`);
    
    const startTime = Date.now();
    
    while (this.runningExecutions.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (this.runningExecutions.size > 0) {
      console.warn(`⚠️  ${this.runningExecutions.size} executions still running after timeout`);
    } else {
      console.log('✅ All executions completed');
    }
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    return {
      isLeader: this.leaderElection.isLeader,
      instanceId: config.cluster.instanceId,
      cronJobs: this.cronJobs.size,
      runningExecutions: this.runningExecutions.size,
      scheduledScripts: this.scheduledScripts.size,
      leadershipStatus: this.leaderElection.getLeadershipStatus(),
      timestamp: new Date().toISOString()
    };
  }

  // Database operations for scheduled scripts
  async getEventScripts(collection, event) { 
    try {
      const scripts = await this.databaseService.getCollection('_scripts')
        .find({ 
          $or: [
            { collection: collection },
            { collection: '' } // Global scripts
          ],
          events: event,
          enabled: true 
        }).toArray();
      return scripts;
    } catch (error) {
      console.error('Error getting event scripts:', error);
      return [];
    }
  }
  
  async persistScheduledScript(scriptId, cronExpression, scriptCode, options) { 
    try {
      const collection = this.databaseService.getCollection('_scheduled_scripts');
      
      // Check if document already exists with this scriptId
      const existingDoc = await collection.findOne({ scriptId });
      
      const doc = {
        scriptId,
        scriptName: options.scriptName || scriptId,
        scriptCode,
        cronExpression,
        scriptOptions: options,
        isActive: true,
        createdAt: existingDoc ? existingDoc.createdAt : new Date(),
        updatedAt: new Date(),
        lastExecution: null
      };
      
      if (existingDoc) {
        // Update existing document, preserving the ObjectId
        await collection.replaceOne(
          { _id: existingDoc._id },
          { ...doc, _id: existingDoc._id }
        );
      } else {
        // Insert new document with auto-generated ObjectId
        await collection.insertOne(doc);
      }
      
      console.log(`💾 Enhanced: Persisted scheduled script: ${scriptId}`);
    } catch (error) {
      console.error(`❌ Enhanced: Failed to persist scheduled script ${scriptId}:`, error);
    }
  }
  
  async removeScheduledScriptFromDB(scriptId) { 
    try {
      const collection = this.databaseService.getCollection('_scheduled_scripts');
      await collection.deleteOne({ scriptId });
      console.log(`🗑️ Enhanced: Removed scheduled script from DB: ${scriptId}`);
    } catch (error) {
      console.error(`❌ Enhanced: Failed to remove scheduled script ${scriptId}:`, error);
    }
  }
  
  async updateLastExecution(scriptId, executionId, success, error = null) { 
    try {
      const collection = this.databaseService.getCollection('_scheduled_scripts');
      await collection.updateOne(
        { scriptId },
        { 
          $set: { 
            lastExecution: new Date(),
            lastExecutionId: executionId,
            lastExecutionSuccess: success,
            lastExecutionError: error,
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      console.error(`❌ Enhanced: Failed to update last execution for ${scriptId}:`, error);
    }
  }
}

module.exports = EnhancedScriptExecutionService;
