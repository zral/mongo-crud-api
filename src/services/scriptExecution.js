const vm = require('vm');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const cron = require('node-cron');
const config = require('../config');
const RedisDistributedLock = require('./redisDistributedLock');

class ScriptExecutionService {
  constructor() {
    // Database reference will be set by setDatabase()
    this.db = null;
    
    // Redis distributed lock for cron coordination
    this.distributedLock = new RedisDistributedLock({
      host: process.env.REDIS_HOST || 'redis',
      port: process.env.REDIS_PORT || 6379
    });
    
    // Rate limiting: Map of script IDs to their last execution times and counts
    this.rateLimitMap = new Map();
    
    // Execution queue for failed scripts
    this.executionQueue = [];
    
    // Cron job tracking
    this.scheduledJobs = new Map(); // Map of script IDs to cron job instances
    this.cronStats = {
      totalScheduledScripts: 0,
      activeSchedules: 0,
      cronExecutions: 0,
      failedCronExecutions: 0,
      lastCronExecution: null
    };
    
    // Persistent execution statistics
    this.executionStats = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      lastExecution: null,
      executionsToday: 0,
      executionsThisWeek: 0,
      executionsThisMonth: 0,
      averageExecutionTime: 0,
      peakExecutionsPerMinute: 0,
      scriptExecutionCounts: new Map(), // Per-script execution counts
      lastResetDate: new Date().toDateString()
    };
    
    // Rate limiting configuration (similar to webhooks)
    this.rateLimit = {
      maxExecutionsPerMinute: 60, // Max 60 executions per minute per script
      windowMs: 60 * 1000, // 1 minute window
      backoffMultiplier: 2, // Exponential backoff multiplier
      maxRetries: 3, // Maximum retry attempts
      baseDelayMs: 1000, // Base delay between retries (1 second)
      maxDelayMs: 30000 // Maximum delay between retries (30 seconds)
    };
    
    // Script execution timeout and API configuration
    this.executionTimeout = config.scripts.execution.timeout || 30000; // 30 seconds max execution time
    this.apiBaseUrl = config.scripts.execution.apiBaseUrl;
    
    // Start processing retry queue
    this.startRetryProcessor();
    
    // Reset daily stats if needed
    this.checkDailyReset();
  }

  /**
   * Set database reference for persistence
   */
  setDatabase(db) {
    this.db = db;
  }

  /**
   * Get the scheduled scripts collection
   */
  getScheduledScriptsCollection() {
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db.collection('_scheduled_scripts');
  }

  /**
   * Check if a script is rate limited
   */
  isRateLimited(scriptId, maxExecutionsPerMinute = this.rateLimit.maxExecutionsPerMinute) {
    const now = Date.now();
    const scriptData = this.rateLimitMap.get(scriptId);
    
    if (!scriptData) {
      return false;
    }
    
    // Clean old entries outside the time window
    scriptData.executions = scriptData.executions.filter(
      timestamp => now - timestamp < this.rateLimit.windowMs
    );
    
    // Check if we've exceeded the rate limit
    if (scriptData.executions.length >= maxExecutionsPerMinute) {
      console.log(`Rate limit exceeded for script: ${scriptId} (${scriptData.executions.length}/${maxExecutionsPerMinute} executions)`);
      return true;
    }
    
    return false;
  }

  /**
   * Record a script execution attempt
   */
  recordExecution(scriptId) {
    const now = Date.now();
    
    if (!this.rateLimitMap.has(scriptId)) {
      this.rateLimitMap.set(scriptId, { executions: [] });
    }
    
    const scriptData = this.rateLimitMap.get(scriptId);
    scriptData.executions.push(now);
  }

  /**
   * Track execution statistics
   */
  trackExecution(scriptId, success, executionTime = 0) {
    const now = new Date();
    this.executionStats.totalExecutions++;
    this.executionStats.lastExecution = now.toISOString();
    
    if (success) {
      this.executionStats.successfulExecutions++;
    } else {
      this.executionStats.failedExecutions++;
    }

    // Update average execution time
    if (executionTime > 0) {
      const totalTime = this.executionStats.averageExecutionTime * (this.executionStats.totalExecutions - 1) + executionTime;
      this.executionStats.averageExecutionTime = Math.round(totalTime / this.executionStats.totalExecutions);
    }

    // Track per-script executions
    const scriptCount = this.executionStats.scriptExecutionCounts.get(scriptId) || 0;
    this.executionStats.scriptExecutionCounts.set(scriptId, scriptCount + 1);

    // Update daily/weekly/monthly counters
    this.updatePeriodCounters();

    // Track peak executions per minute
    this.updatePeakExecutions();
  }

  /**
   * Update daily, weekly, and monthly counters
   */
  updatePeriodCounters() {
    const today = new Date().toDateString();
    
    // Reset counters if new day
    if (this.executionStats.lastResetDate !== today) {
      this.executionStats.executionsToday = 0;
      this.executionStats.lastResetDate = today;
    }
    
    this.executionStats.executionsToday++;
    this.executionStats.executionsThisWeek++; // Simplified - could be more precise
    this.executionStats.executionsThisMonth++; // Simplified - could be more precise
  }

  /**
   * Update peak executions per minute tracking
   */
  updatePeakExecutions() {
    const now = Date.now();
    let currentMinuteExecutions = 0;
    
    // Count all executions across all scripts in the last minute
    for (const [, scriptData] of this.rateLimitMap.entries()) {
      const recentExecutions = scriptData.executions.filter(
        timestamp => now - timestamp < 60000 // Last minute
      );
      currentMinuteExecutions += recentExecutions.length;
    }
    
    if (currentMinuteExecutions > this.executionStats.peakExecutionsPerMinute) {
      this.executionStats.peakExecutionsPerMinute = currentMinuteExecutions;
    }
  }

  /**
   * Check if daily stats need reset
   */
  checkDailyReset() {
    const today = new Date().toDateString();
    if (this.executionStats.lastResetDate !== today) {
      this.executionStats.executionsToday = 0;
      this.executionStats.lastResetDate = today;
    }
  }

  /**
   * Simple HTTP client function
   */
  makeHttpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {},
        timeout: options.timeout || 10000
      };

      const req = httpModule.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              statusText: res.statusMessage,
              data: jsonData
            });
          } catch (parseError) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                ok: true,
                status: res.statusCode,
                statusText: res.statusMessage,
                data: data
              });
            } else {
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  /**
   * Create API context for scripts
   */
  createApiContext(payload, baseUrl = 'http://nginx:80') {
    const self = this;
    
    // Create the context object that will be available to scripts
    const context = {
      event: payload?.event || 'test',
      collection: payload?.collection || 'unknown',
      timestamp: payload?.timestamp || new Date().toISOString(),
      data: payload?.data || { document: { test: true } },
      script: payload?.script || { name: 'test-script' },
      ...payload // Include all payload properties
    };
    
    return {
      // Context object (main interface for scripts)
      context,
      
      // Payload data (legacy support)
      payload,
      
      // Collections API methods
      api: {
        // GET request to collections API
        get: async (endpoint, params = {}) => {
          const url = new URL(endpoint, baseUrl);
          Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
          });
          
          const response = await self.makeHttpRequest(url.toString(), {
            method: 'GET',
            headers: { 'User-Agent': 'ScriptExecution/1.0' },
            timeout: 10000
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return response.data;
        },
        
        // POST request to collections API
        post: async (endpoint, data = {}) => {
          const url = new URL(endpoint, baseUrl);
          const response = await self.makeHttpRequest(url.toString(), {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'User-Agent': 'ScriptExecution/1.0'
            },
            body: data,
            timeout: 10000
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return response.data;
        },
        
        // PUT request to collections API
        put: async (endpoint, data = {}) => {
          const url = new URL(endpoint, baseUrl);
          const response = await self.makeHttpRequest(url.toString(), {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'User-Agent': 'ScriptExecution/1.0'
            },
            body: data,
            timeout: 10000
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return response.data;
        },
        
        // DELETE request to collections API
        delete: async (endpoint) => {
          const url = new URL(endpoint, baseUrl);
          const response = await self.makeHttpRequest(url.toString(), {
            method: 'DELETE',
            headers: { 'User-Agent': 'ScriptExecution/1.0' },
            timeout: 10000
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          return response.data;
        }
      },
      
      // Console object for logging
      console: {
        log: (...args) => console.log('[Script]', ...args),
        error: (...args) => console.error('[Script Error]', ...args),
        warn: (...args) => console.warn('[Script Warning]', ...args),
        info: (...args) => console.info('[Script Info]', ...args)
      },
      
      // Utility functions
      utils: {
        log: (...args) => console.log('[Script]', ...args),
        error: (...args) => console.error('[Script Error]', ...args),
        now: () => new Date(),
        timestamp: () => new Date().toISOString()
      },
      
      // Safe JSON operations
      JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify
      },
      
      // Math operations
      Math,
      
      // Date operations
      Date
    };
  }

  /**
   * Execute a JavaScript snippet safely
   */
  async executeScript(script, payload, apiBaseUrl = null) {
    // Use configured API URL if not provided
    const effectiveApiUrl = apiBaseUrl || this.apiBaseUrl;
    
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      try {
        // Create a sandbox context with limited access
        const sandbox = this.createApiContext(payload, effectiveApiUrl);
        
        // Add Promise and async/await support
        sandbox.Promise = Promise;
        sandbox.setTimeout = setTimeout;
        sandbox.clearTimeout = clearTimeout;
        
        // Create a timeout for script execution
        const timeoutId = setTimeout(() => {
          const executionTime = Date.now() - startTime;
          const scriptId = script._id ? script._id.toString() : script.name;
          this.trackExecution(scriptId, false, executionTime);
          reject({ success: false, error: 'Script execution timeout', stack: null });
        }, this.executionTimeout);

        // Create VM context
        const context = vm.createContext(sandbox);

        // Wrap the script in an async function
        const wrappedScript = `
          (async function() {
            try {
              ${script.code}
            } catch (error) {
              throw error;
            }
          })()
        `;

        // Execute the script
        const executeAsync = async () => {
          try {
            const result = await vm.runInContext(wrappedScript, context, {
              timeout: this.executionTimeout,
              displayErrors: true
            });
            
            clearTimeout(timeoutId);
            const executionTime = Date.now() - startTime;
            const scriptId = script._id ? script._id.toString() : script.name;
            this.trackExecution(scriptId, true, executionTime);
            resolve({ success: true, result });
          } catch (error) {
            clearTimeout(timeoutId);
            const executionTime = Date.now() - startTime;
            const scriptId = script._id ? script._id.toString() : script.name;
            this.trackExecution(scriptId, false, executionTime);
            reject({ success: false, error: error.message, stack: error.stack });
          }
        };

        executeAsync();
      } catch (error) {
        const executionTime = Date.now() - startTime;
        const scriptId = script._id ? script._id.toString() : script.name;
        this.trackExecution(scriptId, false, executionTime);
        reject({ success: false, error: error.message, stack: error.stack });
      }
    });
  }

  /**
   * Execute script with rate limiting and retry logic
   */
  async executeScriptWithRetry(script, payload, retryCount = 0) {
    const scriptId = script._id ? script._id.toString() : script.name;
    
    // Check rate limiting
    const rateLimitConfig = script.rateLimit || this.rateLimit;
    if (this.isRateLimited(scriptId, rateLimitConfig.maxExecutionsPerMinute)) {
      if (retryCount < rateLimitConfig.maxRetries) {
        // Add to retry queue
        const delay = Math.min(
          rateLimitConfig.baseDelayMs * Math.pow(rateLimitConfig.backoffMultiplier, retryCount),
          rateLimitConfig.maxDelayMs
        );
        
        setTimeout(() => {
          this.executeScriptWithRetry(script, payload, retryCount + 1);
        }, delay);
        
        return { success: false, error: 'Rate limited - queued for retry', retryCount };
      } else {
        return { success: false, error: 'Rate limit exceeded - max retries reached', retryCount };
      }
    }

    // Record the execution attempt
    this.recordExecution(scriptId);

    try {
      const result = await this.executeScript(script, payload);
      console.log(`Script ${script.name} executed successfully`);
      return result;
    } catch (error) {
      console.error(`Script ${script.name} execution failed:`, error.error || error.message);
      
      // Retry on failure if retries available
      if (retryCount < rateLimitConfig.maxRetries) {
        const delay = Math.min(
          rateLimitConfig.baseDelayMs * Math.pow(rateLimitConfig.backoffMultiplier, retryCount),
          rateLimitConfig.maxDelayMs
        );
        
        setTimeout(() => {
          this.executeScriptWithRetry(script, payload, retryCount + 1);
        }, delay);
        
        return { success: false, error: error.error || error.message, retryCount, willRetry: true };
      }
      
      return { success: false, error: error.error || error.message, retryCount };
    }
  }

  /**
   * Start the retry processor for failed executions
   */
  startRetryProcessor() {
    setInterval(() => {
      if (this.executionQueue.length > 0) {
        const { script, payload, retryCount } = this.executionQueue.shift();
        this.executeScriptWithRetry(script, payload, retryCount);
      }
    }, 5000); // Process retry queue every 5 seconds
  }

  /**
   * Get execution statistics
   */
  getStatistics() {
    this.checkDailyReset(); // Ensure daily stats are current
    
    const totalScripts = this.rateLimitMap.size;
    let recentExecutions = 0;
    let activeScripts = 0;
    
    const now = Date.now();
    for (const [scriptId, data] of this.rateLimitMap.entries()) {
      // Count executions in the last minute
      const recentExecutionsList = data.executions.filter(
        timestamp => now - timestamp < this.rateLimit.windowMs
      );
      recentExecutions += recentExecutionsList.length;
      if (recentExecutionsList.length > 0) {
        activeScripts++;
      }
    }

    // Convert script execution counts Map to object for JSON serialization
    const scriptExecutionCounts = {};
    for (const [scriptId, count] of this.executionStats.scriptExecutionCounts.entries()) {
      scriptExecutionCounts[scriptId] = count;
    }
    
    return {
      // Current session stats
      totalScripts,
      activeScripts,
      recentExecutions, // Executions in the last minute
      queuedRetries: this.executionQueue.length,
      
      // Persistent execution statistics
      totalExecutions: this.executionStats.totalExecutions,
      successfulExecutions: this.executionStats.successfulExecutions,
      failedExecutions: this.executionStats.failedExecutions,
      successRate: this.executionStats.totalExecutions > 0 
        ? Math.round((this.executionStats.successfulExecutions / this.executionStats.totalExecutions) * 100) 
        : 0,
      
      // Time-based statistics
      lastExecution: this.executionStats.lastExecution,
      executionsToday: this.executionStats.executionsToday,
      executionsThisWeek: this.executionStats.executionsThisWeek,
      executionsThisMonth: this.executionStats.executionsThisMonth,
      
      // Performance metrics
      averageExecutionTime: this.executionStats.averageExecutionTime,
      peakExecutionsPerMinute: this.executionStats.peakExecutionsPerMinute,
      
      // Cron scheduling statistics
      cronStats: this.getCronStatistics(),
      
      // Per-script statistics
      scriptExecutionCounts,
      topScripts: this.getTopScripts(),
      
      // Configuration
      rateLimit: this.rateLimit
    };
  }

  /**
   * Get top 5 most executed scripts
   */
  getTopScripts() {
    const sorted = Array.from(this.executionStats.scriptExecutionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([scriptId, count]) => ({ scriptId, executions: count }));
    
    return sorted;
  }

  /**
   * Clear rate limiting data for a specific script
   */
  clearRateLimit(scriptId) {
    this.rateLimitMap.delete(scriptId);
  }

  /**
   * Clear all rate limiting data
   */
  clearAllRateLimits() {
    this.rateLimitMap.clear();
    this.executionQueue.length = 0;
  }

  /**
   * Schedule a script to run on a cron schedule
   */
  async scheduleScript(script, cronExpression, payload = {}) {
    const scriptId = script._id ? script._id.toString() : script.name;
    
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    // Stop existing schedule if any
    await this.unscheduleScript(scriptId);
    
    console.log(`📅 Scheduling script "${script.name}" with cron: ${cronExpression}`);
    
    // Create and start the cron job with distributed locking
    const job = cron.schedule(cronExpression, async () => {
      const lockAcquired = await this.distributedLock.acquireLock(scriptId, 300); // 5 minute lock
      
      if (!lockAcquired) {
        console.log(`🚫 Script "${script.name}" already executing on another instance, skipping...`);
        return;
      }
      
      try {
        console.log(`⏰ Executing scheduled script: ${script.name} (distributed lock acquired)`);
        this.cronStats.cronExecutions++;
        this.cronStats.lastCronExecution = new Date().toISOString();
        
        // Update last execution time in database
        await this.updateScheduledScriptExecution(scriptId);
        
        // Execute the script with cron-specific payload
        const cronPayload = {
          ...payload,
          trigger: 'cron',
          scheduled: true,
          executionTime: new Date().toISOString(),
          cronExpression: cronExpression,
          distributedExecution: true
        };
        
        const result = await this.executeScript(script, cronPayload);
        console.log(`✅ Scheduled script "${script.name}" executed successfully:`, result);
        
      } catch (error) {
        this.cronStats.failedCronExecutions++;
        console.error(`❌ Scheduled script "${script.name}" execution failed:`, error);
      } finally {
        // Always release the lock after execution
        await this.distributedLock.releaseLock(scriptId);
      }
    }, {
      scheduled: true // Start immediately and set running state
    });
    
    // Store the job in memory
    this.scheduledJobs.set(scriptId, {
      job,
      cronExpression,
      script,
      payload,
      createdAt: new Date().toISOString(),
      lastExecution: null,
      isRunning: true // Track running state manually
    });
    
    // Persist to database
    await this.persistScheduledScript(scriptId, script, cronExpression, payload);
    
    // Update statistics
    this.cronStats.totalScheduledScripts++;
    this.cronStats.activeSchedules = this.scheduledJobs.size;
    
    return {
      success: true,
      message: `Script "${script.name}" scheduled with cron: ${cronExpression}`,
      scriptId,
      cronExpression
    };
  }

  /**
   * Unschedule a script
   */
  async unscheduleScript(scriptId) {
    const scheduledJob = this.scheduledJobs.get(scriptId);
    if (scheduledJob) {
      scheduledJob.job.stop();
      scheduledJob.job.destroy();
      this.scheduledJobs.delete(scriptId);
      this.cronStats.activeSchedules = this.scheduledJobs.size;
      
      // Remove from database
      await this.removeScheduledScriptFromDB(scriptId);
      
      console.log(`🗑️ Unscheduled script: ${scriptId}`);
      return { success: true, message: `Script ${scriptId} unscheduled` };
    }
    
    return { success: false, message: `No scheduled job found for script: ${scriptId}` };
  }

  /**
   * Get all scheduled scripts
   */
  getScheduledScripts() {
    const scheduled = [];
    for (const [scriptId, jobData] of this.scheduledJobs.entries()) {
      // Safe access to script name with fallback
      const scriptName = (jobData.script && jobData.script.name) 
        ? jobData.script.name 
        : `Script-${scriptId}`;
      
      // Safe access to script code with fallback
      const scriptCode = (jobData.script && jobData.script.code) 
        ? jobData.script.code 
        : '';
      
      scheduled.push({
        scriptId,
        scriptName,
        scriptCode,
        cronExpression: jobData.cronExpression,
        createdAt: jobData.createdAt,
        lastExecution: jobData.lastExecution,
        isRunning: jobData.isRunning !== undefined ? jobData.isRunning : true
      });
    }
    return scheduled;
  }

  /**
   * Update scheduled script payload
   */
  updateScheduledScriptPayload(scriptId, newPayload) {
    const scheduledJob = this.scheduledJobs.get(scriptId);
    if (scheduledJob) {
      scheduledJob.payload = { ...scheduledJob.payload, ...newPayload };
      return { success: true, message: `Payload updated for script: ${scriptId}` };
    }
    
    return { success: false, message: `No scheduled job found for script: ${scriptId}` };
  }

  /**
   * Reschedule a script with new cron expression
   */
  rescheduleScript(scriptId, newCronExpression) {
    const scheduledJob = this.scheduledJobs.get(scriptId);
    if (!scheduledJob) {
      return { success: false, message: `No scheduled job found for script: ${scriptId}` };
    }
    
    // Validate new cron expression
    if (!cron.validate(newCronExpression)) {
      return { success: false, message: `Invalid cron expression: ${newCronExpression}` };
    }
    
    // Reschedule with new expression
    const result = this.scheduleScript(scheduledJob.script, newCronExpression, scheduledJob.payload);
    
    return {
      success: true,
      message: `Script "${scheduledJob.script.name}" rescheduled with new cron: ${newCronExpression}`,
      previousCron: scheduledJob.cronExpression,
      newCron: newCronExpression
    };
  }

  /**
   * Pause a scheduled script (stop execution but keep schedule)
   */
  async pauseScheduledScript(scriptId) {
    const scheduledJob = this.scheduledJobs.get(scriptId);
    if (!scheduledJob) {
      return { success: false, message: `No scheduled job found for script: ${scriptId}` };
    }

    if (!scheduledJob.isRunning) {
      return { success: false, message: `Script ${scriptId} is already paused` };
    }

    scheduledJob.job.stop();
    scheduledJob.isRunning = false; // Update manual tracking
    
    // Persist state change to database
    await this.updateScheduledScriptState(scriptId, false);
    
    console.log(`⏸️ Paused scheduled script: ${scheduledJob.script.name}`);
    
    return {
      success: true,
      message: `Script ${scriptId} has been paused`,
      status: 'paused'
    };
  }

  /**
   * Resume a paused scheduled script
   */
  async resumeScheduledScript(scriptId) {
    const scheduledJob = this.scheduledJobs.get(scriptId);
    if (!scheduledJob) {
      return { success: false, message: `No scheduled job found for script: ${scriptId}` };
    }

    if (scheduledJob.isRunning) {
      return { success: false, message: `Script ${scriptId} is already running` };
    }

    scheduledJob.job.start();
    scheduledJob.isRunning = true; // Update manual tracking
    
    // Persist state change to database
    await this.updateScheduledScriptState(scriptId, true);
    
    console.log(`▶️ Resumed scheduled script: ${scheduledJob.script.name}`);
    
    return {
      success: true,
      message: `Script ${scriptId} has been resumed`,
      status: 'running'
    };
  }

  /**
   * Get cron scheduling statistics
   */
  async getCronStatistics() {
    const distributedLocks = await this.getDistributedLockInfo();
    
    return {
      ...this.cronStats,
      activeSchedules: this.scheduledJobs.size,
      scheduledScripts: this.getScheduledScripts(),
      distributedLocks
    };
  }

  /**
   * Get distributed lock information
   */
  async getDistributedLockInfo() {
    try {
      const locks = await this.distributedLock.getAllLocks();
      return {
        activeLocks: locks.length,
        instanceId: this.distributedLock.instanceId,
        locks: locks.map(lock => ({
          scriptId: lock.scriptId,
          instance: lock.instance,
          ttl: lock.ttl,
          ownedByThisInstance: lock.ownedByThisInstance
        }))
      };
    } catch (error) {
      console.error('❌ Error getting distributed lock info:', error);
      return {
        activeLocks: 0,
        instanceId: this.distributedLock.instanceId,
        locks: [],
        error: error.message
      };
    }
  }

  /**
   * Validate cron expression
   */
  validateCronExpression(expression) {
    return {
      valid: cron.validate(expression),
      expression
    };
  }

  /**
   * Get next execution times for scheduled scripts
   */
  getNextExecutions() {
    const nextExecutions = [];
    for (const [scriptId, jobData] of this.scheduledJobs.entries()) {
      try {
        // Calculate next execution time
        const task = cron.schedule(jobData.cronExpression, () => {}, { scheduled: false });
        nextExecutions.push({
          scriptId,
          scriptName: jobData.script.name,
          cronExpression: jobData.cronExpression,
          nextExecution: 'Calculation not available', // node-cron doesn't provide next execution directly
          isActive: jobData.job.running
        });
        task.destroy();
      } catch (error) {
        console.error(`Error calculating next execution for ${scriptId}:`, error);
      }
    }
    return nextExecutions;
  }

  /**
   * Stop all scheduled scripts
   */
  stopAllScheduledScripts() {
    let stoppedCount = 0;
    for (const [scriptId, jobData] of this.scheduledJobs.entries()) {
      jobData.job.stop();
      stoppedCount++;
    }
    
    console.log(`🛑 Stopped ${stoppedCount} scheduled scripts`);
    return {
      success: true,
      message: `Stopped ${stoppedCount} scheduled scripts`,
      stoppedCount
    };
  }

  /**
   * Start all scheduled scripts
   */
  startAllScheduledScripts() {
    let startedCount = 0;
    for (const [scriptId, jobData] of this.scheduledJobs.entries()) {
      if (!jobData.job.running) {
        jobData.job.start();
        startedCount++;
      }
    }
    
    console.log(`▶️ Started ${startedCount} scheduled scripts`);
    return {
      success: true,
      message: `Started ${startedCount} scheduled scripts`,
      startedCount
    };
  }

  /**
   * Persist scheduled script to database
   */
  async persistScheduledScript(scriptId, script, cronExpression, payload) {
    try {
      if (!this.db) return;
      
      const collection = this.getScheduledScriptsCollection();
      const doc = {
        _id: scriptId,
        scriptId,
        scriptName: script.name,
        scriptCode: script.code,
        script: script,
        cronExpression,
        payload,
        isRunning: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastExecution: null
      };
      
      await collection.replaceOne(
        { _id: scriptId },
        doc,
        { upsert: true }
      );
      
      console.log(`💾 Persisted scheduled script: ${scriptId}`);
    } catch (error) {
      console.error(`❌ Failed to persist scheduled script ${scriptId}:`, error);
    }
  }

  /**
   * Remove scheduled script from database
   */
  async removeScheduledScriptFromDB(scriptId) {
    try {
      if (!this.db) return;
      
      const collection = this.getScheduledScriptsCollection();
      await collection.deleteOne({ _id: scriptId });
      
      console.log(`🗑️ Removed scheduled script from DB: ${scriptId}`);
    } catch (error) {
      console.error(`❌ Failed to remove scheduled script ${scriptId} from DB:`, error);
    }
  }

  /**
   * Update last execution time for scheduled script
   */
  async updateScheduledScriptExecution(scriptId) {
    try {
      if (!this.db) return;
      
      const collection = this.getScheduledScriptsCollection();
      await collection.updateOne(
        { _id: scriptId },
        { 
          $set: { 
            lastExecution: new Date(),
            updatedAt: new Date()
          }
        }
      );
      
      // Update in-memory data as well
      const jobData = this.scheduledJobs.get(scriptId);
      if (jobData) {
        jobData.lastExecution = new Date().toISOString();
      }
    } catch (error) {
      console.error(`❌ Failed to update execution time for ${scriptId}:`, error);
    }
  }

  /**
   * Restore scheduled scripts from database on startup
   */
  async restoreScheduledScripts() {
    try {
      if (!this.db) {
        console.log('🔄 Database not available, skipping scheduled scripts restoration');
        return;
      }
      
      const collection = this.getScheduledScriptsCollection();
      const scheduledScripts = await collection.find({}).toArray();
      
      console.log(`🔄 Restoring ${scheduledScripts.length} scheduled scripts from database...`);
      
      for (const scriptDoc of scheduledScripts) {
        try {
          // Recreate the cron job with distributed locking
          const job = cron.schedule(scriptDoc.cronExpression, async () => {
            const lockAcquired = await this.distributedLock.acquireLock(scriptDoc.scriptId, 300); // 5 minute lock
            
            if (!lockAcquired) {
              console.log(`🚫 Script "${scriptDoc.scriptName}" already executing on another instance, skipping...`);
              return;
            }
            
            try {
              console.log(`⏰ Executing scheduled script: ${scriptDoc.scriptName} (distributed lock acquired)`);
              this.cronStats.cronExecutions++;
              this.cronStats.lastCronExecution = new Date().toISOString();
              
              // Update last execution time in database
              await this.updateScheduledScriptExecution(scriptDoc.scriptId);
              
              // Execute the script with cron-specific payload
              const cronPayload = {
                ...scriptDoc.payload,
                trigger: 'cron',
                scheduled: true,
                executionTime: new Date().toISOString(),
                cronExpression: scriptDoc.cronExpression,
                distributedExecution: true
              };
              
              const result = await this.executeScript(scriptDoc.script, cronPayload);
              console.log(`✅ Scheduled script "${scriptDoc.scriptName}" executed successfully:`, result);
              
            } catch (error) {
              this.cronStats.failedCronExecutions++;
              console.error(`❌ Scheduled script "${scriptDoc.scriptName}" execution failed:`, error);
            } finally {
              // Always release the lock after execution
              await this.distributedLock.releaseLock(scriptDoc.scriptId);
            }
          }, {
            scheduled: scriptDoc.isRunning // Start based on saved state
          });
          
          // Store the job in memory
          this.scheduledJobs.set(scriptDoc.scriptId, {
            job,
            cronExpression: scriptDoc.cronExpression,
            script: scriptDoc.script,
            payload: scriptDoc.payload,
            createdAt: scriptDoc.createdAt.toISOString(),
            lastExecution: scriptDoc.lastExecution ? scriptDoc.lastExecution.toISOString() : null,
            isRunning: scriptDoc.isRunning
          });
          
          console.log(`✅ Restored scheduled script: ${scriptDoc.scriptName} (${scriptDoc.cronExpression})`);
          
        } catch (error) {
          console.error(`❌ Failed to restore scheduled script ${scriptDoc.scriptName}:`, error);
        }
      }
      
      // Update statistics
      this.cronStats.totalScheduledScripts = this.scheduledJobs.size;
      this.cronStats.activeSchedules = this.scheduledJobs.size;
      
      console.log(`🔄 Successfully restored ${this.scheduledJobs.size} scheduled scripts`);
      
    } catch (error) {
      console.error('❌ Failed to restore scheduled scripts:', error);
    }
  }

  /**
   * Update scheduled script state (pause/resume)
   */
  async updateScheduledScriptState(scriptId, isRunning) {
    try {
      if (!this.db) return;
      
      const collection = this.getScheduledScriptsCollection();
      await collection.updateOne(
        { _id: scriptId },
        { 
          $set: { 
            isRunning,
            updatedAt: new Date()
          }
        }
      );
      
      console.log(`💾 Updated scheduled script state: ${scriptId} -> ${isRunning ? 'running' : 'paused'}`);
    } catch (error) {
      console.error(`❌ Failed to update state for ${scriptId}:`, error);
    }
  }

  /**
   * Manually trigger a scheduled script execution
   */
  async triggerScheduledScript(scriptId) {
    try {
      const jobData = this.scheduledJobs.get(scriptId);
      if (!jobData) {
        return {
          success: false,
          message: `Scheduled script not found: ${scriptId}`
        };
      }

      console.log(`🚀 Manually triggering scheduled script: ${jobData.script.name}`);

      // Execute the script with manual trigger payload
      const manualPayload = {
        ...jobData.payload,
        trigger: 'manual',
        scheduled: true,
        manualTrigger: true,
        executionTime: new Date().toISOString(),
        cronExpression: jobData.cronExpression
      };

      const result = await this.executeScript(jobData.script, manualPayload);

      // Update last execution time in database
      await this.updateScheduledScriptExecution(scriptId);

      console.log(`✅ Manually triggered script "${jobData.script.name}" executed successfully:`, result);

      return {
        success: true,
        message: `Script "${jobData.script.name}" triggered successfully`,
        result: result,
        scriptName: jobData.script.name,
        executionTime: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed to manually trigger script ${scriptId}:`, error);
      return {
        success: false,
        message: `Failed to trigger script: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = ScriptExecutionService;
