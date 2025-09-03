const vm = require('vm');
const https = require('https');
const http = require('http');
const { URL } = require('url');

class ScriptExecutionService {
  constructor() {
    // Rate limiting: Map of script IDs to their last execution times and counts
    this.rateLimitMap = new Map();
    
    // Execution queue for failed scripts
    this.executionQueue = [];
    
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
            resolve({ success: true, result });
          } catch (error) {
            clearTimeout(timeoutId);
            reject({ success: false, error: error.message, stack: error.stack });
          }
        };

        executeAsync();
      } catch (error) {
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
    const totalScripts = this.rateLimitMap.size;
    let totalExecutions = 0;
    let activeScripts = 0;
    
    const now = Date.now();
    for (const [scriptId, data] of this.rateLimitMap.entries()) {
      // Count executions in the last minute
      const recentExecutions = data.executions.filter(
        timestamp => now - timestamp < this.rateLimit.windowMs
      );
      totalExecutions += recentExecutions.length;
      if (recentExecutions.length > 0) {
        activeScripts++;
      }
    }
    
    return {
      totalScripts,
      activeScripts,
      totalExecutions,
      queuedRetries: this.executionQueue.length,
      rateLimit: this.rateLimit
    };
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
}

module.exports = ScriptExecutionService;
