import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingState from '../../components/LoadingState';
import EmptyState from '../../components/EmptyState';
import ViewRecordModal from '../../components/ViewRecordModal';
import { useAuth } from '../../context/AuthContext';
import { useDoctorSession } from '../../context/DoctorSessionContext';
import { getSharedWithMe } from '../../api/records';
import useDocumentTitle from '../../hooks/useDocumentTitle';

function truncate(str, head = 6, tail = 4) {
  if (!str) return '—';
  if (str.length <= head + tail) return str;
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}

/**
 * DoctorOverview - /doctor
 * Doctor portal overview dashboard displaying active session metrics,
 * real on-chain records shared with the doctor (primary), manual lookup (secondary),
 * and recent session lookups tracker (fallback).
 */
export default function DoctorOverview() {
  useDocumentTitle('Overview');
  const { walletAddress } = useAuth();
  const { viewedCount, lastLookup, lookups, addLookup, recordViewSuccess } = useDoctorSession();

  const [sharedRecords, setSharedRecords] = useState([]);
  const [loadingShared, setLoadingShared] = useState(true);
  const [sharedError, setSharedError] = useState('');
  const [isRpcError, setIsRpcError] = useState(false);
  const [selectedRecordForView, setSelectedRecordForView] = useState(null);
  const [copiedKey, setCopiedKey] = useState('');

  const fetchSharedRecords = useCallback(async () => {
    setLoadingShared(true);
    setSharedError('');
    setIsRpcError(false);
    try {
      const data = await getSharedWithMe();
      setSharedRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      const isRpc = err?.code === 'RPC_ERROR' || err?.status === 503;
      setIsRpcError(isRpc);
      setSharedError(
        isRpc
          ? 'The blockchain RPC network is currently unavailable. Please verify that your local node is running and retry.'
          : err?.message || 'Failed to load accessible records from blockchain.'
      );
    } finally {
      setLoadingShared(false);
    }
  }, []);

  useEffect(() => {
    fetchSharedRecords();
  }, [fetchSharedRecords]);

  function handleCopy(text, key) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  }

  function handleOpenRecord(record) {
    addLookup(record.recordId, 'GRANTED');
    recordViewSuccess();
    setSelectedRecordForView(record);
  }

  return (
    <Layout>
      {/* Page Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div className="page-header-left">
          <h1>Doctor Overview</h1>
          <p className="page-description">
            Access healthcare records that patients have authorized you to view on the blockchain.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={fetchSharedRecords}
            disabled={loadingShared}
            title="Refresh shared records from blockchain"
            id="refresh-shared-records-header-btn"
          >
            {loadingShared ? 'Querying Chain...' : 'Refresh Records'}
          </button>
          <Link to="/doctor/lookup" className="btn btn-primary" id="go-to-lookup-header-btn">
            Record Lookup
          </Link>
        </div>
      </div>

      {/* Doctor Summary Metrics */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Shared Records</span>
            <div
              className="summary-card-icon"
              style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{sharedRecords.length}</div>
          <div className="summary-card-sub">Active patient grants</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Records Viewed</span>
            <div className="summary-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.6" />
                <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{viewedCount}</div>
          <div className="summary-card-sub">This session</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Access Control</span>
            <div
              className="summary-card-icon"
              style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M7 9V6a3 3 0 116 0v3" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value" style={{ fontSize: '1.25rem', color: 'var(--color-accent)' }}>
            Zero-Trust RBAC
          </div>
          <div className="summary-card-sub">On-chain consent enforcement</div>
        </div>
      </div>

      {/* Connected wallet info bar */}
      <div className="info-bar" aria-label="Connected wallet information">
        <div className="info-bar-left">
          <span className="info-label">Doctor Wallet Address</span>
          <span className="info-value" title={walletAddress}>
            {walletAddress || '—'}
          </span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Role: <strong style={{ color: 'var(--color-success)' }}>Doctor (Accredited)</strong>
        </div>
      </div>

      {/* PRIMARY SECTION: Records Shared With Me */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Healthcare Records Shared With You</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Patient records with active on-chain access authorization derived from <code>RecordRegistry.AccessGranted</code> events.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchSharedRecords}
            disabled={loadingShared}
            id="refresh-shared-table-btn"
          >
            {loadingShared ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="card-body">
          {loadingShared ? (
            <LoadingState message="Querying blockchain access grants and verifying cryptographic permissions..." />
          ) : sharedError ? (
            <div className="error-state" role="alert" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span style={{ fontWeight: 600 }}>{isRpcError ? 'Blockchain RPC Error (503)' : 'Query Error'}</span>
              </div>
              <p style={{ margin: '0 0 12px 26px', fontSize: '0.875rem' }}>{sharedError}</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchSharedRecords}
                style={{ marginLeft: '26px' }}
                id="retry-shared-records-btn"
              >
                Retry Request
              </button>
            </div>
          ) : sharedRecords.length === 0 ? (
            <EmptyState
              title="No Records Shared With You"
              description="No patients have authorized your verified practitioner wallet yet. When a patient grants access to a record, it will appear here automatically."
            />
          ) : (
            <div className="table-wrapper">
              <table className="data-table" aria-label="Records shared with doctor">
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    <th scope="col">Patient Owner</th>
                    <th scope="col">IPFS CID</th>
                    <th scope="col">SHA-256 On-Chain</th>
                    <th scope="col">Uploaded</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sharedRecords.map((rec) => {
                    const cidKey = `cid-${rec.recordId}`;
                    const hashKey = `hash-${rec.recordId}`;
                    const ownerKey = `owner-${rec.recordId}`;

                    return (
                      <tr key={rec.recordId}>
                        {/* Record label & ID */}
                        <td>
                          <div className="table-cell-primary">{rec.label || 'Medical Record'}</div>
                          <div className="table-cell-secondary" style={{ fontFamily: 'ui-monospace, monospace' }}>
                            ID: #{rec.recordId}
                          </div>
                        </td>

                        {/* Patient Owner */}
                        <td>
                          <div className="table-cell-primary">{rec.ownerName || 'Verified Patient'}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <code
                              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.775rem' }}
                              title={rec.owner}
                            >
                              {truncate(rec.owner, 6, 4)}
                            </code>
                            {rec.owner && (
                              <button
                                type="button"
                                className="btn-copy"
                                onClick={() => handleCopy(rec.owner, ownerKey)}
                                title="Copy patient wallet address"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                {copiedKey === ownerKey ? (
                                  <span style={{ fontSize: '0.675rem', color: 'var(--color-success)' }}>Copied!</span>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* IPFS CID */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code
                              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.775rem' }}
                              title={rec.cid}
                            >
                              {truncate(rec.cid, 6, 4)}
                            </code>
                            {rec.cid && (
                              <button
                                type="button"
                                className="btn-copy"
                                onClick={() => handleCopy(rec.cid, cidKey)}
                                title="Copy IPFS CID"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                {copiedKey === cidKey ? (
                                  <span style={{ fontSize: '0.675rem', color: 'var(--color-success)' }}>Copied!</span>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* SHA-256 On-Chain Hash */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code
                              style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.775rem' }}
                              title={rec.fileHash}
                            >
                              {truncate(rec.fileHash, 6, 4)}
                            </code>
                            {rec.fileHash && (
                              <button
                                type="button"
                                className="btn-copy"
                                onClick={() => handleCopy(rec.fileHash, hashKey)}
                                title="Copy SHA-256 hash"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              >
                                {copiedKey === hashKey ? (
                                  <span style={{ fontSize: '0.675rem', color: 'var(--color-success)' }}>Copied!</span>
                                ) : (
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            {rec.uploadedAt
                              ? new Date(rec.uploadedAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenRecord(rec)}
                              id={`open-shared-record-${rec.recordId}`}
                              title="Decrypt and view record content"
                            >
                              View
                            </button>
                            <Link
                              to={`/doctor/lookup?recordId=${encodeURIComponent(rec.recordId)}`}
                              className="btn btn-secondary btn-sm"
                              title="Inspect on-chain permission details in Lookup"
                            >
                              Lookup
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECONDARY SECTION: Manual Record Lookup */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Manual Record Lookup</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Have a numeric Record ID shared with you out-of-band? Verify permissions and view the encrypted document directly.
            </p>
          </div>
          <Link to="/doctor/lookup" className="btn btn-secondary btn-sm" id="manual-lookup-link-btn">
            Open Record Lookup →
          </Link>
        </div>
      </div>

      {/* FALLBACK SECTION: Recent Lookups (This Session) */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Recent Lookups (Session Fallback Tracker)</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              History of records checked during your current browser session.
            </p>
          </div>
          <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
            In-Memory Session
          </span>
        </div>
        <div className="card-body">
          {lookups.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
              No record lookups performed yet in this session.
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
              {lookups.slice(0, 5).map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
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
                  <Link
                    to={`/doctor/lookup?recordId=${encodeURIComponent(item.id)}`}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    View in Lookup
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Modal viewer for doctor */}
      {selectedRecordForView && (
        <ViewRecordModal
          record={selectedRecordForView}
          isOpen={Boolean(selectedRecordForView)}
          onClose={() => setSelectedRecordForView(null)}
        />
      )}
    </Layout>
  );
}

