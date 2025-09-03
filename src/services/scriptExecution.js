const vm = require('vm');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const cron = require('node-cron');

class ScriptExecutionService {
  constructor() {
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
    
    // Script execution timeout
    this.executionTimeout = 30000; // 30 seconds max execution time
    
    // Start processing retry queue
    this.startRetryProcessor();
    
    // Reset daily stats if needed
    this.checkDailyReset();
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
  createApiContext(payload, baseUrl = 'http://localhost:3000') {
    const self = this;
    return {
      // Payload data
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
  async executeScript(script, payload, apiBaseUrl = 'http://localhost:3000') {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      try {
        // Create a sandbox context with limited access
        const sandbox = this.createApiContext(payload, apiBaseUrl);
        
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
  scheduleScript(script, cronExpression, payload = {}) {
    const scriptId = script._id ? script._id.toString() : script.name;
    
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    
    // Stop existing schedule if any
    this.unscheduleScript(scriptId);
    
    console.log(`📅 Scheduling script "${script.name}" with cron: ${cronExpression}`);
    
    // Create and start the cron job
    const job = cron.schedule(cronExpression, async () => {
      try {
        console.log(`⏰ Executing scheduled script: ${script.name}`);
        this.cronStats.cronExecutions++;
        this.cronStats.lastCronExecution = new Date().toISOString();
        
        // Execute the script with cron-specific payload
        const cronPayload = {
          ...payload,
          trigger: 'cron',
          scheduled: true,
          executionTime: new Date().toISOString(),
          cronExpression: cronExpression
        };
        
        const result = await this.executeScript(script, cronPayload);
        console.log(`✅ Scheduled script "${script.name}" executed successfully:`, result);
        
      } catch (error) {
        this.cronStats.failedCronExecutions++;
        console.error(`❌ Scheduled script "${script.name}" execution failed:`, error);
      }
    }, {
      scheduled: false // Don't start immediately
    });
    
    // Store the job
    this.scheduledJobs.set(scriptId, {
      job,
      cronExpression,
      script,
      payload,
      createdAt: new Date().toISOString(),
      lastExecution: null
    });
    
    // Start the job
    job.start();
    
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
  unscheduleScript(scriptId) {
    const scheduledJob = this.scheduledJobs.get(scriptId);
    if (scheduledJob) {
      scheduledJob.job.stop();
      scheduledJob.job.destroy();
      this.scheduledJobs.delete(scriptId);
      this.cronStats.activeSchedules = this.scheduledJobs.size;
      
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
      scheduled.push({
        scriptId,
        scriptName: jobData.script.name,
        cronExpression: jobData.cronExpression,
        createdAt: jobData.createdAt,
        lastExecution: jobData.lastExecution,
        isRunning: jobData.job.running
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
   * Get cron scheduling statistics
   */
  getCronStatistics() {
    return {
      ...this.cronStats,
      activeSchedules: this.scheduledJobs.size,
      scheduledScripts: this.getScheduledScripts()
    };
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
}

module.exports = ScriptExecutionService;
