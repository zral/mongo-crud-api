import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Plus, Trash2, Play, Edit, Pause, RotateCcw, Calendar, Clock } from 'lucide-react';

const ScriptInterface = () => {
  const [scripts, setScripts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedScript, setSelectedScript] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scriptStats, setScriptStats] = useState(null);
  const [activeTab, setActiveTab] = useState('scripts'); // 'scripts' or 'schedules'
  const [schedules, setSchedules] = useState([]);
  const [cronStats, setCronStats] = useState(null);
  const [scheduleFormData, setScheduleFormData] = useState({
    name: '',
    cronExpression: '',
    scriptCode: ''
  });
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

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
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleEventChange = (event) => {
    const value = event.target.value;
    const checked = event.target.checked;
    
    console.log('Event change:', { value, checked });
    
    setFormData(prev => {
      const newEvents = checked 
        ? [...prev.events, value]
        : prev.events.filter(e => e !== value);
      
      console.log('Previous events:', prev.events);
      console.log('New events:', newEvents);
      
      return {
        ...prev,
        events: newEvents
      };
    });
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

      const events = formData.events || [];

      // Validate that at least one event is selected
      if (events.length === 0) {
        setError('Please select at least one event (create, update, or delete)');
        return;
      }

      const scriptData = {
        ...formData,
        filters,
        events
      };

      // Debug logging
      console.log('Form data before submission:', formData);
      console.log('Script data being sent:', scriptData);
      console.log('Events array:', events);

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
      console.error('Script submission error:', err);
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

  // Cron Schedule Management Functions
  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/scripts/scheduled/list');
      setSchedules(response.data.data?.scheduledScripts || []);
      setCronStats(response.data.data?.statistics || {});
    } catch (err) {
      setError(`Failed to load schedules: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCronStats = async () => {
    // Stats are loaded with schedules, no separate call needed
    try {
      const response = await api.get('/api/scripts/scheduled/list');
      setCronStats(response.data.data?.statistics || {});
    } catch (err) {
      console.error('Failed to load cron stats:', err);
    }
  };

  const validateCronExpression = async (expression) => {
    try {
      const response = await api.post('/api/scripts/cron/validate', { cronExpression: expression });
      return response.data.data; // Access the nested data object
    } catch (err) {
      return { valid: false, error: err.response?.data?.message || err.message };
    }
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleFormData.name || !scheduleFormData.cronExpression || !scheduleFormData.scriptCode) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // Validate cron expression first
      const validation = await validateCronExpression(scheduleFormData.cronExpression);
      if (!validation.valid) {
        setError(`Invalid cron expression: ${validation.error || 'Please check your cron expression format'}`);
        return;
      }

      const scheduleData = {
        name: scheduleFormData.name,
        cronExpression: scheduleFormData.cronExpression,
        scriptCode: scheduleFormData.scriptCode
      };

      if (selectedSchedule) {
        await api.put(`/api/scripts/schedule/${selectedSchedule.scriptName || selectedSchedule.name}`, scheduleData);
        setSuccess('Schedule updated successfully!');
      } else {
        await api.post('/api/scripts/schedule', scheduleData);
        setSuccess('Schedule created successfully!');
      }

      await loadSchedules();
      await loadCronStats();
      resetScheduleForm();
    } catch (err) {
      setError(`Failed to save schedule: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleEdit = (schedule) => {
    setSelectedSchedule(schedule);
    setScheduleFormData({
      name: schedule.scriptName || schedule.name || '',
      cronExpression: schedule.cronExpression || '',
      scriptCode: schedule.scriptCode || ''
    });
    setIsScheduleModalOpen(true);
  };

  const handleScheduleDelete = async (scheduleName) => {
    if (!window.confirm('Are you sure you want to unschedule this script?')) return;

    try {
      setLoading(true);
      await api.delete(`/api/scripts/schedule/${scheduleName}`);
      setSuccess('Schedule deleted successfully!');
      await loadSchedules();
      await loadCronStats();
    } catch (err) {
      setError(`Failed to delete schedule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const triggerScheduleManually = async (scheduleName) => {
    try {
      setLoading(true);
      await api.post(`/api/scripts/scheduled/${scheduleName}/trigger`);
      setSuccess(`Schedule "${scheduleName}" triggered manually!`);
      await loadCronStats();
    } catch (err) {
      setError(`Failed to trigger schedule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const pauseSchedule = async (scheduleName) => {
    try {
      setLoading(true);
      await api.post(`/api/scripts/schedule/${scheduleName}/pause`);
      setSuccess(`Schedule "${scheduleName}" paused successfully!`);
      await loadSchedules();
      await loadCronStats();
    } catch (err) {
      setError(`Failed to pause schedule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resumeSchedule = async (scheduleName) => {
    try {
      setLoading(true);
      await api.post(`/api/scripts/schedule/${scheduleName}/resume`);
      setSuccess(`Schedule "${scheduleName}" resumed successfully!`);
      await loadSchedules();
      await loadCronStats();
    } catch (err) {
      setError(`Failed to resume schedule: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetCronStats = async () => {
    if (!window.confirm('Are you sure you want to reset all cron statistics?')) return;

    try {
      setLoading(true);
      await api.delete('/api/scripts/cron/statistics/reset');
      setSuccess('Cron statistics reset successfully!');
      await loadCronStats();
    } catch (err) {
      setError(`Failed to reset cron statistics: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetScheduleForm = () => {
    setSelectedSchedule(null);
    setScheduleFormData({
      name: '',
      cronExpression: '',
      scriptCode: ''
    });
    setIsScheduleModalOpen(false);
  };

  const handleScheduleInputChange = (e) => {
    const { name, value } = e.target;
    setScheduleFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Load schedules and cron stats when switching to schedules tab
  useEffect(() => {
    if (activeTab === 'schedules') {
      loadSchedules();
      loadCronStats();
    }
  }, [activeTab]);

  return (
    <div className="script-interface" style={{ padding: '20px' }}>
      <div className="script-header" style={{ marginBottom: '20px' }}>
        <h2>JavaScript Automation & Scheduling</h2>
        
        {/* Tab Navigation */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid #e9ecef', 
          marginTop: '20px',
          marginBottom: '20px'
        }}>
          <button
            onClick={() => setActiveTab('scripts')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === 'scripts' ? '2px solid #007bff' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'scripts' ? '#007bff' : '#6c757d',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              marginRight: '20px'
            }}
            title="Manage scripts that run on database events (create, update, delete)"
          >
            📝 Event Scripts
          </button>
          <button
            onClick={() => setActiveTab('schedules')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === 'schedules' ? '2px solid #007bff' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'schedules' ? '#007bff' : '#6c757d',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
            title="Manage scripts that run on cron schedules (time-based automation)"
          >
            ⏰ Cron Schedules
          </button>
        </div>

        {/* Action Buttons */}
        <div className="script-actions" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          {activeTab === 'scripts' && (
            <>
              <button 
                onClick={() => { resetForm(); setIsModalOpen(true); }}
                className="btn btn-primary"
                disabled={loading}
                title="Create a new event-driven script"
              >
                <Plus size={16} />
                Create New Script
              </button>
              <button 
                onClick={clearRateLimits}
                className="btn btn-warning"
                disabled={loading}
                title="Clear rate limiting counters for all scripts"
              >
                <RotateCcw size={16} />
                Clear Rate Limits
              </button>
            </>
          )}
          {activeTab === 'schedules' && (
            <>
              <button 
                onClick={() => { resetScheduleForm(); setIsScheduleModalOpen(true); }}
                className="btn btn-success"
                disabled={loading}
                title="Create a new cron-scheduled script"
              >
                <Calendar size={16} />
                Create New Schedule
              </button>
              <button 
                onClick={resetCronStats}
                className="btn btn-danger"
                disabled={loading}
                title="Reset all cron execution statistics"
              >
                <RotateCcw size={16} />
                Reset Cron Stats
              </button>
            </>
          )}
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

      {/* Content based on active tab */}
      {activeTab === 'scripts' && (
        <>
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
                    <span style={{ fontWeight: '500' }}>{script.scriptName || script.name || script.scriptId}</span>
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
                        <strong>⚡ Rate Limit:</strong> {script.rateLimit?.maxExecutionsPerMinute || 60}/min
                        <span style={{ marginLeft: '12px' }}><strong>Retries:</strong> {script.rateLimit?.maxRetries || 3}</span>
                        <span style={{ marginLeft: '12px' }}><strong>Delay:</strong> {script.rateLimit?.baseDelayMs || 1000}ms - {script.rateLimit?.maxDelayMs || 30000}ms</span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEdit(script)}
                      className="btn btn-secondary btn-sm"
                      title="Edit script configuration and code"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => testScript(script)}
                      className="btn btn-success btn-sm"
                      title="Test script execution with sample data"
                    >
                      <Play size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(script._id)}
                      className="btn btn-danger btn-sm"
                      title="Delete this script permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </div>
        </>
      )}

      {/* Schedules Tab Content */}
      {activeTab === 'schedules' && (
        <>
          {/* Cron Statistics Section */}
          {cronStats && (
            <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <h3 style={{ marginBottom: '15px', color: '#495057' }}>⏰ Cron Scheduling Statistics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1976d2' }}>
                    {cronStats.totalExecutions || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Total Executions</div>
                </div>
                <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#388e3c' }}>
                    {cronStats.successfulExecutions || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Successful</div>
                </div>
                <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#ffebee', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#d32f2f' }}>
                    {cronStats.failedExecutions || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Failed</div>
                </div>
                <div style={{ textAlign: 'center', padding: '15px', backgroundColor: '#fff3e0', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f57c00' }}>
                    {schedules.length || 0}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Active Schedules</div>
                </div>
              </div>
            </div>
          )}

          {/* Schedules List */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '15px', color: '#495057' }}>📅 Active Cron Schedules</h3>
            {loading && schedules.length === 0 ? (
              <div>Loading schedules...</div>
            ) : schedules.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px', 
                backgroundColor: '#f8f9fa', 
                borderRadius: '8px',
                color: '#6c757d'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏰</div>
                <div style={{ fontSize: '18px', marginBottom: '5px' }}>No scheduled scripts</div>
                <div style={{ fontSize: '14px' }}>Create your first cron schedule to automate script execution</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '15px' }}>
                {schedules.map((schedule, index) => (
                  <div key={index} style={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px', 
                    padding: '20px',
                    backgroundColor: 'white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 8px 0', color: '#495057', fontSize: '18px' }}>
                          {schedule.scriptName || schedule.name}
                        </h4>
                        <div style={{ 
                          fontFamily: 'monospace', 
                          fontSize: '14px', 
                          color: '#0056b3',
                          backgroundColor: '#e3f2fd',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          marginBottom: '8px',
                          marginRight: '8px'
                        }}>
                          {schedule.cronExpression}
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: schedule.isRunning ? '#28a745' : '#ffc107',
                          backgroundColor: schedule.isRunning ? '#d4edda' : '#fff3cd',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          display: 'inline-block',
                          marginBottom: '8px',
                          fontWeight: 'bold'
                        }}>
                          {schedule.isRunning ? '🟢 Active' : '⏸️ Paused'}
                        </div>
                        {schedule.nextRun && (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            Next run: {new Date(schedule.nextRun).toLocaleString()}
                          </div>
                        )}
                        {schedule.lastExecution && (
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            Last run: {new Date(schedule.lastExecution).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          onClick={() => triggerScheduleManually(schedule.scriptName || schedule.name)}
                          className="btn btn-success btn-sm"
                          disabled={loading}
                          title="Run this schedule immediately"
                        >
                          <Play size={14} />
                        </button>
                        {schedule.isRunning ? (
                          <button
                            onClick={() => pauseSchedule(schedule.scriptName || schedule.name)}
                            className="btn btn-warning btn-sm"
                            disabled={loading}
                            title="Pause automatic execution of this schedule"
                          >
                            <Pause size={14} />
                          </button>
                        ) : (
                          <button
                            onClick={() => resumeSchedule(schedule.scriptName || schedule.name)}
                            className="btn btn-info btn-sm"
                            disabled={loading}
                            title="Resume automatic execution of this schedule"
                          >
                            <Play size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleScheduleEdit(schedule)}
                          className="btn btn-secondary btn-sm"
                          title="Edit schedule configuration and code"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleScheduleDelete(schedule.scriptName || schedule.name)}
                          className="btn btn-danger btn-sm"
                          disabled={loading}
                          title="Delete this schedule permanently"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    
                    {schedule.scriptCode && (
                      <div style={{ marginTop: '15px' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#666', 
                          marginBottom: '8px',
                          fontWeight: 'bold'
                        }}>
                          Script Code Preview:
                        </div>
                        <pre style={{ 
                          backgroundColor: '#f8f9fa', 
                          padding: '12px', 
                          borderRadius: '4px', 
                          fontSize: '11px',
                          maxHeight: '120px',
                          overflow: 'auto',
                          margin: 0,
                          border: '1px solid #e9ecef'
                        }}>
                          {schedule.scriptCode.length > 200 
                            ? schedule.scriptCode.substring(0, 200) + '...' 
                            : schedule.scriptCode
                          }
                        </pre>
                      </div>
                    )}

                    {schedule.executions !== undefined && (
                      <div style={{ 
                        marginTop: '15px', 
                        display: 'flex', 
                        gap: '20px',
                        fontSize: '12px',
                        color: '#666'
                      }}>
                        <span>Executions: <strong>{schedule.executions}</strong></span>
                        {schedule.lastResult && (
                          <span>Status: <strong style={{ color: schedule.lastResult.success ? '#28a745' : '#dc3545' }}>
                            {schedule.lastResult.success ? 'Success' : 'Failed'}
                          </strong></span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Schedule Creation/Edit Modal */}
      {isScheduleModalOpen && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          backgroundColor: 'rgba(0, 0, 0, 0.5)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{ 
            backgroundColor: 'white', 
            padding: '30px', 
            borderRadius: '8px', 
            width: '90%', 
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#495057' }}>
              {selectedSchedule ? 'Edit Cron Schedule' : 'Create New Cron Schedule'}
            </h3>
            
            <form onSubmit={handleScheduleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Schedule Name:
                </label>
                <input
                  type="text"
                  name="name"
                  value={scheduleFormData.name}
                  onChange={handleScheduleInputChange}
                  placeholder="Enter schedule name (e.g., daily-cleanup)"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px'
                  }}
                  required
                  disabled={selectedSchedule} // Name cannot be changed when editing
                />
                {selectedSchedule && (
                  <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '5px' }}>
                    Schedule name cannot be changed when editing
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  Cron Expression:
                </label>
                <input
                  type="text"
                  name="cronExpression"
                  value={scheduleFormData.cronExpression}
                  onChange={handleScheduleInputChange}
                  placeholder="* * * * *"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}
                  required
                />
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
                  <div><strong>Format:</strong> minute hour day-of-month month day-of-week</div>
                  <div style={{ marginTop: '4px' }}>
                    <strong>Examples:</strong><br/>
                    • <code>*/5 * * * *</code> - Every 5 minutes<br/>
                    • <code>0 9 * * *</code> - Daily at 9:00 AM<br/>
                    • <code>0 9 * * 1</code> - Every Monday at 9:00 AM<br/>
                    • <code>0 0 1 * *</code> - First day of every month
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                  JavaScript Code:
                </label>
                <textarea
                  name="scriptCode"
                  value={scheduleFormData.scriptCode}
                  onChange={handleScheduleInputChange}
                  placeholder="// Your JavaScript code here&#10;console.log('Scheduled script executed at', new Date());"
                  rows="12"
                  style={{ 
                    width: '100%', 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '13px',
                    lineHeight: '1.4'
                  }}
                  required
                />
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
                  The script will have access to api, utils, and console objects for HTTP requests and logging.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={resetScheduleForm}
                  className="btn btn-secondary"
                  title="Cancel and close this form"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn btn-primary"
                  title={selectedSchedule ? "Save changes to this schedule" : "Create new cron schedule"}
                >
                  {loading ? 'Saving...' : (selectedSchedule ? 'Update Schedule' : 'Create Schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Events:</label>
                <div className="checkbox-group" style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  {['create', 'update', 'delete'].map((event) => (
                    <label key={event} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        value={event}
                        checked={formData.events.includes(event)}
                        onChange={handleEventChange}
                        style={{ marginRight: '5px' }}
                      />
                      {event.charAt(0).toUpperCase() + event.slice(1)}
                    </label>
                  ))}
                </div>
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

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="btn btn-secondary"
                  title="Cancel and close this form"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="btn btn-primary"
                  title={selectedScript ? "Save changes to this script" : "Create new event script"}
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
