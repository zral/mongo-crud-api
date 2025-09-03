import React, { useState, useEffect } from 'react';
import api from '../services/api';

const ScriptInterface = () => {
  const [scripts, setScripts] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadScripts();
    loadCollections();
  }, []);

  const loadScripts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/scripts');
      console.log('Scripts response:', response.data);
      setScripts(response.data.data?.scripts || []);
    } catch (err) {
      console.error('Scripts error:', err);
      setError(`Failed to load scripts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const response = await api.get('/api/management/collections');
      console.log('Collections response:', response.data);
      setCollections(response.data.collections || []);
    } catch (err) {
      console.error('Collections error:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading scripts...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <h2>JavaScript Snippets Management</h2>
      
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          Error: {error}
        </div>
      )}
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Collections ({collections.length})</h3>
        <ul>
          {collections.map(col => (
            <li key={col.name}>{col.name} ({col.stats?.documentCount || 0} docs)</li>
          ))}
        </ul>
      </div>
      
      <div>
        <h3>Scripts ({scripts.length})</h3>
        {scripts.length === 0 ? (
          <p>No scripts found. Click "Create Script" to add one.</p>
        ) : (
          <ul>
            {scripts.map(script => (
              <li key={script._id}>{script.name} - {script.enabled ? 'Enabled' : 'Disabled'}</li>
            ))}
          </ul>
        )}
      </div>
      
      <button 
        style={{ 
          padding: '10px 20px', 
          backgroundColor: '#007bff', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px',
          marginTop: '20px'
        }}
        onClick={() => alert('Create script functionality coming soon!')}
      >
        Create Script
      </button>
    </div>
  );
};

export default ScriptInterface;
