import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/api';
import DocumentModal from './DocumentModal';
import BulkUploadInterface from './BulkUploadInterface';
import { Eye, Edit, Trash2, Plus, RefreshCw, ChevronLeft, ChevronRight, Upload, Filter, Settings } from 'lucide-react';

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
  
  // New state for filtering and field selection
  const [filter, setFilter] = useState('');
  const [filterKey, setFilterKey] = useState('');
  const [filterOperator, setFilterOperator] = useState('contains'); // contains, equals, gt, lt, gte, lte, range
  const [filterValue2, setFilterValue2] = useState(''); // For range operations
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState([]);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [fieldTypes, setFieldTypes] = useState({}); // Track field types for better filtering

  useEffect(() => {
    loadCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadDocuments();
    }
  }, [selectedCollection, pagination.page, pagination.limit, filter, filterKey, filterOperator, filterValue2]);

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
      const queryParams = {
        page: pagination.page,
        limit: pagination.limit
      };
      
      // Add advanced filter if provided
      if (filter && filterKey) {
        const fieldType = fieldTypes[filterKey] || 'string';
        
        // Helper function to convert value based on field type
        const convertValue = (value) => {
          if (fieldType === 'number') {
            return Number(value);
          } else if (fieldType === 'date') {
            // Convert date string to ISO format for MongoDB
            // Handle both date input format (YYYY-MM-DD) and full ISO strings
            if (value.includes('T')) {
              // Already an ISO string
              return value;
            } else {
              // Date input format - convert to ISO string
              const date = new Date(value + 'T00:00:00.000Z');
              return date.toISOString();
            }
          }
          return value;
        };
        
        switch (filterOperator) {
          case 'contains':
            if (fieldType === 'string') {
              // Use JSON format for regex operations
              queryParams[filterKey] = JSON.stringify({
                $regex: filter,
                $options: 'i'
              });
            } else {
              queryParams[filterKey] = convertValue(filter);
            }
            break;
            
          case 'equals':
            queryParams[filterKey] = convertValue(filter);
            break;
            
          case 'gt':
            queryParams[filterKey] = JSON.stringify({
              $gt: convertValue(filter)
            });
            break;
            
          case 'lt':
            queryParams[filterKey] = JSON.stringify({
              $lt: convertValue(filter)
            });
            break;
            
          case 'gte':
            queryParams[filterKey] = JSON.stringify({
              $gte: convertValue(filter)
            });
            break;
            
          case 'lte':
            queryParams[filterKey] = JSON.stringify({
              $lte: convertValue(filter)
            });
            break;
            
          case 'range':
            if (filter && filterValue2) {
              const val1 = convertValue(filter);
              const val2 = convertValue(filterValue2);
              queryParams[filterKey] = JSON.stringify({
                $gte: fieldType === 'number' ? Math.min(val1, val2) : val1,
                $lte: fieldType === 'number' ? Math.max(val1, val2) : val2
              });
            }
            break;
            
          default:
            queryParams[filterKey] = convertValue(filter);
        }
      }
      
      const response = await apiService.getCollectionData(selectedCollection, queryParams);
      
      const documentsData = response.data.data || [];
      setDocuments(documentsData);
      setPagination(prev => ({
        ...prev,
        ...response.data.pagination
      }));
      
      // Update available fields and detect field types
      if (documentsData.length > 0) {
        const allKeys = new Set();
        const typeMap = {};
        
        documentsData.forEach(doc => {
          Object.keys(doc).forEach(key => {
            allKeys.add(key);
            
            // Detect field type from first non-null value
            if (!typeMap[key] && doc[key] !== null && doc[key] !== undefined) {
              const value = doc[key];
              if (typeof value === 'number') {
                typeMap[key] = 'number';
              } else if (typeof value === 'string') {
                // Check if it looks like a date
                if (/^\d{4}-\d{2}-\d{2}/.test(value) || !isNaN(Date.parse(value))) {
                  typeMap[key] = 'date';
                } else {
                  typeMap[key] = 'string';
                }
              } else if (typeof value === 'boolean') {
                typeMap[key] = 'boolean';
              } else if (value instanceof Date) {
                typeMap[key] = 'date';
              } else {
                typeMap[key] = 'object';
              }
            }
          });
        });
        
        // Include all fields including _id, but sort with _id first
        const fields = Array.from(allKeys).sort((a, b) => {
          if (a === '_id') return -1;
          if (b === '_id') return 1;
          return a.localeCompare(b);
        });
        setAvailableFields(fields);
        setFieldTypes(typeMap);
        
        // Set default selected fields (first 6 non-_id fields) if none selected yet
        if (selectedFields.length === 0) {
          const defaultFields = fields.filter(field => field !== '_id').slice(0, 6);
          setSelectedFields(defaultFields);
        }
      }
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

  const handleFilterChange = (value) => {
    setFilter(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when filtering
  };

  const handleFilterValue2Change = (value) => {
    setFilterValue2(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterKeyChange = (key) => {
    setFilterKey(key);
    setFilter('');
    setFilterValue2('');
    setFilterOperator(getDefaultOperator(key));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page when changing filter field
  };

  const handleFilterOperatorChange = (operator) => {
    setFilterOperator(operator);
    setFilterValue2('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getDefaultOperator = (fieldKey) => {
    const fieldType = fieldTypes[fieldKey] || 'string';
    switch (fieldType) {
      case 'number':
      case 'date':
        return 'equals';
      case 'string':
        return 'contains';
      default:
        return 'equals';
    }
  };

  const getAvailableOperators = (fieldKey) => {
    const fieldType = fieldTypes[fieldKey] || 'string';
    
    const baseOperators = [
      { value: 'equals', label: 'Equals' }
    ];
    
    if (fieldType === 'string') {
      return [
        { value: 'contains', label: 'Contains' },
        ...baseOperators
      ];
    } else if (fieldType === 'number' || fieldType === 'date') {
      return [
        ...baseOperators,
        { value: 'gt', label: 'Greater than' },
        { value: 'gte', label: 'Greater than or equal' },
        { value: 'lt', label: 'Less than' },
        { value: 'lte', label: 'Less than or equal' },
        { value: 'range', label: 'Range' }
      ];
    } else {
      return baseOperators;
    }
  };

  const clearFilter = () => {
    setFilter('');
    setFilterKey('');
    setFilterOperator('contains');
    setFilterValue2('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFieldToggle = (field) => {
    setSelectedFields(prev => {
      if (prev.includes(field)) {
        return prev.filter(f => f !== field);
      } else {
        return [...prev, field];
      }
    });
  };

  const selectAllFields = () => {
    setSelectedFields([...availableFields]);
  };

  const clearAllFields = () => {
    setSelectedFields([]);
  };

  const resetToDefault = () => {
    const defaultFields = availableFields.filter(field => field !== '_id').slice(0, 6);
    setSelectedFields(defaultFields);
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
    // Return selected fields in the order they appear in availableFields
    return availableFields.filter(field => selectedFields.includes(field));
  };

  return (
    <div>
      <div className="card">
        <div className="collection-header">
          <h2>Collection Data</h2>
          <div className="collection-actions">
            <select
              value={selectedCollection}
              onChange={(e) => {
                setSelectedCollection(e.target.value);
                // Reset filters and field selection when changing collections
                setFilter('');
                setFilterKey('');
                setSelectedFields([]);
                setShowFieldSelector(false);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
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
          <>
            {/* Advanced Filter Controls */}
            <div className="filter-controls" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <Filter size={16} />
                <span style={{ fontWeight: 'bold' }}>Advanced Filter:</span>
              </div>
              
              <div style={{ display: 'flex', gap: '10px', alignItems: 'end', flexWrap: 'wrap', marginBottom: '10px' }}>
                {/* Field Selection */}
                <div>
                  <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Field</label>
                  <select
                    value={filterKey}
                    onChange={(e) => handleFilterKeyChange(e.target.value)}
                    className="form-control"
                    style={{ width: '150px' }}
                  >
                    <option value="">No filter</option>
                    {availableFields.map(field => (
                      <option key={field} value={field}>
                        {field} ({fieldTypes[field] || 'unknown'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operator Selection */}
                {filterKey && (
                  <div>
                    <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Operator</label>
                    <select
                      value={filterOperator}
                      onChange={(e) => handleFilterOperatorChange(e.target.value)}
                      className="form-control"
                      style={{ width: '130px' }}
                    >
                      {getAvailableOperators(filterKey).map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Value Input(s) */}
                {filterKey && (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'end' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>
                        Value{filterOperator === 'range' ? ' (from)' : ''}
                      </label>
                      <input
                        type={fieldTypes[filterKey] === 'number' ? 'number' : fieldTypes[filterKey] === 'date' ? 'date' : 'text'}
                        value={filter}
                        onChange={(e) => handleFilterChange(e.target.value)}
                        placeholder={
                          fieldTypes[filterKey] === 'string' ? 'Enter text...' :
                          fieldTypes[filterKey] === 'number' ? 'Enter number...' :
                          fieldTypes[filterKey] === 'date' ? 'Select date...' :
                          'Enter value...'
                        }
                        className="form-control"
                        style={{ width: '150px' }}
                      />
                    </div>
                    
                    {filterOperator === 'range' && (
                      <>
                        <span style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>to</span>
                        <div>
                          <label style={{ fontSize: '12px', color: '#666', marginBottom: '5px', display: 'block' }}>Value (to)</label>
                          <input
                            type={fieldTypes[filterKey] === 'number' ? 'number' : fieldTypes[filterKey] === 'date' ? 'date' : 'text'}
                            value={filterValue2}
                            onChange={(e) => handleFilterValue2Change(e.target.value)}
                            placeholder={
                              fieldTypes[filterKey] === 'number' ? 'Enter max...' :
                              fieldTypes[filterKey] === 'date' ? 'Select end date...' :
                              'Enter max value...'
                            }
                            className="form-control"
                            style={{ width: '150px' }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Clear Filter Button */}
                {filterKey && (
                  <button
                    onClick={clearFilter}
                    className="btn btn-secondary"
                  >
                    Clear Filter
                  </button>
                )}
                
                {/* Field Selector Button */}
                <div style={{ marginLeft: 'auto' }}>
                  <button
                    onClick={() => setShowFieldSelector(!showFieldSelector)}
                    className="btn btn-info"
                  >
                    <Settings size={16} />
                    Select Fields ({selectedFields.length})
                  </button>
                </div>
              </div>
              
              {/* Active Filter Display */}
              {filterKey && (filter || (filterOperator === 'range' && filterValue2)) && (
                <div style={{ 
                  backgroundColor: '#e3f2fd', 
                  padding: '8px 12px', 
                  borderRadius: '4px', 
                  fontSize: '0.9em',
                  color: '#1976d2',
                  border: '1px solid #bbdefb'
                }}>
                  <strong>Active Filter:</strong> {filterKey} {
                    filterOperator === 'contains' ? 'contains' :
                    filterOperator === 'equals' ? 'equals' :
                    filterOperator === 'gt' ? '>' :
                    filterOperator === 'gte' ? '>=' :
                    filterOperator === 'lt' ? '<' :
                    filterOperator === 'lte' ? '<=' :
                    filterOperator === 'range' ? 'between' :
                    filterOperator
                  } "{filter}"{filterOperator === 'range' && filterValue2 ? ` and "${filterValue2}"` : ''}
                </div>
              )}
            </div>

            {/* Field Selection Panel */}
            {showFieldSelector && (
              <div className="field-selector" style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e9ecef', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h4 style={{ margin: 0 }}>Select Fields to Display</h4>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={selectAllFields} className="btn btn-sm btn-success">Select All</button>
                    <button onClick={clearAllFields} className="btn btn-sm btn-warning">Clear All</button>
                    <button onClick={resetToDefault} className="btn btn-sm btn-info">Default (6)</button>
                    <button onClick={() => setShowFieldSelector(false)} className="btn btn-sm btn-secondary">Close</button>
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                  {availableFields.map(field => (
                    <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedFields.includes(field)}
                        onChange={() => handleFieldToggle(field)}
                      />
                      <span>{field}</span>
                    </label>
                  ))}
                </div>
                
                {selectedFields.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#dc3545', marginTop: '10px' }}>
                    ⚠️ No fields selected. Please select at least one field to display data.
                  </div>
                )}
              </div>
            )}

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
          </>
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
          ) : selectedFields.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#dc3545' }}>
              <p>No fields selected for display.</p>
              <p>Please use the "Select Fields" button above to choose which columns to show.</p>
              <button
                onClick={resetToDefault}
                className="btn btn-info"
              >
                <Settings size={16} />
                Show Default Fields
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
