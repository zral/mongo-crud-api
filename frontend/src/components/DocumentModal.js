import React, { useState, useEffect } from 'react';
import { X, Save, Eye } from 'lucide-react';

const DocumentModal = ({ isOpen, mode, document, collection, onClose, onSave }) => {
  const [documentData, setDocumentData] = useState('');
  const [isValidJson, setIsValidJson] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        setDocumentData('{\n  \n}');
      } else if (document) {
        // Remove MongoDB internal fields for editing
        const cleanDocument = { ...document };
        if (mode === 'edit') {
          delete cleanDocument._id;
          delete cleanDocument.createdAt;
          delete cleanDocument.updatedAt;
        }
        setDocumentData(JSON.stringify(cleanDocument, null, 2));
      }
      setError('');
    }
  }, [isOpen, mode, document]);

  const validateJson = (jsonString) => {
    try {
      JSON.parse(jsonString);
      setIsValidJson(true);
      setError('');
      return true;
    } catch (e) {
      setIsValidJson(false);
      setError(`Invalid JSON: ${e.message}`);
      return false;
    }
  };

  const handleDocumentChange = (value) => {
    setDocumentData(value);
    validateJson(value);
  };

  const handleSave = () => {
    if (!isValidJson) {
      setError('Please fix JSON syntax errors before saving');
      return;
    }

    try {
      const parsedData = JSON.parse(documentData);
      onSave(parsedData);
    } catch (e) {
      setError(`Error parsing JSON: ${e.message}`);
    }
  };

  const getModalTitle = () => {
    switch (mode) {
      case 'create':
        return `Create New Document in ${collection}`;
      case 'edit':
        return `Edit Document in ${collection}`;
      case 'view':
        return `View Document in ${collection}`;
      default:
        return 'Document';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3 className="modal-title">{getModalTitle()}</h3>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="error">
              {error}
            </div>
          )}

          <div className="form-group">
            <label>Document Data (JSON)</label>
            <textarea
              className={`json-editor ${!isValidJson ? 'error' : ''}`}
              value={documentData}
              onChange={(e) => handleDocumentChange(e.target.value)}
              readOnly={mode === 'view'}
              placeholder="Enter JSON document data..."
              rows={15}
            />
          </div>

          {mode === 'view' && document && (
            <div className="form-group">
              <label>Document Metadata</label>
              <div style={{ 
                background: '#f8fafc', 
                padding: '1rem', 
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#64748b'
              }}>
                <p><strong>ID:</strong> {document._id}</p>
                {document.createdAt && (
                  <p><strong>Created:</strong> {new Date(document.createdAt).toLocaleString()}</p>
                )}
                {document.updatedAt && (
                  <p><strong>Updated:</strong> {new Date(document.updatedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ 
          display: 'flex', 
          justifyContent: 'flex-end', 
          gap: '1rem',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #e2e8f0'
        }}>
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          
          {mode !== 'view' && (
            <button 
              onClick={handleSave} 
              className="btn btn-primary"
              disabled={!isValidJson}
            >
              <Save size={16} />
              {mode === 'create' ? 'Create' : 'Update'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentModal;
