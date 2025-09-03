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

      const scriptData = {
        ...formData,
        filters,
        events: Array.isArray(formData.events) ? formData.events : formData.events.split(',').map(e => e.trim()).filter(e => e)
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
  const otherData = await api.get('/api/db/othercollection');
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
    const result = await api.post('/api/db/processed_documents', newDoc);
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
            onClick={loadScriptStats}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: '#6c757d', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              marginRight: '10px'
            }}
            disabled={loading}
          >
            Refresh Stats
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

      {/* Statistics Section */}
      {scriptStats && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h3>Script Statistics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
            <div>
              <strong>Total Scripts:</strong> {scriptStats.data?.executionStats?.totalScripts || 0}
            </div>
            <div>
              <strong>Active Scripts:</strong> {scriptStats.data?.executionStats?.activeScripts || 0}
            </div>
            <div>
              <strong>Total Executions:</strong> {scriptStats.data?.executionStats?.totalExecutions || 0}
            </div>
            <div>
              <strong>Queued Retries:</strong> {scriptStats.data?.executionStats?.queuedRetries || 0}
            </div>
          </div>
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
