import { useState, useEffect } from 'react';
import Modal from './Modal';
import LoadingState from './LoadingState';
import RecordContentViewer, { downloadRecordContent, verifyRecordIntegrity } from './RecordContentViewer';
import { viewRecord } from '../api/records';
import { getErrorMessage } from '../api/errors';

function truncateMiddle(str, front = 10, back = 8) {
  if (!str) return '—';
  if (str.length <= front + back) return str;
  return `${str.slice(0, front)}...${str.slice(-back)}`;
}

/**
 * ViewRecordModal - Modal for viewing and downloading decrypted medical record content.
 * Reusable for Patients viewing their own records, with cryptographic integrity callout.
 */
export default function ViewRecordModal({ isOpen, onClose, record }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recordData, setRecordData] = useState(null);
  const [integrityVerified, setIntegrityVerified] = useState(true);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedCid, setCopiedCid] = useState(false);
  const [copiedOwner, setCopiedOwner] = useState(false);

  useEffect(() => {
    if (!isOpen || !record?.recordId) {
      setRecordData(null);
      setError('');
      setLoading(false);
      setIntegrityVerified(true);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');
    setRecordData(null);

    viewRecord(record.recordId)
      .then(async (data) => {
        if (!isMounted) return;
        setRecordData(data);
        const hashToVerify = record?.fileHash || data?.fileHash;
        if (hashToVerify) {
          const result = await verifyRecordIntegrity(data.content, data.encoding, hashToVerify);
          if (isMounted) {
            setIntegrityVerified(result.verified);
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        const msg = getErrorMessage(err?.code, err?.message || 'Failed to retrieve and decrypt record.');
        setError(msg);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      setRecordData(null);
    };
  }, [isOpen, record?.recordId, record?.fileHash]);

  function handleCopy(text, setCopiedFn) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedFn(true);
    setTimeout(() => setCopiedFn(false), 2000);
  }

  function handleDownloadClick() {
    if (!recordData?.content) return;
    const defaultExt =
      recordData.mimeType === 'application/pdf'
        ? '.pdf'
        : recordData.mimeType === 'image/png'
        ? '.png'
        : recordData.mimeType === 'image/jpeg'
        ? '.jpg'
        : recordData.mimeType === 'application/msword'
        ? '.doc'
        : recordData.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ? '.docx'
        : '.txt';

    const filename =
      recordData.originalFileName ||
      `${(recordData.label || record?.label || 'medical-record').replace(/[^a-zA-Z0-9_-]/g, '_')}${defaultExt}`;
    downloadRecordContent(recordData.content, filename, recordData.mimeType, recordData.encoding);
  }

  const effectiveFileHash = record?.fileHash || recordData?.fileHash;
  const effectiveCid = record?.cid || recordData?.cid;
  const effectiveOwner = recordData?.owner || record?.owner;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={record?.label || recordData?.label || 'Medical Record Viewer'}
      size="lg"
    >
      <div className="modal-body" style={{ padding: '20px' }}>
        {loading && (
          <div style={{ padding: '30px 0' }}>
            <LoadingState message="Decrypting record from IPFS and verifying SHA-256 hash on-chain..." />
          </div>
        )}

        {error && (
          <div className="error-state" role="alert" style={{ marginBottom: '16px', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {!loading && !error && recordData && (
          <div>
            {/* Metadata Summary Card */}
            <div
              style={{
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-light)',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                fontSize: '0.8125rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Record ID</span>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>#{recordData.recordId}</span>
              </div>

              {effectiveOwner && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>Patient Owner</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace' }} title={effectiveOwner}>
                      {truncateMiddle(effectiveOwner, 6, 4)}
                    </span>
                    <button
                      type="button"
                      className="btn-copy"
                      onClick={() => handleCopy(effectiveOwner, setCopiedOwner)}
                      title="Copy owner address"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {copiedOwner ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>Copied!</span>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {effectiveCid && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>IPFS CID</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace' }} title={effectiveCid}>
                      {truncateMiddle(effectiveCid, 6, 4)}
                    </span>
                    <button
                      type="button"
                      className="btn-copy"
                      onClick={() => handleCopy(effectiveCid, setCopiedCid)}
                      title="Copy IPFS CID"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {copiedCid ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>Copied!</span>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {effectiveFileHash && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>SHA-256 On-Chain Hash</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace' }} title={effectiveFileHash}>
                      {truncateMiddle(effectiveFileHash, 6, 4)}
                    </span>
                    <button
                      type="button"
                      className="btn-copy"
                      onClick={() => handleCopy(effectiveFileHash, setCopiedHash)}
                      title="Copy SHA-256 hash"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {copiedHash ? (
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-success)' }}>Copied!</span>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {recordData.mimeType && (
                <div>
                  <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.75rem' }}>File Format</span>
                  <span style={{ fontWeight: 600 }}>
                    {recordData.mimeType === 'application/pdf'
                      ? 'PDF Document'
                      : recordData.mimeType === 'image/png'
                      ? 'PNG Image'
                      : recordData.mimeType === 'image/jpeg'
                      ? 'JPEG Image'
                      : recordData.mimeType === 'application/msword'
                      ? 'Word (.doc)'
                      : recordData.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                      ? 'Word (.docx)'
                      : 'Plain Text'}
                  </span>
                </div>
              )}
            </div>

            {/* Cryptographic Integrity Callout */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                backgroundColor: integrityVerified ? 'var(--color-success-bg)' : 'rgba(239, 68, 68, 0.1)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                color: integrityVerified ? 'var(--color-success-dark)' : 'var(--color-danger)',
                marginBottom: '14px',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>
                {integrityVerified ? (
                  <>
                    <strong>Integrity Verified:</strong> Decrypted content matches the on-chain SHA-256 integrity hash stored in <code>RecordRegistry.sol</code>.
                  </>
                ) : (
                  <>
                    <strong>Integrity Mismatch:</strong> Decrypted content does not match the on-chain SHA-256 hash.
                  </>
                )}
              </span>
            </div>

            {/* Content Display */}
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                  marginBottom: '6px',
                  letterSpacing: '0.05em',
                }}
              >
                Decrypted Medical Content
              </div>
              <RecordContentViewer
                content={recordData.content}
                encoding={recordData.encoding}
                mimeType={recordData.mimeType}
                originalFileName={recordData.originalFileName}
                sizeBytes={recordData.sizeBytes}
                label={recordData.label || record?.label}
                onDownload={handleDownloadClick}
              />
            </div>
          </div>
        )}
      </div>

      <div
        className="modal-footer"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          borderTop: '1px solid var(--color-border-light)',
          backgroundColor: '#fafbfc',
        }}
      >
        <div>
          {recordData?.content && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadClick}
              id="download-record-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download Record
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onClose}
          id="close-viewer-btn"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
