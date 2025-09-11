import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import DocumentModal from './DocumentModal';
import BulkUploadInterface from './BulkUploadInterface';
import { Eye, Edit, Trash2, Plus, RefreshCw, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

const CollectionInterface = () => {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    mode: 'create', // 'create', 'edit', 'view'
    document: null
  });
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadDocuments();
    }
  }, [selectedCollection, pagination.page, pagination.limit]);

  const loadCollections = async () => {
    try {
      const response = await apiService.listCollections();
      const collectionList = response.data.collections || [];
      setCollections(collectionList);
      
      // Auto-select first collection if none selected
      if (!selectedCollection && collectionList.length > 0) {
        setSelectedCollection(collectionList[0].name);
      }
    } catch (error) {
      toast.error('Failed to load collections');
      console.error('Error loading collections:', error);
    }
  };

  const loadDocuments = async () => {
    if (!selectedCollection) return;
    
    setLoading(true);
    try {
      const response = await apiService.getCollectionData(selectedCollection, {
        page: pagination.page,
        limit: pagination.limit
      });
      
      setDocuments(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
    } catch (error) {
      toast.error('Failed to load documents');
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = () => {
    setModalConfig({
      isOpen: true,
      mode: 'create',
      document: null
    });
  };

  const handleEditDocument = (document) => {
    setModalConfig({
      isOpen: true,
      mode: 'edit',
      document
    });
  };

  const handleViewDocument = (document) => {
    setModalConfig({
      isOpen: true,
      mode: 'view',
      document
    });
  };

  const handleDeleteDocument = async (documentId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) {
      return;
    }

    try {
      await apiService.deleteDocument(selectedCollection, documentId);
      toast.success('Document deleted successfully');
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete document');
    }
  };

  const handleModalSave = async (documentData) => {
    try {
      if (modalConfig.mode === 'create') {
        await apiService.createDocument(selectedCollection, documentData);
        toast.success('Document created successfully');
      } else if (modalConfig.mode === 'edit') {
        await apiService.updateDocument(selectedCollection, modalConfig.document._id, documentData);
        toast.success('Document updated successfully');
      }
      
      setModalConfig({ isOpen: false, mode: 'create', document: null });
      await loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save document');
    }
  };

  const handleBulkUpload = () => {
    setShowBulkUpload(true);
  };

  const handleBulkUploadComplete = (results) => {
    toast.success(`Bulk upload completed: ${results.insertedCount} inserted, ${results.modifiedCount} modified`);
    if (results.errors.length > 0) {
      toast.error(`${results.errors.length} errors occurred during upload`);
    }
    loadDocuments(); // Refresh the documents list
  };

  const handleCloseBulkUpload = () => {
    setShowBulkUpload(false);
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit) => {
    setPagination(prev => ({ ...prev, page: 1, limit: parseInt(newLimit) }));
  };

  const renderDocumentValue = (value, key = '') => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length} items]`;
      }
      return '{object}';
    }
    if (typeof value === 'string' && value.length > 50) {
      return value.substring(0, 50) + '...';
    }
    return String(value);
  };

  const getDocumentKeys = () => {
    if (documents.length === 0) return [];
    
    const allKeys = new Set();
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => allKeys.add(key));
    });
    
    // Remove _id from the keys and sort the rest
    const filteredKeys = Array.from(allKeys).filter(key => key !== '_id').sort();
    
    return filteredKeys.slice(0, 6); // Limit to 6 columns for better display
  };

  return (
    <div>
      <div className="card">
        <div className="collection-header">
          <h2>Collection Data</h2>
          <div className="collection-actions">
            <select
              value={selectedCollection}
              onChange={(e) => setSelectedCollection(e.target.value)}
              className="form-control"
            >
              <option value="">Select a collection</option>
              {collections.map(collection => (
                <option key={collection.name} value={collection.name}>
                  {collection.name}
                </option>
              ))}
            </select>
            
            {selectedCollection && (
              <>
                <button
                  onClick={handleCreateDocument}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  Add Document
                </button>
                <button
                  onClick={handleBulkUpload}
                  className="btn btn-success"
                >
                  <Upload size={16} />
                  Bulk Upload
                </button>
                <button
                  onClick={loadDocuments}
                  className="btn btn-secondary"
                  disabled={loading}
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>
              </>
            )}
          </div>
        </div>

        {selectedCollection && (
          <div className="form-group">
            <label>Items per page:</label>
            <select
              value={pagination.limit}
              onChange={(e) => handleLimitChange(e.target.value)}
              style={{ width: 'auto', display: 'inline-block', marginLeft: '10px' }}
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        )}
      </div>

      {selectedCollection && (
        <div className="card">
          {loading ? (
            <div className="loading">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>No documents found in this collection.</p>
              <button
                onClick={handleCreateDocument}
                className="btn btn-primary"
              >
                <Plus size={16} />
                Create First Document
              </button>
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {getDocumentKeys().map(key => (
                        <th key={key}>{key}</th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map(document => (
                      <tr key={document._id}>
                        {getDocumentKeys().map(key => (
                          <td key={key}>
                            {renderDocumentValue(document[key], key)}
                          </td>
                        ))}
                        <td>
                          <div className="collection-actions">
                            <button
                              onClick={() => handleViewDocument(document)}
                              className="btn btn-secondary"
                              title="View"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => handleEditDocument(document)}
                              className="btn btn-primary"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteDocument(document._id)}
                              className="btn btn-danger"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="btn"
                >
                  <ChevronLeft size={16} />
                  Previous
                </button>
                
                <span className="pagination-info">
                  Page {pagination.page} of {pagination.pages} 
                  ({pagination.total} total items)
                </span>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="btn"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <DocumentModal
        isOpen={modalConfig.isOpen}
        mode={modalConfig.mode}
        document={modalConfig.document}
        collection={selectedCollection}
        onClose={() => setModalConfig({ isOpen: false, mode: 'create', document: null })}
        onSave={handleModalSave}
      />

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <BulkUploadInterface
              collection={selectedCollection}
              onUploadComplete={handleBulkUploadComplete}
              onClose={handleCloseBulkUpload}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CollectionInterface;
