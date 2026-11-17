import { useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import GrantAccessModal from './GrantAccessModal';
import RevokeAccessModal from './RevokeAccessModal';
import ViewRecordModal from './ViewRecordModal';
import { describeExpiry } from './consentFormat';

function truncateHash(hash) {
  if (!hash) return '—';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function getFileBadgeInfo(mimeType) {
  if (!mimeType || mimeType === 'text/plain') {
    return { label: 'Text', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
  }
  if (mimeType === 'application/pdf') {
    return { label: 'PDF', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
  }
  if (mimeType.startsWith('image/')) {
    return { label: 'Image', bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return { label: 'Word', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
  }
  return { label: 'File', bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
}

function truncateFileName(name, maxLen = 22) {
  if (!name) return '';
  if (name.length <= maxLen) return name;
  const extIndex = name.lastIndexOf('.');
  if (extIndex > 0 && name.length - extIndex <= 6) {
    const ext = name.slice(extIndex);
    const base = name.slice(0, extIndex);
    const keepChars = maxLen - ext.length - 3;
    if (keepChars > 3) {
      return `${base.slice(0, keepChars)}...${ext}`;
    }
  }
  return `${name.slice(0, maxLen - 3)}...`;
}

/**
 * RecordTable - Patient's record list as a professional data table.
 *
 * Props:
 *   records: array of record objects (sorted newest-first)
 *   loading: boolean
 *   error: string
 *   onRecordUpdate: function - Called when a record is updated (grant/revoke)
 *   onRetry: function - Called to retry loading records on error
 *   mode: 'records' | 'access' | 'preview' | 'all' (default: 'all')
 */
export default function RecordTable({
  records = [],
  loading,
  error,
  onRecordUpdate,
  onRetry,
  mode = 'all',
}) {
  const [viewingRecord, setViewingRecord] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  function handleCopy(text, key) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return <LoadingState message="Loading healthcare records from blockchain..." />;
  }

  if (error) {
    return (
      <div
        className="error-state"
        role="alert"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRetry}
            style={{ marginLeft: 'auto' }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <EmptyState
        title="No healthcare records yet"
        description="Upload your first medical record to get started with secure blockchain storage and doctor consent."
        action={
          <Link to="/patient/upload" className="btn btn-primary" id="upload-first-record-link">
            Upload your first record
          </Link>
        }
      />
    );
  }

  const displayedRecords = mode === 'preview' ? records.slice(0, 3) : records;

  return (
    <div className="table-wrapper">
      <table className="data-table" aria-label="Patient medical records">
        <thead>
          <tr>
            <th scope="col">Record</th>
            <th scope="col">Uploaded</th>
            {mode === 'records' && <th scope="col">IPFS CID</th>}
            {(mode === 'access' || mode === 'all') && <th scope="col">Authorized Doctors</th>}
            <th scope="col">Status</th>
            <th scope="col">{mode === 'records' || mode === 'preview' ? 'Access' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody>
          {displayedRecords.map((record) => {
            const hasDoctors = Array.isArray(record.authorizedDoctors) && record.authorizedDoctors.length > 0;
            return (
              <tr key={record.recordId}>
                {/* Record info */}
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="table-cell-primary">{record.label || 'Untitled Record'}</span>
                    {(() => {
                      const badge = getFileBadgeInfo(record.mimeType);
                      return (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.675rem',
                            padding: '1px 6px',
                            backgroundColor: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            fontWeight: 600,
                          }}
                          title={`Format: ${record.mimeType || 'text/plain'}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span className="table-cell-secondary" style={{ fontFamily: 'Courier New, monospace' }}>
                      ID: #{record.recordId}
                    </span>
                    {record.originalFileName && (
                      <span
                        style={{
                          fontSize: '0.725rem',
                          color: 'var(--color-text-muted)',
                        }}
                        title={`Original File: ${record.originalFileName}`}
                      >
                        📄 {truncateFileName(record.originalFileName)}
                      </span>
                    )}
                    {mode !== 'records' && record.fileHash && (
                      <span
                        style={{
                          fontSize: '0.725rem',
                          fontFamily: 'ui-monospace, monospace',
                          color: 'var(--color-text-muted)',
                        }}
                        title={`SHA-256: ${record.fileHash}`}
                      >
                        SHA-256: {truncateHash(record.fileHash)}
                      </span>
                    )}
                  </div>
                </td>

                {/* Date */}
                <td>
                  <div className="table-cell-primary">{formatDate(record.uploadedAt)}</div>
                </td>

                {/* IPFS CID column (for records mode) */}
                {mode === 'records' && (
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>CID:</span>
                        <span
                          style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem' }}
                          title={record.cid}
                        >
                          {truncateHash(record.cid)}
                        </span>
                        <button
                          type="button"
                          className="btn-copy"
                          onClick={() => handleCopy(record.cid, `cid-${record.recordId}`)}
                          title="Copy IPFS CID"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          {copiedKey === `cid-${record.recordId}` ? (
                            <span style={{ fontSize: '0.675rem', color: 'var(--color-success)' }}>Copied!</span>
                          ) : (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                          )}
                        </button>
                      </div>

                      {record.fileHash && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>SHA-256:</span>
                          <span
                            style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem' }}
                            title={record.fileHash}
                          >
                            {truncateHash(record.fileHash)}
                          </span>
                          <button
                            type="button"
                            className="btn-copy"
                            onClick={() => handleCopy(record.fileHash, `hash-${record.recordId}`)}
                            title="Copy SHA-256 on-chain hash"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            {copiedKey === `hash-${record.recordId}` ? (
                              <span style={{ fontSize: '0.675rem', color: 'var(--color-success)' }}>Copied!</span>
                            ) : (
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      )}

                      <span
                        className="badge"
                        style={{
                          fontSize: '0.675rem',
                          padding: '2px 6px',
                          alignSelf: 'flex-start',
                          backgroundColor: 'var(--color-success-bg)',
                          color: 'var(--color-success)',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="SHA-256 integrity hash is anchored on the Ethereum blockchain via RecordRegistry.sol"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        SHA-256 On-Chain Verified
                      </span>
                    </div>
                  </td>
                )}

                {/* Authorized doctors (for access / all modes) */}
                {(mode === 'access' || mode === 'all') && (
                  <td>
                    {hasDoctors ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {record.authorizedDoctors.map((doc) => (
                          <div key={doc.walletAddress} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="doctor-chip" title={doc.walletAddress}>
                              {doc.name || `${doc.walletAddress.slice(0, 6)}...${doc.walletAddress.slice(-4)}`}
                            </span>
                            {(doc.purpose || doc.expiresAt) && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                {doc.purpose}
                                {doc.purpose ? ' · ' : ''}
                                {describeExpiry(doc.expiresAt)}
                              </span>
                            )}
                            <RevokeAccessModal
                              record={record}
                              doctor={doc}
                              onSuccess={() => onRecordUpdate && onRecordUpdate()}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="no-doctors" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        No doctors authorized
                      </span>
                    )}
                  </td>
                )}

                {/* Status Badge */}
                <td>
                  {hasDoctors ? (
                    <span className="badge badge-authorized">Authorized</span>
                  ) : (
                    <span className="badge badge-neutral">Private</span>
                  )}
                </td>

                {/* Actions / Access Link */}
                <td>
                  <div className="table-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setViewingRecord(record)}
                      id={`view-record-${record.recordId}`}
                      title="View decrypted record content"
                    >
                      View
                    </button>
                    {mode === 'records' || mode === 'preview' ? (
                      <Link
                        to="/patient/access"
                        className="btn btn-secondary btn-sm"
                        id={`manage-access-${record.recordId}`}
                      >
                        Manage access
                      </Link>
                    ) : (
                      <GrantAccessModal
                        record={record}
                        onSuccess={() => onRecordUpdate && onRecordUpdate()}
                      />
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Reusable View Record Modal */}
      <ViewRecordModal
        isOpen={Boolean(viewingRecord)}
        onClose={() => setViewingRecord(null)}
        record={viewingRecord}
      />
    </div>
  );
}
