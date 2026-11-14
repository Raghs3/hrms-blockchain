import { useState, useEffect } from 'react';
import LoadingState from './LoadingState';
import { checkAccess, viewRecord } from '../api/records';

/**
 * Checks whether content is printable plain text.
 * Returns false if it contains non-printable binary characters or binary headers.
 */
function isPrintableText(content) {
  if (typeof content !== 'string') return false;
  if (content.startsWith('%PDF-')) return false;
  // Non-printable control characters excluding standard whitespace (\t, \n, \r)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content)) {
    return false;
  }
  return true;
}

/**
 * RecordLookup - Self-contained component for Doctor record lookup,
 * access verification, secure plaintext viewing, and recent session history.
 *
 * Props:
 *   sessionHistory: {
 *     lookups: Array<{ id: string, result: 'GRANTED' | 'DENIED', timestamp: string }>,
 *     addLookup: Function,
 *     updateLookupResult: Function,
 *     recordViewSuccess: Function,
 *   }
 */
export default function RecordLookup({ sessionHistory }) {
  const { lookups, addLookup, updateLookupResult, recordViewSuccess } = sessionHistory;

  const [recordId, setRecordId] = useState('');
  const [validationError, setValidationError] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [accessResult, setAccessResult] = useState(null); // { authorized: boolean } | null

  const [viewLoading, setViewLoading] = useState(false);
  const [viewError, setViewError] = useState('');
  const [recordData, setRecordData] = useState(null); // { recordId, label, content } | null

  // Privacy requirement: Clear displayed record content on unmount
  useEffect(() => {
    return () => {
      setRecordData(null);
    };
  }, []);

  function handleInputChange(e) {
    const value = e.target.value;
    setRecordId(value);
    setValidationError('');
    setCheckError('');
    setViewError('');
    // Privacy requirement: Clear displayed content when ID input changes
    setRecordData(null);
    if (accessResult !== null) {
      setAccessResult(null);
    }
  }

  function handleSelectRecent(id) {
    setRecordId(id);
    setValidationError('');
    setCheckError('');
    setViewError('');
    // Privacy requirement: Clear displayed content when new ID is selected
    setRecordData(null);
    setAccessResult(null);
  }

  function handleHideRecord() {
    // Privacy requirement: Hide record button
    setRecordData(null);
  }

  async function handleCheckAccess(e) {
    e.preventDefault();
    setValidationError('');
    setCheckError('');
    setViewError('');
    // Privacy requirement: Clear displayed content when a new check starts
    setRecordData(null);
    setAccessResult(null);

    const trimmed = recordId.trim();

    if (!trimmed) {
      setValidationError('Enter a numeric record ID');
      return;
    }

    if (!/^\d+$/.test(trimmed)) {
      setValidationError('Enter a numeric record ID');
      return;
    }

    setCheckLoading(true);
    try {
      const result = await checkAccess(trimmed);
      setAccessResult(result);

      if (result?.authorized) {
        addLookup(trimmed, 'GRANTED');
      } else {
        // Privacy requirement: Clear displayed content when access turns out to be denied
        setRecordData(null);
        addLookup(trimmed, 'DENIED');
      }
    } catch (err) {
      // Privacy requirement: Clear displayed content on error/denied
      setRecordData(null);
      setCheckError(
        err?.message || 'Failed to check access. Please verify the Record ID and try again.'
      );
    } finally {
      setCheckLoading(false);
    }
  }

  async function handleViewRecord() {
    setViewError('');
    setRecordData(null);
    setViewLoading(true);

    const trimmed = recordId.trim();

    try {
      const data = await viewRecord(trimmed);
      setRecordData(data);
      recordViewSuccess();
    } catch (err) {
      const isAccessDenied = err?.status === 403 || err?.code === 'ACCESS_DENIED';
      if (isAccessDenied) {
        // Access revoked between check and view:
        // Flip badge to DENIED and display distinct revocation message
        setAccessResult({ authorized: false });
        updateLookupResult(trimmed, 'DENIED');
        setViewError('Access was revoked. You no longer have permission to view this record.');
      } else if (err?.code === 'INTEGRITY_CHECK_FAILED') {
        setViewError(
          'Record integrity check failed. The decrypted content does not match the blockchain hash.'
        );
      } else if (err?.code === 'RECORD_NOT_FOUND' || err?.status === 404) {
        setViewError('The requested record could not be found.');
      } else {
        setViewError(err?.message || 'Failed to retrieve record content. Please try again.');
      }
    } finally {
      setViewLoading(false);
    }
  }

  const isPending = checkLoading || viewLoading;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <h2>Check Record Access</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Enter a numeric record ID to verify access permissions on the blockchain.
          </p>
        </div>
      </div>
      <div className="card-body">
        {/* Lookup form */}
        <form onSubmit={handleCheckAccess}>
          <div className="lookup-section">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label" htmlFor="record-id-input">
                Record ID
              </label>
              <input
                id="record-id-input"
                type="text"
                className="form-control"
                placeholder="Enter numeric Record ID (e.g. 1)"
                value={recordId}
                onChange={handleInputChange}
                disabled={isPending}
                spellCheck="false"
                autoComplete="off"
              />
            </div>
            <div>
              <button
                type="submit"
                className="btn btn-primary btn-lg"
                disabled={isPending}
                id="check-access-btn"
              >
                {checkLoading ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    Checking...
                  </>
                ) : (
                  'Check Access'
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Validation error */}
        {validationError && (
          <div className="error-state" role="alert" style={{ marginTop: '12px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {validationError}
          </div>
        )}

        {/* Server check error */}
        {checkError && (
          <div className="error-state" role="alert" style={{ marginTop: '12px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {checkError}
          </div>
        )}

        {/* Access result badge panel */}
        {accessResult !== null && !checkLoading && (
          <div
            className={`access-result ${
              accessResult.authorized ? 'access-result-granted' : 'access-result-denied'
            }`}
            role="status"
            aria-live="polite"
            id="access-result-panel"
            style={{ marginTop: '18px' }}
          >
            {accessResult.authorized ? (
              <>
                <div className="access-result-title">
                  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M6 10l3 3 5-5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  ACCESS GRANTED
                </div>
                <div className="access-result-desc">
                  You are authorized to view this record (
                  <strong style={{ fontFamily: 'Courier New, monospace' }}>{recordId.trim()}</strong>).
                </div>

                {/* View Record action area */}
                <div style={{ marginTop: '16px' }}>
                  {viewLoading ? (
                    <LoadingState message="Retrieving record from IPFS..." />
                  ) : (
                    <>
                      {viewError && (
                        <div
                          className="error-state"
                          role="alert"
                          style={{ marginBottom: '12px' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          {viewError}
                        </div>
                      )}
                      {!recordData && (
                        <button
                          type="button"
                          className="btn btn-primary btn-lg"
                          onClick={handleViewRecord}
                          disabled={isPending}
                          id="view-record-btn"
                        >
                          View Record
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="access-result-title">
                  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path
                      d="M7 7l6 6M13 7l-6 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  ACCESS DENIED
                </div>
                <div className="access-result-desc">
                  {viewError ? (
                    <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-danger)' }}>
                      {viewError}
                    </span>
                  ) : (
                    'You are not authorized to view this record. Access may have been revoked by the patient or was never granted.'
                  )}
                </div>
                <div
                  style={{
                    marginTop: '10px',
                    fontSize: '0.8125rem',
                    color: 'var(--color-danger)',
                    opacity: 0.85,
                  }}
                >
                  Consent permissions are verified against the Ethereum smart contract audit registry.
                </div>
              </>
            )}
          </div>
        )}

        {/* Record content viewer */}
        {recordData && (
          <div
            className="record-viewer"
            id="record-viewer"
            aria-label="Record content"
            style={{ marginTop: '20px' }}
          >
            <div className="record-viewer-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="record-label">{recordData.label || 'Medical Record'}</div>
                <div className="record-id">Record #{recordData.recordId}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="badge badge-authorized">Authorized</span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleHideRecord}
                  id="hide-record-btn"
                  title="Hide record content"
                >
                  Hide record
                </button>
              </div>
            </div>

            {/* Cryptographic Integrity Callout */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'var(--color-success-bg)',
                borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
                fontSize: '0.75rem',
                color: 'var(--color-success-dark)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>
                <strong>Integrity Verified:</strong> Plaintext matches on-chain SHA-256 file hash in <code>RecordRegistry.sol</code>
              </span>
            </div>

            <div className="record-viewer-body">
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-muted)',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                Record Content
              </div>
              {isPrintableText(recordData.content) ? (
                <pre
                  className="record-content-text"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {recordData.content}
                </pre>
              ) : (
                <div
                  className="preview-not-supported"
                  style={{
                    padding: '16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-secondary)',
                    border: '1px solid var(--color-border-light)',
                    fontSize: '0.9375rem',
                  }}
                >
                  Preview not supported in this demo
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent lookups (this session) */}
        <div
          className="recent-lookups-container"
          style={{
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid var(--color-border-light)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 'var(--font-weight-semibold)', margin: 0 }}>
              Recent lookups (this session)
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              In-memory session log
            </span>
          </div>

          {lookups.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
              No lookups performed yet in this session.
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {lookups.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontFamily: 'Courier New, monospace',
                        fontWeight: 'var(--font-weight-semibold)',
                        fontSize: '0.875rem',
                      }}
                    >
                      Record #{item.id}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 'var(--font-weight-bold)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor:
                          item.result === 'GRANTED'
                            ? 'var(--color-success-bg)'
                            : 'var(--color-danger-bg)',
                        color:
                          item.result === 'GRANTED'
                            ? 'var(--color-success)'
                            : 'var(--color-danger)',
                      }}
                    >
                      {item.result}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {item.timestamp}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleSelectRecent(item.id)}
                    disabled={isPending}
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    Load ID
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

