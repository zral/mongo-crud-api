import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import { Plus, Trash2, RefreshCw, Database, Clock } from 'lucide-react';

const ManagementInterface = () => {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Utility function to format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Never';
    
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSeconds < 60) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    setLoading(true);
    try {
      const response = await apiService.listCollections();
      setCollections(response.data.collections || []);
    } catch (error) {
      toast.error('Failed to load collections');
      console.error('Error loading collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newCollectionName.trim()) {
      toast.error('Collection name is required');
      return;
    }

    setIsCreating(true);
    try {
      await apiService.createCollection(newCollectionName.trim());
      toast.success(`Collection "${newCollectionName}" created successfully`);
      setNewCollectionName('');
      await loadCollections();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create collection');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDropCollection = async (collectionName) => {
    console.log('handleDropCollection called with:', collectionName);
    
    if (!collectionName) {
      console.error('No collection name provided');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to drop the collection "${collectionName}"? This action cannot be undone.`);
    console.log('User confirmation:', confirmed);
    
    if (!confirmed) {
      return;
    }

    try {
      console.log(`Attempting to drop collection: ${collectionName}`);
      const response = await apiService.dropCollection(collectionName);
      console.log('Drop collection response:', response);
      toast.success(`Collection "${collectionName}" dropped successfully`);
      await loadCollections();
    } catch (error) {
      console.error('Drop collection error:', error);
      console.error('Error response:', error.response);
      toast.error(error.response?.data?.message || `Failed to drop collection: ${error.message}`);
    }
  };

  return (
    <div>
      <div className="card">
        <h2>Create New Collection</h2>
        <form onSubmit={handleCreateCollection}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="collectionName">Collection Name</label>
              <input
                type="text"
                id="collectionName"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="Enter collection name"
                disabled={isCreating}
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isCreating || !newCollectionName.trim()}
          >
            <Plus size={16} />
            {isCreating ? 'Creating...' : 'Create Collection'}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="collection-header">
          <h2>Existing Collections</h2>
          <button
            onClick={loadCollections}
            className="btn btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading collections...</div>
        ) : collections.length === 0 ? (
          <p>No collections found. Create your first collection above.</p>
        ) : (
          <div className="collections-grid">
            {collections.map((collection) => (
              <div key={collection.name} className="collection-card">
                <div className="collection-header">
                  <h3 className="collection-name">{collection.name}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      console.log('Button clicked for collection:', collection.name);
                      handleDropCollection(collection.name);
                    }}
                    className="btn btn-danger"
                    title={`Drop ${collection.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="collection-info">
                  <p><strong>Type:</strong> {collection.type}</p>
                  
                  {/* Collection Statistics */}
                  <div className="collection-stats">
                    <div className="stat-item">
                      <div className="stat-label">
                        <Database size={16} />
                        <strong>Documents:</strong>
                      </div>
                      <span className="stat-value">
                        {collection.stats?.documentCount !== undefined 
                          ? collection.stats.documentCount.toLocaleString() 
                          : 'N/A'}
                      </span>
                    </div>
                    
                    <div className="stat-item">
                      <div className="stat-label">
                        <Clock size={16} />
                        <strong>Last Updated:</strong>
                      </div>
                      <span 
                        className="stat-value" 
                        title={collection.stats?.lastUpdated 
                          ? new Date(collection.stats.lastUpdated).toLocaleString()
                          : 'Never'
                        }
                      >
                        {formatRelativeTime(collection.stats?.lastUpdated)}
                      </span>
                    </div>
                  </div>
                  
                  {collection.options && Object.keys(collection.options).length > 0 && (
                    <p><strong>Options:</strong> {JSON.stringify(collection.options)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagementInterface;
