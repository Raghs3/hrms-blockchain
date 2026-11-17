import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadRecord } from '../api/records';
import { getErrorMessage } from '../api/errors';
import { useToast } from '../context/ToastContext';
import { useAuditTrail } from '../context/AuditTrailContext';

const ALLOWED_EXTENSIONS = ['.txt', '.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function isValidExtension(filename) {
  if (!filename) return false;
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatFileSize(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileTypeDescription(filename) {
  if (!filename) return 'Unknown';
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return 'PDF Document';
  if (lower.endsWith('.png')) return 'PNG Image';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'JPEG Image';
  if (lower.endsWith('.doc')) return 'Word Document (.doc)';
  if (lower.endsWith('.docx')) return 'Word Document (.docx)';
  if (lower.endsWith('.txt')) return 'Plain Text';
  return 'File';
}

function truncateHash(hash) {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * UploadRecordForm - Reusable inline upload form for medical records.
 *
 * Props:
 *   onSuccess: function(result) - Optional callback on successful upload
 */
export default function UploadRecordForm({ onSuccess }) {
  const { showToast } = useToast();
  const { addAuditEvent } = useAuditTrail();
  const navigate = useNavigate();

  const [label, setLabel] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  function resetForm() {
    setLabel('');
    setFile(null);
    setError('');
    setUploadResult(null);
    setCopied(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!isValidExtension(selected.name)) {
      setError('Unsupported file type. Supported formats are PDF, PNG, JPG/JPEG, DOC, DOCX, and TXT.');
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

    if (!isValidExtension(file.name)) {
      setError('Unsupported file type. Supported formats are PDF, PNG, JPG/JPEG, DOC, DOCX, and TXT.');
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
      addAuditEvent({
        type: 'RECORD_UPLOADED',
        recordId: result.recordId,
        label: trimmedLabel,
        cid: result.cid,
        txHash: result.txHash,
        timestamp: result.uploadedAt || new Date().toISOString(),
      });
      showToast({
        type: 'success',
        title: 'Record uploaded',
        message: `Record ID: ${result.recordId}`,
      });
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      let message = getErrorMessage(err?.code, err?.message || 'Upload failed. Please try again.');
      if (err?.code === 'NOT_A_PATIENT') {
        message += ' Your wallet may not be registered on the current chain. Sign out and sign in again, then retry.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (uploadResult) {
    return (
      <div className="card" style={{ maxWidth: '640px' }}>
        <div className="card-header">
          <div>
            <h2>Record Uploaded Successfully</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Your healthcare record is encrypted, stored on IPFS, and registered on the blockchain.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div className="success-block" style={{ padding: '20px' }}>
            <div className="success-detail">
              <strong>Record ID:</strong>
              <div
                className="hash-value"
                style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--color-primary)', marginTop: '4px' }}
              >
                {uploadResult.recordId}
              </div>
            </div>

            <div className="success-detail" style={{ marginTop: '14px' }}>
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
              <div className="success-detail" style={{ marginTop: '14px' }}>
                <strong>IPFS CID:</strong>
                <div
                  className="hash-value"
                  title={uploadResult.cid}
                  style={{ fontFamily: 'Courier New, monospace', fontSize: '0.8125rem', marginTop: '4px' }}
                >
                  {uploadResult.cid}
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={resetForm}
              id="upload-another-btn"
            >
              Upload another
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/patient/records')}
              id="view-records-btn"
            >
              View my records
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: '640px' }}>
      <div className="card-header">
        <div>
          <h2>Upload Medical Record</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Supported formats: PDF, PNG, JPG, DOC, DOCX, TXT up to 10 MB.
          </p>
        </div>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="error-state" role="alert" style={{ marginBottom: '16px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {error}
            </div>
          )}

          {/* File Picker */}
          <div className="form-group">
            <label className="form-label" htmlFor="file-input-field">
              Medical File
            </label>
            <input
              ref={fileInputRef}
              id="file-input-field"
              type="file"
              accept=".txt,.pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={handleFileChange}
              disabled={loading}
              className="form-control"
              style={{ padding: '8px' }}
            />
            {file && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--color-surface-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  File: <strong>{file.name}</strong>
                </div>
                <div>
                  Type: <span className="badge" style={{ fontSize: '0.75rem', padding: '2px 6px' }}>{getFileTypeDescription(file.name)}</span>
                </div>
                <div>
                  Size: <strong>{formatFileSize(file.size)}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Label Input */}
          <div className="form-group">
            <label className="form-label" htmlFor="record-label-field">
              Record Label
            </label>
            <input
              id="record-label-field"
              type="text"
              className="form-control"
              placeholder="e.g. Annual Bloodwork 2026"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={loading}
              maxLength={100}
            />
            <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              A descriptive title to identify this record ({label.length}/100)
            </div>
          </div>

          {/* Multi-step loading indicator */}
          {loading && (
            <div
              style={{
                padding: '16px',
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-light)',
                marginBottom: '16px',
              }}
              role="status"
              aria-live="polite"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span className="spinner spinner-sm" aria-hidden="true" />
                <strong style={{ fontSize: '0.875rem' }}>Processing Healthcare Record...</strong>
              </div>
              <ul style={{ margin: 0, paddingLeft: '24px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.8' }}>
                <li>Encrypting medical file with AES-256-GCM...</li>
                <li>Pinning ciphertext to IPFS node...</li>
                <li>Confirming transaction on Ethereum blockchain...</li>
              </ul>
            </div>
          )}

          {/* Submit Action */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              id="submit-upload-btn"
            >
              {loading ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  Uploading to Blockchain...
                </>
              ) : (
                'Upload Record'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

