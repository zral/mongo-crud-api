import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ScriptInterface = () => {
  const [scripts, setScripts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedScript, setSelectedScript] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scriptStats, setScriptStats] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    collection: '',
    events: [],
    filters: '{}',
    code: '',
    enabled: true,
    rateLimit: {
      maxExecutionsPerMinute: 60,
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    },
    cronSchedule: {
      enabled: false,
      expression: '',
      payload: '{}'
    }
  });

  useEffect(() => {
    loadScripts();
    loadCollections();
    loadScriptStats();
  }, []);

  const loadScripts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/scripts');
      setScripts(response.data.data?.scripts || []);
    } catch (err) {
      setError(`Failed to load scripts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const response = await api.get('/api/management/collections');
      setCollections(response.data.collections || []);
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  };

  const loadScriptStats = async () => {
    try {
      const response = await api.get('/api/scripts/stats');
      setScriptStats(response.data);
    } catch (err) {
      console.error('Failed to load script statistics:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.startsWith('rateLimit.')) {
      const rateLimitField = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        rateLimit: {
          ...prev.rateLimit,
          [rateLimitField]: type === 'number' ? parseInt(value) : value
        }
      }));
    } else if (name === 'events') {
      const eventsArray = value.split(',').map(e => e.trim()).filter(e => e);
      setFormData(prev => ({ ...prev, events: eventsArray }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      collection: '',
      events: [],
      filters: '{}',
      code: '',
      enabled: true,
      rateLimit: {
        maxExecutionsPerMinute: 60,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000
      },
      cronSchedule: {
        enabled: false,
        expression: '',
        payload: '{}'
      }
    });
    setSelectedScript(null);
    setIsModalOpen(false);
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setLoading(true);
      
      // Validate filters JSON
      let filters = {};
      if (formData.filters.trim()) {
        try {
          filters = JSON.parse(formData.filters);
        } catch (err) {
          setError('Invalid JSON in filters field');
          return;
        }
      }

      // Parse cron payload if provided
      let cronPayload = {};
      if (formData.cronSchedule.enabled && formData.cronSchedule.payload.trim()) {
        try {
          cronPayload = JSON.parse(formData.cronSchedule.payload);
        } catch (err) {
          setError('Invalid JSON in cron payload field');
          return;
        }
      }

      const events = Array.isArray(formData.events) ? formData.events : formData.events.split(',').map(e => e.trim()).filter(e => e);
      
      // Add 'cron' to events if cron scheduling is enabled
      if (formData.cronSchedule.enabled && !events.includes('cron')) {
        events.push('cron');
      }

      const scriptData = {
        ...formData,
        filters,
        events,
        cronSchedule: formData.cronSchedule.enabled ? {
          expression: formData.cronSchedule.expression,
          payload: cronPayload
        } : null
      };

      if (selectedScript) {
        await api.put(`/api/scripts/${selectedScript._id}`, scriptData);
        setSuccess('Script updated successfully!');
      } else {
        await api.post('/api/scripts', scriptData);
        setSuccess('Script created successfully!');
      }

      await loadScripts();
      resetForm();
    } catch (err) {
      setError(`Failed to save script: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (script) => {
    setSelectedScript(script);
    setFormData({
      name: script.name || '',
      description: script.description || '',
      collection: script.collection || '',
      events: script.events || [],
      filters: JSON.stringify(script.filters || {}, null, 2),
      code: script.code || '',
      enabled: script.enabled !== false,
      rateLimit: script.rateLimit || {
        maxExecutionsPerMinute: 60,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000
      }
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (scriptId) => {
    if (!window.confirm('Are you sure you want to delete this script?')) return;

    try {
      setLoading(true);
      await api.delete(`/api/scripts/${scriptId}`);
      setSuccess('Script deleted successfully!');
      await loadScripts();
    } catch (err) {
      setError(`Failed to delete script: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testScript = async (script) => {
    try {
      setLoading(true);
      const testPayload = {
        event: 'create',
        collection: script.collection || 'test_collection',
        data: {
          document: { _id: 'test_id', name: 'Test Document', createdAt: new Date() }
        }
      };

      const response = await api.post(`/api/scripts/${script._id}/test`, { testPayload });
      alert(`Test Result:\n${JSON.stringify(response.data, null, 2)}`);
    } catch (err) {
      alert(`Test Failed:\n${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearRateLimits = async () => {
    try {
      setLoading(true);
      await api.post('/api/scripts/clear-rate-limits');
      setSuccess('Rate limits cleared successfully!');
      await loadScriptStats();
    } catch (err) {
      setError(`Failed to clear rate limits: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const defaultScriptCode = `// Script execution context provides:
// - payload: The event payload with document data
// - api: Methods to interact with collections API (get, post, put, delete)
// - utils: Utility functions (log, error, now, timestamp)

// Example: Log the event
utils.log('Processing event:', payload.event, 'for collection:', payload.collection);

// Example: Get data from another collection
try {
  const otherData = await api.get('/api/othercollection');
  utils.log('Other data:', otherData);
} catch (error) {
  utils.error('Failed to fetch other data:', error.message);
}

// Example: Create a new document in response to this event
if (payload.event === 'create') {
  const newDoc = {
    originalId: payload.data.document._id,
    processedAt: utils.timestamp(),
    status: 'processed'
  };
  
  try {
    const result = await api.post('/api/processed_documents', newDoc);
    utils.log('Created processed document:', result);
    return { success: true, processedId: result.data._id };
  } catch (error) {
    utils.error('Failed to create processed document:', error.message);
    return { success: false, error: error.message };
  }
}

// Return value (optional)
return { message: 'Script executed successfully', timestamp: utils.now() };`;

  return (
    <div className="script-interface" style={{ padding: '20px' }}>
      <div className="script-header" style={{ marginBottom: '20px' }}>
        <h2>JavaScript Snippets Management</h2>
        <div className="script-actions" style={{ marginTop: '10px' }}>
          <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              marginRight: '10px'
            }}
            disabled={loading}
          >
            Create New Script
          </button>
          <button 
            onClick={clearRateLimits}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#ffc107', 
              color: '#212529', 
              border: 'none', 
              borderRadius: '4px'
            }}
            disabled={loading}
          >
            Clear Rate Limits
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: '#dc3545', backgroundColor: '#f8d7da', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{ color: '#155724', backgroundColor: '#d4edda', padding: '10px', borderRadius: '4px', marginBottom: '20px' }}>
          {success}
        </div>
      )}

      {/* Enhanced Statistics Section */}
      {scriptStats && (
        <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, color: '#495057' }}>📊 Script Execution Statistics</h3>
            <button
              onClick={loadScriptStats}
              style={{
                padding: '6px 12px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              🔄 Refresh
            </button>
          </div>
          
          {/* Main Statistics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '12px', backgroundColor: '#e3f2fd', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1565c0' }}>
                {scriptStats.data?.executionStats?.totalExecutions?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Total Executions</div>
            </div>
            
            <div style={{ padding: '12px', backgroundColor: '#e8f5e8', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2e7d32' }}>
                {scriptStats.data?.executionStats?.successfulExecutions?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Successful</div>
            </div>
            
            <div style={{ padding: '12px', backgroundColor: '#ffebee', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#c62828' }}>
                {scriptStats.data?.executionStats?.failedExecutions?.toLocaleString() || 0}
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Failed</div>
            </div>
            
            <div style={{ padding: '12px', backgroundColor: '#fff3e0', borderRadius: '6px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef6c00' }}>
                {scriptStats.data?.executionStats?.successRate || 0}%
              </div>
              <div style={{ fontSize: '12px', color: '#666' }}>Success Rate</div>
            </div>
          </div>
          
          {/* Time-based Statistics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>Today:</strong> {scriptStats.data?.executionStats?.executionsToday?.toLocaleString() || 0}
            </div>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>This Week:</strong> {scriptStats.data?.executionStats?.executionsThisWeek?.toLocaleString() || 0}
            </div>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>This Month:</strong> {scriptStats.data?.executionStats?.executionsThisMonth?.toLocaleString() || 0}
            </div>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>Avg Time:</strong> {scriptStats.data?.executionStats?.averageExecutionTime || 0}ms
            </div>
          </div>
          
          {/* Performance Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>Active Scripts:</strong> {scriptStats.data?.executionStats?.activeScripts || 0} / {scriptStats.data?.executionStats?.totalScripts || 0}
            </div>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>Peak Executions/min:</strong> {scriptStats.data?.executionStats?.peakExecutionsPerMinute || 0}
            </div>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>Recent Executions:</strong> {scriptStats.data?.executionStats?.recentExecutions || 0}
            </div>
            <div style={{ padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <strong>Queued Retries:</strong> {scriptStats.data?.executionStats?.queuedRetries || 0}
            </div>
          </div>
          
          {/* Top Scripts */}
          {scriptStats.data?.executionStats?.topScripts && scriptStats.data.executionStats.topScripts.length > 0 && (
            <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#495057' }}>🏆 Top Executed Scripts</h4>
              <div style={{ display: 'grid', gap: '8px' }}>
                {scriptStats.data.executionStats.topScripts.map((script, index) => (
                  <div key={script.scriptId} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    padding: '8px 12px', 
                    backgroundColor: index === 0 ? '#fff3cd' : '#f8f9fa',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}>
                    <span>{script.scriptId}</span>
                    <span style={{ fontWeight: 'bold', color: '#007bff' }}>{script.executions.toLocaleString()} executions</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Last Execution Info */}
          {scriptStats.data?.executionStats?.lastExecution && (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #e9ecef', fontSize: '14px', color: '#666' }}>
              <strong>Last Execution:</strong> {new Date(scriptStats.data.executionStats.lastExecution).toLocaleString()}
            </div>
          )}

          {/* Cron Scheduling Statistics */}
          {scriptStats.data?.executionStats?.cronStats && (
            <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0f8ff', borderRadius: '4px', border: '1px solid #b8daff' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#495057' }}>⏰ Cron Scheduling Statistics</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '15px' }}>
                <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0056b3' }}>
                    {scriptStats.data.executionStats.cronStats.activeSchedules || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Active Schedules</div>
                </div>
                
                <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                    {scriptStats.data.executionStats.cronStats.cronExecutions?.toLocaleString() || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Cron Executions</div>
                </div>
                
                <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>
                    {scriptStats.data.executionStats.cronStats.failedCronExecutions || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Failed Cron</div>
                </div>
                
                <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6c757d' }}>
                    {scriptStats.data.executionStats.cronStats.totalScheduledScripts || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Total Scheduled</div>
                </div>
              </div>

              {/* Scheduled Scripts List */}
              {scriptStats.data.executionStats.cronStats.scheduledScripts && scriptStats.data.executionStats.cronStats.scheduledScripts.length > 0 && (
                <div style={{ marginTop: '10px' }}>
                  <h5 style={{ margin: '0 0 8px 0', color: '#495057', fontSize: '13px' }}>📅 Currently Scheduled Scripts:</h5>
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {scriptStats.data.executionStats.cronStats.scheduledScripts.map((scheduled, index) => (
                      <div key={index} style={{ 
                        padding: '6px 10px', 
                        backgroundColor: 'white', 
                        borderRadius: '3px',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontWeight: '500' }}>{scheduled.scriptName}</span>
                        <span style={{ fontFamily: 'monospace', color: '#0056b3' }}>{scheduled.cronExpression}</span>
                        <span style={{ 
                          padding: '2px 6px', 
                          borderRadius: '10px', 
                          fontSize: '10px',
                          backgroundColor: scheduled.isRunning ? '#d4edda' : '#f8d7da',
                          color: scheduled.isRunning ? '#155724' : '#721c24'
                        }}>
                          {scheduled.isRunning ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {scriptStats.data?.executionStats?.cronStats?.lastCronExecution && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                  <strong>Last Cron Execution:</strong> {new Date(scriptStats.data.executionStats.cronStats.lastCronExecution).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scripts List */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Existing Scripts ({scripts.length})</h3>
        {scripts.length === 0 ? (
          <p style={{ color: '#6c757d' }}>No scripts found. Create your first script to get started!</p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {scripts.map(script => (
              <div key={script._id} style={{ 
                border: '1px solid #dee2e6', 
                borderRadius: '4px', 
                padding: '15px',
                backgroundColor: script.enabled ? '#ffffff' : '#f8f9fa'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0', color: script.enabled ? '#000' : '#6c757d' }}>
                      {script.name}
                      {!script.enabled && <span style={{ color: '#dc3545', marginLeft: '10px' }}>(Disabled)</span>}
                    </h4>
                    <p style={{ margin: '0 0 10px 0', color: '#6c757d' }}>{script.description}</p>
                    <div style={{ fontSize: '14px', color: '#6c757d' }}>
                      <span><strong>Collection:</strong> {script.collection || 'All'}</span>
                      <span style={{ marginLeft: '20px' }}><strong>Events:</strong> {script.events?.join(', ') || 'None'}</span>
                    </div>
                    {script.rateLimit && (
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#495057', 
                        marginTop: '8px',
                        padding: '6px 8px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '3px',
                        border: '1px solid #dee2e6'
                      }}>
                        <strong>⚡ Rate Limit:</strong> {script.rateLimit.maxExecutionsPerMinute}/min
                        <span style={{ marginLeft: '12px' }}><strong>Retries:</strong> {script.rateLimit.maxRetries}</span>
                        <span style={{ marginLeft: '12px' }}><strong>Delay:</strong> {script.rateLimit.baseDelayMs}ms - {script.rateLimit.maxDelayMs}ms</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleEdit(script)}
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#17a2b8', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => testScript(script)}
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#28a745', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      Test
                    </button>
                    <button
                      onClick={() => handleDelete(script._id)}
                      style={{ 
                        padding: '5px 10px', 
                        backgroundColor: '#dc3545', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Create/Edit Script */}
      {isModalOpen && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '8px', 
            width: '90%', 
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3>{selectedScript ? 'Edit Script' : 'Create New Script'}</h3>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Name:</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Description:</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="2"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Collection:</label>
                <select
                  name="collection"
                  value={formData.collection}
                  onChange={handleInputChange}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px'
                  }}
                >
                  <option value="">All Collections</option>
                  {collections.map(col => (
                    <option key={col.name} value={col.name}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Events (comma-separated):</label>
                <input
                  type="text"
                  name="events"
                  value={Array.isArray(formData.events) ? formData.events.join(', ') : formData.events}
                  onChange={handleInputChange}
                  placeholder="create, update, delete"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Filters (JSON):
                </label>
                <textarea
                  name="filters"
                  value={formData.filters}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder='{"field": "value"}'
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>JavaScript Code:</label>
                <textarea
                  name="code"
                  value={formData.code}
                  onChange={handleInputChange}
                  required
                  rows="15"
                  placeholder={defaultScriptCode}
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    name="enabled"
                    checked={formData.enabled}
                    onChange={handleInputChange}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={{ fontWeight: 'bold' }}>Enabled</span>
                </label>
              </div>

              {/* Rate Limiting Configuration */}
              <div style={{ 
                marginBottom: '15px', 
                padding: '15px', 
                border: '1px solid #e0e0e0', 
                borderRadius: '6px',
                backgroundColor: '#f8f9fa'
              }}>
                <h4 style={{ marginBottom: '10px', color: '#495057' }}>⚡ Rate Limiting Configuration</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                      Max Executions/Minute:
                    </label>
                    <input
                      type="number"
                      name="rateLimit.maxExecutionsPerMinute"
                      value={formData.rateLimit.maxExecutionsPerMinute}
                      onChange={handleInputChange}
                      min="1"
                      max="1000"
                      style={{ 
                        width: '100%', 
                        padding: '6px', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                      Max Retries:
                    </label>
                    <input
                      type="number"
                      name="rateLimit.maxRetries"
                      value={formData.rateLimit.maxRetries}
                      onChange={handleInputChange}
                      min="0"
                      max="10"
                      style={{ 
                        width: '100%', 
                        padding: '6px', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                      Base Delay (ms):
                    </label>
                    <input
                      type="number"
                      name="rateLimit.baseDelayMs"
                      value={formData.rateLimit.baseDelayMs}
                      onChange={handleInputChange}
                      min="100"
                      max="10000"
                      step="100"
                      style={{ 
                        width: '100%', 
                        padding: '6px', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                      Max Delay (ms):
                    </label>
                    <input
                      type="number"
                      name="rateLimit.maxDelayMs"
                      value={formData.rateLimit.maxDelayMs}
                      onChange={handleInputChange}
                      min="1000"
                      max="60000"
                      step="1000"
                      style={{ 
                        width: '100%', 
                        padding: '6px', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
                  <strong>Rate Limiting:</strong> Controls script execution frequency and retry behavior. 
                  Higher values allow more frequent execution but may impact performance.
                </div>
              </div>

              {/* Cron Scheduling Configuration */}
              <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f1f8ff', borderRadius: '6px', border: '1px solid #b8daff' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                  <input
                    type="checkbox"
                    id="cronEnabled"
                    checked={formData.cronSchedule.enabled}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      cronSchedule: {
                        ...prev.cronSchedule,
                        enabled: e.target.checked
                      }
                    }))}
                    style={{ marginRight: '8px' }}
                  />
                  <label htmlFor="cronEnabled" style={{ fontWeight: 'bold', color: '#495057', fontSize: '14px' }}>
                    ⏰ Enable Cron Scheduling
                  </label>
                </div>

                {formData.cronSchedule.enabled && (
                  <>
                    <div style={{ marginBottom: '15px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                        Cron Expression:
                      </label>
                      <input
                        type="text"
                        value={formData.cronSchedule.expression}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cronSchedule: {
                            ...prev.cronSchedule,
                            expression: e.target.value
                          }
                        }))}
                        placeholder="* * * * * (every minute)"
                        style={{ 
                          width: '100%', 
                          padding: '8px', 
                          border: '1px solid #ccc', 
                          borderRadius: '4px',
                          fontFamily: 'monospace'
                        }}
                      />
                      <div style={{ marginTop: '5px', fontSize: '11px', color: '#6c757d' }}>
                        Examples: "0 9 * * *" (daily at 9 AM), "*/15 * * * *" (every 15 minutes), "0 0 * * 1" (every Monday at midnight)
                      </div>
                    </div>

                    <div style={{ marginBottom: '10px' }}>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '13px' }}>
                        Cron Payload (JSON):
                      </label>
                      <textarea
                        value={formData.cronSchedule.payload}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          cronSchedule: {
                            ...prev.cronSchedule,
                            payload: e.target.value
                          }
                        }))}
                        placeholder='{"scheduledTask": true, "type": "maintenance"}'
                        rows="3"
                        style={{ 
                          width: '100%', 
                          padding: '8px', 
                          border: '1px solid #ccc', 
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontSize: '12px'
                        }}
                      />
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
                      <strong>Cron Scheduling:</strong> Automatically executes the script based on the cron expression. 
                      The payload will be merged with the script context during scheduled execution.
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={resetForm}
                  style={{ 
                    padding: '10px 20px', 
                    backgroundColor: '#6c757d', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  style={{ 
                    padding: '10px 20px', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px'
                  }}
                >
                  {loading ? 'Saving...' : (selectedScript ? 'Update Script' : 'Create Script')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScriptInterface;
