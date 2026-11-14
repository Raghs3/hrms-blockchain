import { useState, useRef } from 'react';
import Modal from './Modal';
import { uploadRecord } from '../api/records';
import { useToast } from '../context/ToastContext';

const ALLOWED_EXTENSIONS = ['.txt', '.md', '.csv', '.json'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function isValidTextExtension(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function truncateHash(hash) {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * UploadRecord - Upload section with file + label fields.
 * Triggers onSuccess(uploadResult) after successful upload.
 *
 * Props:
 *   onSuccess: function(result) - Called after successful upload
 */
export default function UploadRecord({ onSuccess }) {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  function handleOpen() {
    setIsOpen(true);
    setLabel('');
    setFile(null);
    setError('');
    setUploadResult(null);
    setCopied(false);
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!isValidTextExtension(selected.name)) {
      setError('Demo supports text files only (.txt, .md, .csv, .json)');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (selected.size === 0) {
      setError('File is empty. Please select a valid file with content.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError('File exceeds the 10 MB limit. Please select a smaller file.');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError('');
    setFile(selected);
    // Autofill label if empty
    if (!label.trim()) {
      setLabel(selected.name.replace(/\.[^/.]+$/, ''));
    }
  }

  function handleCopyTxHash(hash) {
    if (!hash) return;
    navigator.clipboard?.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    if (!isValidTextExtension(file.name)) {
      setError('Demo supports text files only (.txt, .md, .csv, .json)');
      return;
    }

    if (file.size === 0) {
      setError('File is empty. Please select a valid file with content.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('File exceeds the 10 MB limit. Please select a smaller file.');
      return;
    }

    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Please enter a label for this record.');
      return;
    }
    if (trimmedLabel.length > 100) {
      setError('Record label must not exceed 100 characters.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('label', trimmedLabel);

      const result = await uploadRecord(formData);
      setUploadResult(result);
      showToast({
        type: 'success',
        title: 'Record uploaded',
        message: `Record ID: ${result.recordId}`,
      });
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      let message = err?.message || 'Upload failed. Please try again.';
      if (err?.code === 'NOT_A_PATIENT') {
        message += ' Your wallet may not be registered on the current chain. Sign out and sign in again, then retry.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary btn-lg"
        onClick={handleOpen}
        id="upload-record-btn"
      >
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2v9M4.5 5.5L8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
        Upload Record
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Upload Medical Record">
        {uploadResult ? (
          // Success state
          <div className="modal-body">
            <div className="success-block">
              <div className="success-title">Record uploaded successfully</div>
              <div className="success-detail">
                <strong>Record ID:</strong>
                <div className="hash-value" style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                  {uploadResult.recordId}
                </div>
              </div>
              <div className="success-detail" style={{ marginTop: '10px' }}>
                <strong>Transaction Hash:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="hash-value" title={uploadResult.txHash} style={{ fontFamily: 'Courier New, monospace' }}>
                    {truncateHash(uploadResult.txHash)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => handleCopyTxHash(uploadResult.txHash)}
                    aria-label="Copy transaction hash"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              {uploadResult.cid && (
                <div className="success-detail" style={{ marginTop: '10px' }}>
                  <strong>IPFS CID:</strong>
                  <div className="hash-value" style={{ wordBreak: 'break-all', fontFamily: 'Courier New, monospace' }}>
                    {uploadResult.cid}
                  </div>
                </div>
              )}
            </div>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '12px' }}>
              Uploaded: {new Date(uploadResult.uploadedAt).toLocaleString()}
            </p>
          </div>
        ) : (
          // Upload form
          <form onSubmit={handleSubmit} noValidate>
            <div className="modal-body">
              {error && (
                <div className="error-state" role="alert">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              {loading && (
                <div
                  className="upload-waiting-notice"
                  role="status"
                  style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: 'var(--radius-sm)',
                    color: '#1d4ed8',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  <span>Encrypting, storing on IPFS and confirming on-chain... this can take a few seconds</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="record-label">
                  Record Label <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="record-label"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Blood Test Report - Sept"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={loading}
                  maxLength={100}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="record-file">
                  Medical Record File (Text files only) <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div
                  className="file-input-wrapper"
                  onClick={() => !loading && fileInputRef.current?.click()}
                  onKeyDown={(e) => !loading && e.key === 'Enter' && fileInputRef.current?.click()}
                  tabIndex={loading ? -1 : 0}
                  role="button"
                  aria-label="Select text file to upload"
                  style={loading ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                >
                  <input
                    ref={fileInputRef}
                    id="record-file"
                    type="file"
                    onChange={handleFileChange}
                    disabled={loading}
                    accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
                  />
                  {file ? (
                    <div className="file-selected-name">
                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </div>
                  ) : (
                    <div className="file-input-text">
                      <strong>Click to browse</strong> or drag a file here<br />
                      <span style={{ fontSize: 'var(--font-size-xs)', marginTop: '4px', display: 'block', color: 'var(--color-text-muted)' }}>
                        Supported formats: .txt, .md, .csv, .json (max 10 MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                id="upload-submit-btn"
              >
                {loading ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    Uploading...
                  </>
                ) : (
                  'Upload Record'
                )}
              </button>
            </div>
          </form>
        )}

        {uploadResult && (
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Close
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
