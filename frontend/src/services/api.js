import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to:`, config.url);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const apiService = {
  // Health check
  health: () => api.get('/health'),

  // Collection management
  listCollections: () => api.get('/api/management/collections'),
  createCollection: (name) => api.post('/api/management/collections', { name }),
  dropCollection: (name) => api.delete(`/api/management/collections/${name}`),

  // Collection data operations
  getCollectionData: (collection, params = {}) => 
    api.get(`/api/db/${collection}`, { params }),
  
  createDocument: (collection, data) => 
    api.post(`/api/db/${collection}`, data),
  
  updateDocument: (collection, id, data) => 
    api.put(`/api/db/${collection}/${id}`, data),
  
  deleteDocument: (collection, id) => 
    api.delete(`/api/db/${collection}/${id}`),
  
  getDocument: (collection, id) => 
    api.get(`/api/db/${collection}/${id}`),

  // Webhook management
  listWebhooks: () => api.get('/api/webhooks'),
  createWebhook: (webhook) => api.post('/api/webhooks', webhook),
  getWebhook: (id) => api.get(`/api/webhooks/${id}`),
  updateWebhook: (id, webhook) => api.put(`/api/webhooks/${id}`, webhook),
  deleteWebhook: (id) => api.delete(`/api/webhooks/${id}`),
  testWebhook: (id) => api.post(`/api/webhooks/${id}/test`),

  // Bulk data operations
  previewBulkData: (collection, file, previewRows = 10) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('previewRows', previewRows);
    
    return api.post(`/api/bulk/${collection}/preview`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  uploadBulkData: (collection, file, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add options to form data
    Object.entries(options).forEach(([key, value]) => {
      formData.append(key, value);
    });
    
    return api.post(`/api/bulk/${collection}/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  downloadTemplate: (collection, sampleData = false) => {
    return api.get(`/api/bulk/${collection}/template`, {
      params: { sampleData },
      responseType: 'blob',
    });
  },
};

export default api;
