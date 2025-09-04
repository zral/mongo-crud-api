const express = require('express');
const config = require('../config');
const ScriptExecutionService = require('../services/scriptExecution');

const router = express.Router();
const { ObjectId } = require('mongodb');
const dbService = require('../services/database');

// Get all scripts
router.get('/', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const scripts = await dbService.getAllScripts();
    res.json({
      success: true,
      data: { scripts },
      count: scripts.length
    });
  } catch (error) {
    console.error('Error fetching scripts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Create a new script
router.post('/', async (req, res) => {
  try {
    const { name, code, collection, events, filters, enabled = true, rateLimit, description } = req.body;

    // Validate required fields
    if (!name || !code || !collection || !events) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name, code, collection, and events are required'
      });
    }

    // Validate events array (only database events for event scripts)
    const validEvents = ['create', 'update', 'delete'];
    const invalidEvents = events.filter(event => !validEvents.includes(event));
    if (invalidEvents.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid events: ${invalidEvents.join(', ')}. Valid events are: ${validEvents.join(', ')}`
      });
    }

    // Validate JavaScript code (basic syntax check)
    try {
      new Function(code);
    } catch (syntaxError) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid JavaScript code: ${syntaxError.message}`
      });
    }

    // Validate and set rate limit settings
    const defaultRateLimit = {
      maxExecutionsPerMinute: 60,
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    };

    let scriptRateLimit = defaultRateLimit;
    if (rateLimit) {
      scriptRateLimit = {
        maxExecutionsPerMinute: Math.min(Math.max(rateLimit.maxExecutionsPerMinute || 60, 1), 300), // 1-300 executions per minute
        maxRetries: Math.min(Math.max(rateLimit.maxRetries || 3, 0), 10), // 0-10 retries
        baseDelayMs: Math.min(Math.max(rateLimit.baseDelayMs || 1000, 100), 10000), // 100ms-10s base delay
        maxDelayMs: Math.min(Math.max(rateLimit.maxDelayMs || 30000, 1000), 300000) // 1s-5min max delay
      };
    }

    const script = {
      name,
      code,
      description: description || '',
      collection,
      events,
      filters: filters || {},
      enabled,
      rateLimit: scriptRateLimit,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await dbService.createScript(script);
    
    res.status(201).json({
      success: true,
      message: 'Script created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get script statistics
router.get('/stats', (req, res) => {
  try {
    const stats = dbService.scriptExecution.getStatistics();
    
    res.json({
      success: true,
      data: {
        executionStats: stats,
        rateLimit: {
          maxExecutionsPerMinute: dbService.scriptExecution.rateLimit.maxExecutionsPerMinute,
          windowMs: dbService.scriptExecution.rateLimit.windowMs,
          maxRetries: dbService.scriptExecution.rateLimit.maxRetries,
          baseDelayMs: dbService.scriptExecution.rateLimit.baseDelayMs,
          maxDelayMs: dbService.scriptExecution.rateLimit.maxDelayMs
        }
      }
    });
  } catch (error) {
    console.error('Error getting script statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get a specific script by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid script ID format'
      });
    }

    const script = await dbService.getScriptById(id);
    
    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Script not found'
      });
    }

    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    console.error('Error fetching script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Update a script
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, collection, events, filters, enabled, rateLimit, description } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid script ID format'
      });
    }

    // Validate JavaScript code if provided
    if (code) {
      try {
        new Function(code);
      } catch (syntaxError) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Invalid JavaScript code: ${syntaxError.message}`
        });
      }
    }

    // Validate events if provided
    if (events) {
      const validEvents = ['create', 'update', 'delete'];
      const invalidEvents = events.filter(event => !validEvents.includes(event));
      if (invalidEvents.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Invalid events: ${invalidEvents.join(', ')}. Valid events are: ${validEvents.join(', ')}`
        });
      }
    }

    const updateData = {
      ...(name && { name }),
      ...(code && { code }),
      ...(description !== undefined && { description }),
      ...(collection && { collection }),
      ...(events && { events }),
      ...(filters !== undefined && { filters }),
      ...(enabled !== undefined && { enabled }),
      ...(rateLimit && { rateLimit }),
      updatedAt: new Date()
    };

    const result = await dbService.updateScript(id, updateData);
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Script not found'
      });
    }

    res.json({
      success: true,
      message: 'Script updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Delete a script
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid script ID format'
      });
    }

    const result = await dbService.deleteScript(id);
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Script not found'
      });
    }

    // Clear rate limiting data for this script
    dbService.scriptExecution.clearRateLimit(id);

    res.json({
      success: true,
      message: 'Script deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Test a script execution
router.post('/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const { testPayload } = req.body;
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid script ID format'
      });
    }

    const script = await dbService.getScriptById(id);
    
    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Script not found'
      });
    }

    // Create test payload with comprehensive context
    const payload = testPayload || {
      event: 'test',
      script: {
        id: script._id,
        name: script.name
      },
      collection: script.collection,
      timestamp: new Date().toISOString(),
      data: {
        document: { 
          _id: '507f1f77bcf86cd799439011',
          name: 'Test Document',
          email: 'test@example.com',
          createdAt: new Date().toISOString(),
          test: true,
          message: 'This is a test execution' 
        },
        previous: script.events.includes('update') ? { 
          _id: '507f1f77bcf86cd799439011',
          name: 'Previous Document',
          email: 'old@example.com',
          updatedAt: new Date(Date.now() - 60000).toISOString()
        } : null
      },
      user: {
        id: 'test-user',
        role: 'admin'
      },
      request: {
        method: 'POST',
        url: `/api/db/${script.collection}`,
        headers: {
          'content-type': 'application/json',
          'user-agent': 'test-client/1.0'
        }
      }
    };

    console.log(`Testing script: ${script.name}`);
    
    // Execute the script (bypass rate limiting for tests)
    const originalRateLimit = script.rateLimit;
    script.rateLimit = { maxExecutionsPerMinute: 1000, maxRetries: 0 };
    
    const result = await dbService.scriptExecution.executeScript(script, payload);
    
    // Restore original rate limit
    script.rateLimit = originalRateLimit;

    res.json({
      success: true,
      message: 'Script test executed',
      data: {
        script: {
          id: script._id,
          name: script.name
        },
        payload,
        result
      }
    });
  } catch (error) {
    console.error('Error testing script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Clear rate limits for all scripts
router.post('/admin/clear-rate-limits', (req, res) => {
  try {
    dbService.scriptExecution.clearAllRateLimits();
    
    res.json({
      success: true,
      message: 'All script rate limits cleared'
    });
  } catch (error) {
    console.error('Error clearing rate limits:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Create new cron schedule (frontend API)
router.post('/schedule', async (req, res) => {
  try {
    const { name, cronExpression, scriptCode } = req.body;

    if (!name || !cronExpression || !scriptCode) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Name, cron expression, and script code are required'
      });
    }

    // Validate cron expression
    const validation = dbService.scriptExecution.validateCronExpression(cronExpression);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid cron expression'
      });
    }

    // Create a script object for the schedule
    const scriptObj = {
      name: name,
      code: scriptCode
    };

    const result = await dbService.scriptExecution.scheduleScript(scriptObj, cronExpression);

    res.json({
      success: true,
      data: {
        name,
        cronExpression,
        scriptCode,
        scheduled: true,
        nextExecution: result.nextExecution
      }
    });

  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Update cron schedule (frontend API)
router.put('/schedule/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { cronExpression, scriptCode } = req.body;

    if (!cronExpression || !scriptCode) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cron expression and script code are required'
      });
    }

    // Validate cron expression
    const validation = dbService.scriptExecution.validateCronExpression(cronExpression);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid cron expression'
      });
    }

    // First unschedule the existing job
    await dbService.scriptExecution.unscheduleScript(name);
    
    // Then create a new schedule with updated script code
    const scriptObj = {
      name: name,
      code: scriptCode
    };

    const result = await dbService.scriptExecution.scheduleScript(scriptObj, cronExpression);

    res.json({
      success: true,
      data: {
        name,
        cronExpression,
        scriptCode,
        updated: true,
        nextExecution: result.nextExecution
      }
    });

  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Delete cron schedule (frontend API)
router.delete('/schedule/:name', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await dbService.scriptExecution.unscheduleScript(name);

    res.json({
      success: true,
      data: {
        name,
        unscheduled: true
      }
    });

  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Pause cron schedule (frontend API)
router.post('/schedule/:name/pause', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await dbService.scriptExecution.pauseScheduledScript(name);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: result.message
      });
    }

    res.json({
      success: true,
      data: {
        name,
        status: result.status,
        message: result.message
      }
    });

  } catch (error) {
    console.error('Error pausing schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Resume cron schedule (frontend API)
router.post('/schedule/:name/resume', async (req, res) => {
  try {
    const { name } = req.params;

    const result = await dbService.scriptExecution.resumeScheduledScript(name);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: result.message
      });
    }

    res.json({
      success: true,
      data: {
        name,
        status: result.status,
        message: result.message
      }
    });

  } catch (error) {
    console.error('Error resuming schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Schedule a script with cron expression
router.post('/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { cronExpression, payload = {} } = req.body;

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cron expression is required'
      });
    }

    // Validate cron expression
    const validation = dbService.scriptExecution.validateCronExpression(cronExpression);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `Invalid cron expression: ${cronExpression}`
      });
    }

    // Get the script
    const script = await dbService.getScriptById(id);
    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'Script not found'
      });
    }

    // Schedule the script
    const result = await dbService.scriptExecution.scheduleScript(script, cronExpression, payload);

    res.json({
      success: true,
      message: result.message,
      data: {
        scriptId: result.scriptId,
        scriptName: script.name,
        cronExpression: result.cronExpression,
        scheduledAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error scheduling script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Unschedule a script
router.delete('/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbService.scriptExecution.unscheduleScript(id);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          scriptId: id,
          unscheduledAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error unscheduling script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get all scheduled scripts
router.get('/scheduled/list', async (req, res) => {
  try {
    const dbService = req.app.locals.dbService;
    const scheduledScripts = dbService.scriptExecution.getScheduledScripts();
    const cronStats = dbService.scriptExecution.getCronStatistics();

    res.json({
      success: true,
      data: {
        scheduledScripts,
        statistics: cronStats,
        count: scheduledScripts.length
      }
    });

  } catch (error) {
    console.error('Error getting scheduled scripts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Update scheduled script payload
router.put('/:id/schedule/payload', async (req, res) => {
  try {
    const { id } = req.params;
    const { payload } = req.body;

    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Valid payload object is required'
      });
    }

    const result = dbService.scriptExecution.updateScheduledScriptPayload(id, payload);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          scriptId: id,
          updatedAt: new Date().toISOString()
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error updating scheduled script payload:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Reschedule a script with new cron expression
router.put('/:id/schedule', async (req, res) => {
  try {
    const { id } = req.params;
    const { cronExpression } = req.body;

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'New cron expression is required'
      });
    }

    const result = dbService.scriptExecution.rescheduleScript(id, cronExpression);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          scriptId: id,
          previousCron: result.previousCron,
          newCron: result.newCron,
          rescheduledAt: new Date().toISOString()
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: result.message
      });
    }

  } catch (error) {
    console.error('Error rescheduling script:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Validate cron expression (GET with URL parameter)
router.get('/cron/validate/:expression', (req, res) => {
  try {
    const cronExpression = decodeURIComponent(req.params.expression);

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cron expression is required'
      });
    }

    const validation = dbService.scriptExecution.validateCronExpression(cronExpression);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        expression: validation.expression,
        examples: {
          'Every minute': '* * * * *',
          'Every hour': '0 * * * *',
          'Every day at midnight': '0 0 * * *',
          'Every Monday at 9 AM': '0 9 * * 1',
          'Every 15 minutes': '*/15 * * * *',
          'Twice a day (9 AM and 6 PM)': '0 9,18 * * *'
        }
      }
    });

  } catch (error) {
    console.error('Error validating cron expression:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Validate cron expression (POST with body)
router.post('/cron/validate', (req, res) => {
  try {
    const { cronExpression } = req.body;

    if (!cronExpression) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Cron expression is required'
      });
    }

    const validation = dbService.scriptExecution.validateCronExpression(cronExpression);

    res.json({
      success: true,
      data: {
        valid: validation.valid,
        expression: validation.expression,
        examples: {
          'Every minute': '* * * * *',
          'Every hour': '0 * * * *',
          'Every day at midnight': '0 0 * * *',
          'Every Monday at 9 AM': '0 9 * * 1',
          'Every 15 minutes': '*/15 * * * *',
          'Twice a day (9 AM and 6 PM)': '0 9,18 * * *'
        }
      }
    });

  } catch (error) {
    console.error('Error validating cron expression:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Get next execution times for scheduled scripts
router.get('/scheduled/next-executions', async (req, res) => {
  try {
    const nextExecutions = dbService.scriptExecution.getNextExecutions();

    res.json({
      success: true,
      data: {
        nextExecutions,
        count: nextExecutions.length
      }
    });

  } catch (error) {
    console.error('Error getting next executions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Stop all scheduled scripts
router.post('/scheduled/stop-all', async (req, res) => {
  try {
    const result = dbService.scriptExecution.stopAllScheduledScripts();

    res.json({
      success: true,
      message: result.message,
      data: {
        stoppedCount: result.stoppedCount,
        stoppedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error stopping all scheduled scripts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

// Start all scheduled scripts
router.post('/scheduled/start-all', async (req, res) => {
  try {
    const result = dbService.scriptExecution.startAllScheduledScripts();

    res.json({
      success: true,
      message: result.message,
      data: {
        startedCount: result.startedCount,
        startedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error starting all scheduled scripts:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: error.message
    });
  }
});

module.exports = router;
