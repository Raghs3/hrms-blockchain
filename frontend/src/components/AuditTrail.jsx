import { useState, useMemo } from 'react';
import { useAuditTrail } from '../context/AuditTrailContext';

function truncateHash(hash) {
  if (!hash) return '—';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * AuditTrail - Displays an immutable activity log of on-chain smart contract events
 * (RecordAdded, AccessGranted, AccessRevoked) with transaction hashes and timestamps.
 */
export default function AuditTrail({ maxItems = 10, title = 'On-Chain Activity & Audit Trail' }) {
  const { events, clearAuditTrail } = useAuditTrail();
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'RECORD_UPLOADED' | 'ACCESS_GRANTED' | 'ACCESS_REVOKED'
  const [copiedHash, setCopiedHash] = useState('');

  function handleCopy(txHash) {
    if (!txHash) return;
    navigator.clipboard?.writeText(txHash);
    setCopiedHash(txHash);
    setTimeout(() => setCopiedHash(''), 2000);
  }

  const filteredEvents = useMemo(() => {
    let list = events;
    if (filter !== 'ALL') {
      list = events.filter((e) => e.type === filter);
    }
    return list.slice(0, maxItems);
  }, [events, filter, maxItems]);

  return (
    <div className="card" id="onchain-audit-trail-card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2>{title}</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Immutable event log emitted by smart contracts on the Ethereum blockchain.
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div className="auth-tab-group" style={{ marginBottom: 0, padding: '2px' }}>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'ALL' ? ' active' : ''}`}
              onClick={() => setFilter('ALL')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              All ({events.length})
            </button>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'RECORD_UPLOADED' ? ' active' : ''}`}
              onClick={() => setFilter('RECORD_UPLOADED')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Uploads
            </button>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'ACCESS_GRANTED' ? ' active' : ''}`}
              onClick={() => setFilter('ACCESS_GRANTED')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Grants
            </button>
            <button
              type="button"
              className={`auth-tab-btn${filter === 'ACCESS_REVOKED' ? ' active' : ''}`}
              onClick={() => setFilter('ACCESS_REVOKED')}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              Revokes
            </button>
          </div>

          {events.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={clearAuditTrail}
              title="Clear session audit log"
              style={{ fontSize: '0.725rem', padding: '3px 8px' }}
            >
              Clear Log
            </button>
          )}
        </div>
      </div>

      <div className="card-body" style={{ padding: '16px 24px' }}>
        {filteredEvents.length === 0 ? (
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
              Upload records or update doctor consent permissions to generate verifiable Ethereum transactions.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredEvents.map((evt) => {
              const isUpload = evt.type === 'RECORD_UPLOADED';
              const isGrant = evt.type === 'ACCESS_GRANTED';
              const isRevoke = evt.type === 'ACCESS_REVOKED';
              const isCopied = copiedHash === evt.txHash;

              return (
                <div
                  key={evt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-light)',
                    background: 'var(--color-surface)',
                    gap: '14px',
                    flexWrap: 'wrap',
                    transition: 'background var(--transition)',
                  }}
                >
                  {/* Left: Icon & Description */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '260px', flex: 1 }}>
                    {/* Badge Icon */}
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
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
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {isUpload && `Record Added: ${evt.label}`}
                          {isGrant && `Access Granted to ${evt.doctorName || truncateHash(evt.doctorAddress)}`}
                          {isRevoke && `Access Revoked from ${evt.doctorName || truncateHash(evt.doctorAddress)}`}
                        </span>
                        <span
                          className={`badge ${isUpload ? 'badge-authorized' : isGrant ? 'badge-granted' : 'badge-revoked'}`}
                          style={{ fontSize: '0.675rem', padding: '1px 6px' }}
                        >
                          {isUpload ? 'RecordAdded' : isGrant ? 'AccessGranted' : 'AccessRevoked'}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{formatDate(evt.timestamp)}</span>
                        <span>•</span>
                        <span>Record #{evt.recordId}</span>
                        {evt.cid && (
                          <>
                            <span>•</span>
                            <span title={evt.cid} style={{ fontFamily: 'ui-monospace, monospace' }}>
                              CID: {truncateHash(evt.cid)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Transaction Hash Pill */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                      <code
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.775rem',
                          color: 'var(--color-text-primary)',
                        }}
                        title={evt.txHash}
                      >
                        {truncateHash(evt.txHash)}
                      </code>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(evt.txHash)}
                      title="Copy on-chain transaction hash"
                      style={{ padding: '3px 8px', fontSize: '0.725rem' }}
                    >
                      {isCopied ? (
                        <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>Copied!</span>
                      ) : (
                        'Copy'
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
