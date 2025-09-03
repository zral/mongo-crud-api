import React, { useState, useRef } from 'react';
import { apiService } from '../services/api';

const BulkUploadInterface = ({ collection, onUploadComplete, onClose }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadOptions, setUploadOptions] = useState({
    updateOnDuplicate: false,
    skipValidation: false,
    batchSize: 1000
  });
  const [previewData, setPreviewData] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewData(null);
      setUploadResults(null);
      setError('');
    }
  };

  const handlePreview = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setPreviewing(true);
    setError('');

    try {
      const response = await apiService.previewBulkData(collection, selectedFile, 10);
      setPreviewData(response.data.preview);
    } catch (error) {
      setError(`Preview failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResults(null);

    try {
      const response = await apiService.uploadBulkData(collection, selectedFile, uploadOptions);
      setUploadResults(response.data.results);
      
      if (onUploadComplete) {
        onUploadComplete(response.data.results);
      }
    } catch (error) {
      setError(`Upload failed: ${error.response?.data?.message || error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await apiService.downloadTemplate(collection, true);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${collection}_template.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError(`Template download failed: ${error.response?.data?.message || error.message}`);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getSupportedFormats = () => {
    return ['.csv', '.xlsx', '.xls'];
  };

  return (
    <div className="bulk-upload-interface" style={{ padding: '20px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Bulk Upload to {collection}</h3>
        {onClose && (
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* File Selection */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Select File:
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileSelect}
            style={{ marginBottom: '10px' }}
          />
          <div style={{ fontSize: '12px', color: '#666' }}>
            Supported formats: {getSupportedFormats().join(', ')} (Max: 10MB)
          </div>
        </div>

        {selectedFile && (
          <div style={{ 
            padding: '10px', 
            background: '#f5f5f5', 
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            <strong>Selected:</strong> {selectedFile.name} ({formatFileSize(selectedFile.size)})
          </div>
        )}

        <div style={{ marginTop: '10px' }}>
          <button
            onClick={handleDownloadTemplate}
            style={{
              padding: '8px 16px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Download Template
          </button>
        </div>
      </div>

      {/* Upload Options */}
      <div style={{ marginBottom: '20px' }}>
        <h4>Upload Options:</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={uploadOptions.updateOnDuplicate}
              onChange={(e) => setUploadOptions(prev => ({
                ...prev,
                updateOnDuplicate: e.target.checked
              }))}
            />
            Update existing documents on duplicate keys
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={uploadOptions.skipValidation}
              onChange={(e) => setUploadOptions(prev => ({
                ...prev,
                skipValidation: e.target.checked
              }))}
            />
            Skip document validation (faster but less safe)
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label>Batch size:</label>
            <input
              type="number"
              value={uploadOptions.batchSize}
              onChange={(e) => setUploadOptions(prev => ({
                ...prev,
                batchSize: parseInt(e.target.value) || 1000
              }))}
              min="100"
              max="5000"
              style={{ width: '80px', padding: '4px' }}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={handlePreview}
          disabled={!selectedFile || previewing}
          style={{
            padding: '10px 20px',
            background: previewing ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: previewing ? 'not-allowed' : 'pointer'
          }}
        >
          {previewing ? 'Previewing...' : 'Preview Data'}
        </button>

        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          style={{
            padding: '10px 20px',
            background: uploading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: uploading ? 'not-allowed' : 'pointer'
          }}
        >
          {uploading ? 'Uploading...' : 'Upload Data'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          padding: '10px',
          background: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Preview Data */}
      {previewData && (
        <div style={{ marginBottom: '20px' }}>
          <h4>Preview ({previewData.totalRows} total rows):</h4>
          <div style={{ fontSize: '14px', marginBottom: '10px', color: '#666' }}>
            File: {previewData.fileName} | Size: {formatFileSize(previewData.fileSize)} | 
            Type: {previewData.fileType} | Columns: {previewData.columns.length}
          </div>
          
          <div style={{ 
            maxHeight: '300px', 
            overflow: 'auto', 
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  {previewData.columns.map((col, index) => (
                    <th key={index} style={{ 
                      padding: '8px', 
                      border: '1px solid #ddd',
                      textAlign: 'left',
                      fontWeight: 'bold'
                    }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.preview.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {previewData.columns.map((col, colIndex) => (
                      <td key={colIndex} style={{ 
                        padding: '8px', 
                        border: '1px solid #ddd',
                        fontSize: '12px'
                      }}>
                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && (
        <div style={{ marginBottom: '20px' }}>
          <h4>Upload Results:</h4>
          <div style={{ 
            padding: '15px', 
            background: '#d4edda', 
            border: '1px solid #c3e6cb',
            borderRadius: '4px'
          }}>
            <div><strong>Total Records:</strong> {uploadResults.totalRecords}</div>
            <div><strong>Inserted:</strong> {uploadResults.insertedCount}</div>
            <div><strong>Modified:</strong> {uploadResults.modifiedCount}</div>
            <div><strong>Errors:</strong> {uploadResults.errors.length}</div>
            <div><strong>Duplicates:</strong> {uploadResults.duplicates.length}</div>
          </div>

          {uploadResults.errors.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <h5>Errors:</h5>
              <div style={{ 
                maxHeight: '150px', 
                overflow: 'auto', 
                background: '#f8d7da',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {uploadResults.errors.map((error, index) => (
                  <div key={index}>
                    Row {error.index + 1}: {error.error}
                  </div>
                ))}
              </div>
            </div>
          )}

          {uploadResults.duplicates.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <h5>Duplicates:</h5>
              <div style={{ 
                maxHeight: '150px', 
                overflow: 'auto', 
                background: '#fff3cd',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                {uploadResults.duplicates.map((duplicate, index) => (
                  <div key={index}>
                    Row {duplicate.index + 1}: {duplicate.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BulkUploadInterface;
