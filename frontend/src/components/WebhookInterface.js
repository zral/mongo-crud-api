import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import { Plus, Trash2, RefreshCw, Play, Edit, Eye, Pause } from 'lucide-react';

const WebhookInterface = () => {
  const [webhooks, setWebhooks] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    collection: '',
    events: [],
    filters: '{}',
    excludeFields: '',
    enabled: true,
    rateLimit: {
      maxRequestsPerMinute: 60,
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000
    },
    useCustomRateLimit: false
  });

  useEffect(() => {
    loadWebhooks();
    loadCollections();
  }, []);

  const loadWebhooks = async () => {
    setLoading(true);
    try {
      const response = await apiService.listWebhooks();
      setWebhooks(response.data.data.webhooks || []);
    } catch (error) {
      toast.error('Failed to load webhooks');
      console.error('Error loading webhooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const response = await apiService.listCollections();
      setCollections(response.data.collections || []);
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      collection: '',
      events: [],
      filters: '{}',
      excludeFields: '',
      enabled: true,
      rateLimit: {
        maxRequestsPerMinute: 60,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000
      },
      useCustomRateLimit: false
    });
    setEditingWebhook(null);
  };

  const openModal = (webhook = null) => {
    if (webhook) {
      setEditingWebhook(webhook);
      const hasCustomRateLimit = webhook.rateLimit ? true : false;
      const defaultRateLimit = {
        maxRequestsPerMinute: 60,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000
      };
      setFormData({
        name: webhook.name,
        url: webhook.url,
        collection: webhook.collection,
        events: webhook.events,
        filters: JSON.stringify(webhook.filters, null, 2),
        excludeFields: webhook.excludeFields ? webhook.excludeFields.join(', ') : '',
        enabled: webhook.enabled,
        rateLimit: webhook.rateLimit || defaultRateLimit,
        useCustomRateLimit: hasCustomRateLimit
      });
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      // Parse filters JSON
      let filters;
      try {
        filters = JSON.parse(formData.filters);
      } catch (error) {
        toast.error('Invalid JSON in filters field');
        return;
      }

      // Parse excludeFields
      const excludeFields = formData.excludeFields
        ? formData.excludeFields.split(',').map(field => field.trim()).filter(field => field)
        : [];

      const webhookData = {
        name: formData.name,
        url: formData.url,
        collection: formData.collection,
        events: formData.events,
        filters,
        excludeFields,
        enabled: formData.enabled
      };

      // Only include rate limits if custom rate limiting is enabled
      if (formData.useCustomRateLimit) {
        webhookData.rateLimit = formData.rateLimit;
      }

      if (editingWebhook) {
        await apiService.updateWebhook(editingWebhook._id, webhookData);
        toast.success('Webhook updated successfully');
      } else {
        await apiService.createWebhook(webhookData);
        toast.success('Webhook created successfully');
      }

      closeModal();
      await loadWebhooks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save webhook');
    }
  };

  const handleDelete = async (webhookId, webhookName) => {
    if (!window.confirm(`Are you sure you want to delete the webhook "${webhookName}"?`)) {
      return;
    }

    try {
      await apiService.deleteWebhook(webhookId);
      toast.success('Webhook deleted successfully');
      await loadWebhooks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete webhook');
    }
  };

  const handleTest = async (webhookId, webhookName) => {
    try {
      const response = await apiService.testWebhook(webhookId);
      if (response.data.success) {
        toast.success('Webhook test successful');
      } else {
        toast.error(`Webhook test failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to test webhook');
    }
  };

  const handleToggleEnabled = async (webhook) => {
    try {
      await apiService.updateWebhook(webhook._id, { enabled: !webhook.enabled });
      toast.success(`Webhook ${webhook.enabled ? 'disabled' : 'enabled'} successfully`);
      await loadWebhooks();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update webhook');
    }
  };

  const handleEventChange = (event) => {
    const value = event.target.value;
    const checked = event.target.checked;
    
    setFormData(prev => ({
      ...prev,
      events: checked 
        ? [...prev.events, value]
        : prev.events.filter(e => e !== value)
    }));
  };

  const formatEvents = (events) => {
    return events.map(event => (
      <span key={event} className={`event-badge event-${event}`}>
        {event}
      </span>
    ));
  };

  const formatRateLimit = (webhook) => {
    if (!webhook.rateLimit) {
      return (
        <span className="rate-limit-info default">
          <small>Default</small>
          <br />
          <span>60/min, 3 retries</span>
        </span>
      );
    }
    
    return (
      <span className="rate-limit-info custom">
        <small>Custom</small>
        <br />
        <span>{webhook.rateLimit.maxRequestsPerMinute}/min, {webhook.rateLimit.maxRetries} retries</span>
      </span>
    );
  };

  return (
    <div>
      <div className="card">
        <div className="collection-header">
          <h2>Webhook Management</h2>
          <div>
            <button
              onClick={() => openModal()}
              className="btn btn-primary"
              style={{ marginRight: '1rem' }}
            >
              <Plus size={16} />
              Create Webhook
            </button>
            <button
              onClick={loadWebhooks}
              className="btn btn-secondary"
              disabled={loading}
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <p>No webhooks found. Create your first webhook above.</p>
        ) : (
          <div className="webhooks-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>URL</th>
                  <th>Collection</th>
                  <th>Events</th>
                  <th>Excluded Fields</th>
                  <th>Rate Limit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((webhook) => (
                  <tr key={webhook._id}>
                    <td>{webhook.name}</td>
                    <td className="url-cell">
                      <a href={webhook.url} target="_blank" rel="noopener noreferrer">
                        {webhook.url.length > 40 ? webhook.url.substring(0, 40) + '...' : webhook.url}
                      </a>
                    </td>
                    <td>{webhook.collection}</td>
                    <td className="events-cell">
                      {formatEvents(webhook.events)}
                    </td>
                    <td className="excluded-fields-cell">
                      {webhook.excludeFields && webhook.excludeFields.length > 0 
                        ? webhook.excludeFields.join(', ')
                        : 'None'
                      }
                    </td>
                    <td className="rate-limit-cell">
                      {formatRateLimit(webhook)}
                    </td>
                    <td>
                      <span className={`status-badge ${webhook.enabled ? 'enabled' : 'disabled'}`}>
                        {webhook.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        onClick={() => handleTest(webhook._id, webhook.name)}
                        className="btn btn-secondary btn-sm"
                        title="Test webhook"
                      >
                        <Play size={14} />
                      </button>
                      <button
                        onClick={() => openModal(webhook)}
                        className="btn btn-secondary btn-sm"
                        title="Edit webhook"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(webhook)}
                        className={`btn btn-sm ${webhook.enabled ? 'btn-secondary' : 'btn-primary'}`}
                        title={webhook.enabled ? 'Disable webhook' : 'Enable webhook'}
                      >
                        {webhook.enabled ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(webhook._id, webhook.name)}
                        className="btn btn-danger btn-sm"
                        title="Delete webhook"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</h3>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>
            
            <form onSubmit={handleSubmit} className="modal-body">
              <div className="form-group">
                <label htmlFor="name">Webhook Name</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter webhook name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="url">Webhook URL</label>
                <input
                  type="url"
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com/webhook"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="collection">Collection</label>
                <select
                  id="collection"
                  value={formData.collection}
                  onChange={(e) => setFormData(prev => ({ ...prev, collection: e.target.value }))}
                  required
                >
                  <option value="">Select a collection</option>
                  {collections.map((collection) => (
                    <option key={collection.name} value={collection.name}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Events</label>
                <div className="checkbox-group">
                  {['create', 'update', 'delete'].map((event) => (
                    <label key={event} className="checkbox-label">
                      <input
                        type="checkbox"
                        value={event}
                        checked={formData.events.includes(event)}
                        onChange={handleEventChange}
                      />
                      {event.charAt(0).toUpperCase() + event.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="filters">
                  Filters (JSON)
                  <small>Leave empty ({}) to match all documents</small>
                </label>
                <textarea
                  id="filters"
                  value={formData.filters}
                  onChange={(e) => setFormData(prev => ({ ...prev, filters: e.target.value }))}
                  placeholder='{"field": "value"} or {"age": {"$gt": 18}}'
                  rows={4}
                />
              </div>

              <div className="form-group">
                <label htmlFor="excludeFields">
                  Exclude Fields
                  <small>Comma-separated list of fields to exclude from webhook payload</small>
                </label>
                <input
                  type="text"
                  id="excludeFields"
                  value={formData.excludeFields}
                  onChange={(e) => setFormData(prev => ({ ...prev, excludeFields: e.target.value }))}
                  placeholder="password, ssn, sensitive_data"
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  Enabled
                </label>
              </div>

              {/* Rate Limiting Section */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.useCustomRateLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, useCustomRateLimit: e.target.checked }))}
                  />
                  Use Custom Rate Limiting
                  <small>Uncheck to use global defaults (60 req/min, 3 retries)</small>
                </label>
              </div>

              {formData.useCustomRateLimit && (
                <div className="rate-limit-section">
                  <h4>Rate Limit Configuration</h4>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="maxRequestsPerMinute">
                        Max Requests/Minute
                        <small>1-300 requests per minute</small>
                      </label>
                      <input
                        type="number"
                        id="maxRequestsPerMinute"
                        min="1"
                        max="300"
                        value={formData.rateLimit.maxRequestsPerMinute}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          rateLimit: {
                            ...prev.rateLimit,
                            maxRequestsPerMinute: Math.min(Math.max(parseInt(e.target.value) || 1, 1), 300)
                          }
                        }))}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="maxRetries">
                        Max Retries
                        <small>0-10 retry attempts</small>
                      </label>
                      <input
                        type="number"
                        id="maxRetries"
                        min="0"
                        max="10"
                        value={formData.rateLimit.maxRetries}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          rateLimit: {
                            ...prev.rateLimit,
                            maxRetries: Math.min(Math.max(parseInt(e.target.value) || 0, 0), 10)
                          }
                        }))}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="baseDelayMs">
                        Base Delay (ms)
                        <small>100ms-10s initial retry delay</small>
                      </label>
                      <input
                        type="number"
                        id="baseDelayMs"
                        min="100"
                        max="10000"
                        step="100"
                        value={formData.rateLimit.baseDelayMs}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          rateLimit: {
                            ...prev.rateLimit,
                            baseDelayMs: Math.min(Math.max(parseInt(e.target.value) || 100, 100), 10000)
                          }
                        }))}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="maxDelayMs">
                        Max Delay (ms)
                        <small>1s-5min maximum retry delay</small>
                      </label>
                      <input
                        type="number"
                        id="maxDelayMs"
                        min="1000"
                        max="300000"
                        step="1000"
                        value={formData.rateLimit.maxDelayMs}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          rateLimit: {
                            ...prev.rateLimit,
                            maxDelayMs: Math.min(Math.max(parseInt(e.target.value) || 1000, 1000), 300000)
                          }
                        }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingWebhook ? 'Update' : 'Create'} Webhook
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebhookInterface;
