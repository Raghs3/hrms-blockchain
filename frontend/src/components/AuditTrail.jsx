import { useState, useMemo } from 'react';
import { useAuditTrail } from '../context/AuditTrailContext';
import LoadingState from './LoadingState';

function truncate(str, head = 6, tail = 4) {
  if (!str) return '';
  if (str.length <= head + tail) return str;
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function CopyPill({ value, label, display, title }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  function handleCopy() {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.75rem',
      }}
    >
      {label && <span style={{ color: 'var(--color-text-muted)' }}>{label}:</span>}
      <code
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '0.775rem',
          color: 'var(--color-text-primary)',
        }}
        title={title || value}
      >
        {display || truncate(value, 6, 4)}
      </code>
      <button
        type="button"
        className="btn-copy"
        onClick={handleCopy}
        title={`Copy ${label || 'value'}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        {copied ? (
          <span style={{ fontSize: '0.675rem', color: 'var(--color-success)', fontWeight: 600 }}>Copied!</span>
        ) : (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </span>
  );
}

/**
 * AuditTrail - Displays an authoritative, immutable on-chain activity log of
 * smart contract events (RecordAdded, AccessGranted, AccessRevoked) with
 * block timestamps, transaction hashes, copy controls, and pagination.
 */
export default function AuditTrail({ title = 'On-Chain Activity & Audit Trail' }) {
  const {
    events,
    loading,
    loadingMore,
    error,
    isRpcError,
    total,
    hasMore,
    loadMore,
    refresh,
    clearAuditTrail,
  } = useAuditTrail();

  // 'ALL' | 'RECORD_ADDED' | 'ACCESS_GRANTED' | 'ACCESS_REVOKED'
  const [filter, setFilter] = useState('ALL');

  const filteredEvents = useMemo(() => {
    if (filter === 'ALL') return events;
    return events.filter((e) => e.type === filter);
  }, [events, filter]);

  return (
    <div className="card" id="onchain-audit-trail-card">
      <div
        className="card-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h2>{title}</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Authoritative, immutable event log emitted by smart contracts on the Ethereum blockchain.
          </p>
        </div>

        {/* Filter Controls & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="auth-tab-group" style={{ marginBottom: 0, padding: '2px' }}>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'ALL' ? ' active' : ''}`}
              onClick={() => setFilter('ALL')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              id="filter-audit-all"
            >
              All ({events.length})
            </button>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'RECORD_ADDED' ? ' active' : ''}`}
              onClick={() => setFilter('RECORD_ADDED')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              id="filter-audit-uploads"
            >
              Uploads
            </button>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'ACCESS_GRANTED' ? ' active' : ''}`}
              onClick={() => setFilter('ACCESS_GRANTED')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              id="filter-audit-grants"
            >
              Grants
            </button>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'ACCESS_REVOKED' ? ' active' : ''}`}
              onClick={() => setFilter('ACCESS_REVOKED')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
              id="filter-audit-revokes"
            >
              Revokes
            </button>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={refresh}
            disabled={loading}
            title="Refresh on-chain audit trail"
            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            id="refresh-audit-trail-btn"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>

          {events.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={clearAuditTrail}
              title="Reset session event cache and re-sync from blockchain"
              style={{ fontSize: '0.725rem', padding: '4px 8px' }}
              id="clear-audit-trail-btn"
            >
              Clear Session Cache
            </button>
          )}
        </div>
      </div>

      <div className="card-body" style={{ padding: '16px 20px' }}>
        {loading && events.length === 0 ? (
          <LoadingState message="Loading on-chain audit trail from Ethereum blockchain..." />
        ) : error && events.length === 0 ? (
          <div className="error-state" role="alert" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span style={{ fontWeight: 600 }}>{isRpcError ? 'Blockchain RPC Unavailable (503)' : 'Audit Trail Error'}</span>
            </div>
            <p style={{ margin: '0 0 12px 26px', fontSize: '0.875rem' }}>{error}</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={refresh}
              style={{ marginLeft: '26px' }}
              id="retry-audit-trail-btn"
            >
              Retry
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--color-text-muted)' }}>
            <div style={{ width: '40px', height: '40px', margin: '0 auto 12px', color: '#94a3b8' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              No on-chain activity recorded in this view
            </div>
            <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
              Upload records or update doctor consent permissions to generate verifiable Ethereum smart contract events.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredEvents.map((evt) => {
              const isUpload = evt.type === 'RECORD_ADDED' || evt.type === 'RECORD_UPLOADED';
              const isGrant = evt.type === 'ACCESS_GRANTED';
              const isRevoke = evt.type === 'ACCESS_REVOKED';

              // Actor formatting (record owner)
              const actorName = evt.ownerName || null;
              const actorAddress = evt.owner || null;

              // Counterparty formatting (doctor)
              const counterpartyName = evt.doctorName || null;
              const counterpartyAddress = evt.doctor || null;

              return (
                <div
                  key={evt.id || `${evt.txHash}_${evt.type}_${evt.recordId}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-light)',
                    background: 'var(--color-surface)',
                    gap: '14px',
                    flexWrap: 'wrap',
                    transition: 'background var(--transition)',
                  }}
                  id={`audit-event-${(evt.txHash || 'event').slice(0, 10)}`}
                >
                  {/* Left: Icon & Description */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: '280px', flex: 1 }}>
                    {/* Badge Icon */}
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        backgroundColor: isUpload
                          ? 'var(--color-success-bg)'
                          : isGrant
                          ? 'var(--color-accent-light)'
                          : 'var(--color-warning-bg)',
                        color: isUpload
                          ? 'var(--color-success)'
                          : isGrant
                          ? 'var(--color-accent)'
                          : 'var(--color-warning-dark)',
                        marginTop: '2px',
                      }}
                      aria-hidden="true"
                    >
                      {isUpload && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 9l5-5 5 5M12 4v12" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {isGrant && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="8" cy="8" r="6" />
                          <path d="M5.5 8l2 2 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      {isRevoke && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0110 0v4" />
                          <line x1="12" y1="15" x2="12" y2="17" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {isUpload && (evt.label ? `Record Added: ${evt.label}` : `Record Added #${evt.recordId}`)}
                          {isGrant && (evt.label ? `Access Granted: ${evt.label}` : `Access Granted for Record #${evt.recordId}`)}
                          {isRevoke && (evt.label ? `Access Revoked: ${evt.label}` : `Access Revoked for Record #${evt.recordId}`)}
                        </span>
                        <span
                          className={`badge ${isUpload ? 'badge-authorized' : isGrant ? 'badge-granted' : 'badge-revoked'}`}
                          style={{ fontSize: '0.7rem', padding: '2px 8px' }}
                        >
                          {evt.type}
                        </span>
                        {evt.isPendingSession && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.675rem' }}>
                            Just Performed
                          </span>
                        )}
                      </div>

                      {/* Metadata Row: Actor, Counterparty, Record ID */}
                      <div
                        style={{
                          fontSize: '0.775rem',
                          color: 'var(--color-text-secondary)',
                          marginTop: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        {/* Record ID */}
                        {evt.recordId && (
                          <span style={{ fontWeight: 600 }}>
                            Record #{evt.recordId}
                          </span>
                        )}

                        {/* Actor (Patient Owner) */}
                        {actorAddress && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Actor:</span>
                            {actorName ? (
                              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {actorName}
                              </span>
                            ) : null}
                            <CopyPill value={actorAddress} label="" />
                          </span>
                        )}

                        {/* Counterparty (Doctor) */}
                        {counterpartyAddress && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: 'var(--color-text-muted)' }}>Doctor:</span>
                            {counterpartyName ? (
                              <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                {counterpartyName}
                              </span>
                            ) : null}
                            <CopyPill value={counterpartyAddress} label="" />
                          </span>
                        )}

                        {/* IPFS CID (RecordAdded only) */}
                        {evt.cid && (
                          <CopyPill value={evt.cid} label="CID" />
                        )}

                        {/* SHA-256 On-chain hash (RecordAdded only) */}
                        {evt.fileHash && (
                          <CopyPill value={evt.fileHash} label="SHA-256" />
                        )}

                        {/* Timestamp */}
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {formatDate(evt.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Block & Transaction Hash Pill */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'var(--color-surface-subtle)',
                        border: '1px solid var(--color-border-light)',
                        borderRadius: 'var(--radius-xs)',
                        padding: '4px 8px',
                      }}
                    >
                      <span style={{ fontSize: '0.675rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                        Tx
                      </span>
                      <CopyPill value={evt.txHash} label="" display={truncate(evt.txHash, 8, 6)} />
                    </div>

                    {typeof evt.blockNumber === 'number' && (
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                        Block #{evt.blockNumber}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination: Load More */}
        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border-light)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadMore}
              disabled={loadingMore}
              id="load-more-audit-btn"
            >
              {loadingMore ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  Loading more events...
                </>
              ) : (
                `Load More Events (${events.length} of ${total})`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
