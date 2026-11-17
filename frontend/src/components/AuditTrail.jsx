import { useState, useMemo } from 'react';
import { useAuditTrail } from '../context/AuditTrailContext';
import { useAuth } from '../context/AuthContext';
import LoadingState from './LoadingState';

function truncate(str, head = 6, tail = 4) {
  if (!str) return '';
  if (str.length <= head + tail) return str;
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}

function sameAddress(a, b) {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function eventKind(evt) {
  if (evt.type === 'ACCESS_GRANTED') return 'grant';
  if (evt.type === 'ACCESS_REVOKED') return 'revoke';
  return 'upload';
}

function fileTypeLabel(mimeType) {
  if (!mimeType) return null;
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType === 'text/plain') return 'Text file';
  if (mimeType.includes('word')) return 'Word document';
  return null;
}

function dayKey(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'unknown';
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayHeading(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Earlier';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(isoString) === dayKey(today.toISOString())) return 'Today';
  if (dayKey(isoString) === dayKey(yesterday.toISOString())) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function formatFullDate(isoString) {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString || '';
  return d.toLocaleString();
}

function CopyPill({ value, display }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;

  function handleCopy() {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.775rem' }} title={value}>
        {display || truncate(value, 8, 6)}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy to clipboard"
        style={{
          background: 'none',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-xs)',
          cursor: 'pointer',
          padding: '1px 6px',
          fontSize: '0.675rem',
          color: copied ? 'var(--color-success)' : 'var(--color-text-secondary)',
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

const KIND_STYLES = {
  upload: {
    label: 'Uploaded',
    badge: 'badge-authorized',
    bg: 'var(--color-success-bg)',
    fg: 'var(--color-success)',
    icon: <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 9l5-5 5 5M12 4v12" strokeLinecap="round" strokeLinejoin="round" />,
  },
  grant: {
    label: 'Access given',
    badge: 'badge-granted',
    bg: 'var(--color-accent-light)',
    fg: 'var(--color-accent)',
    icon: <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />,
  },
  revoke: {
    label: 'Access removed',
    badge: 'badge-revoked',
    bg: 'var(--color-warning-bg)',
    fg: 'var(--color-warning-dark)',
    icon: <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />,
  },
};

/**
 * Builds the plain-English sentence for one event, from the viewer's point of view
 * ("You gave Dr. Kapoor access to ...", "Riya Sharma gave you access to ...").
 */
function describe(evt, myAddress) {
  const kind = eventKind(evt);
  const ownerIsMe = sameAddress(evt.owner, myAddress);
  const doctorIsMe = sameAddress(evt.doctor, myAddress);
  const owner = ownerIsMe ? 'You' : evt.ownerName || truncate(evt.owner, 6, 4) || 'A patient';
  const doctor = doctorIsMe ? 'you' : evt.doctorName || truncate(evt.doctor, 6, 4) || 'a doctor';
  const doctorPossessive = doctorIsMe ? 'your' : `${doctor}'s`;
  const record = evt.label ? `"${evt.label}"` : `record #${evt.recordId}`;

  if (kind === 'upload') return { owner, verb: 'uploaded', doctor: null, record };
  if (kind === 'grant') return { owner, verb: 'gave', doctor, tail: 'access to', record };
  return { owner, verb: 'removed', doctor: doctorPossessive, tail: 'access to', record, possessive: true };
}

function Detail({ label, children }) {
  if (!children) return null;
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ width: '118px', flexShrink: 0, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{label}</span>
      <span style={{ fontSize: '0.8125rem' }}>{children}</span>
    </div>
  );
}

function EventRow({ evt, myAddress }) {
  const kind = eventKind(evt);
  const style = KIND_STYLES[kind];
  const s = describe(evt, myAddress);
  const fileType = fileTypeLabel(evt.mimeType);

  return (
    <li
      style={{
        listStyle: 'none',
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-light)',
        background: 'var(--color-surface)',
      }}
      id={`audit-event-${(evt.txHash || 'event').slice(0, 10)}-${kind}`}
      data-event-kind={kind}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div
          aria-hidden="true"
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            backgroundColor: style.bg,
            color: style.fg,
          }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            {style.icon}
          </svg>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.9375rem', lineHeight: 1.45, color: 'var(--color-text-primary)' }}>
            <strong>{s.owner}</strong> {s.verb}
            {s.doctor ? <> <strong>{s.doctor}</strong>{s.tail ? ` ${s.tail}` : ''}</> : ''} <strong>{s.record}</strong>
          </div>
          <div
            style={{
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              fontSize: '0.775rem',
              color: 'var(--color-text-muted)',
            }}
          >
            <span className={`badge ${style.badge}`} style={{ fontSize: '0.675rem', padding: '1px 8px' }}>
              {style.label}
            </span>
            {evt.recordId && <span>Record #{evt.recordId}</span>}
            {fileType && <span>· {fileType}</span>}
            {evt.originalFileName && <span>· {evt.originalFileName}</span>}
            {evt.isPendingSession && <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>Just now</span>}
          </div>
        </div>

        <div
          style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}
          title={formatFullDate(evt.timestamp)}
        >
          {formatTime(evt.timestamp)}
        </div>
      </div>

      <details style={{ marginTop: '8px', marginLeft: '46px' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-accent)' }}>
          Technical details
        </summary>
        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            background: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <Detail label="When">{formatFullDate(evt.timestamp)}</Detail>
          <Detail label="Patient wallet">
            {evt.owner ? <CopyPill value={evt.owner} /> : null}
          </Detail>
          <Detail label="Doctor wallet">
            {evt.doctor ? <CopyPill value={evt.doctor} /> : null}
          </Detail>
          <Detail label="Transaction">
            {evt.txHash ? <CopyPill value={evt.txHash} display={truncate(evt.txHash, 10, 8)} /> : null}
          </Detail>
          <Detail label="Block">{typeof evt.blockNumber === 'number' ? `#${evt.blockNumber}` : null}</Detail>
          <Detail label="File fingerprint">
            {evt.fileHash ? <CopyPill value={evt.fileHash} /> : null}
          </Detail>
          <Detail label="Storage ID (CID)">
            {evt.cid ? <CopyPill value={evt.cid} /> : null}
          </Detail>
        </div>
      </details>
    </li>
  );
}

/**
 * AuditTrail - A readable history of who uploaded records and who was given or
 * lost access, grouped by day, with the raw blockchain details one click away.
 *
 * Props:
 *   title: heading text
 *   maxItems: optional; show only the newest N events (used for "recent activity" cards)
 */
export default function AuditTrail({ title = 'Activity history', maxItems }) {
  const { events, loading, loadingMore, error, isRpcError, total, hasMore, loadMore, refresh } = useAuditTrail();
  const { walletAddress } = useAuth();

  // 'ALL' | 'RECORD_ADDED' | 'ACCESS_GRANTED' | 'ACCESS_REVOKED'
  const [filter, setFilter] = useState('ALL');

  const counts = useMemo(
    () => ({
      ALL: events.length,
      RECORD_ADDED: events.filter((e) => eventKind(e) === 'upload').length,
      ACCESS_GRANTED: events.filter((e) => eventKind(e) === 'grant').length,
      ACCESS_REVOKED: events.filter((e) => eventKind(e) === 'revoke').length,
    }),
    [events]
  );

  const visible = useMemo(() => {
    let list = events;
    if (filter === 'RECORD_ADDED') list = events.filter((e) => eventKind(e) === 'upload');
    else if (filter === 'ACCESS_GRANTED') list = events.filter((e) => eventKind(e) === 'grant');
    else if (filter === 'ACCESS_REVOKED') list = events.filter((e) => eventKind(e) === 'revoke');
    return maxItems ? list.slice(0, maxItems) : list;
  }, [events, filter, maxItems]);

  // Group into "Today", "Yesterday", dates ...
  const groups = useMemo(() => {
    const out = [];
    for (const evt of visible) {
      const key = dayKey(evt.timestamp);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(evt);
      else out.push({ key, heading: dayHeading(evt.timestamp), items: [evt] });
    }
    return out;
  }, [visible]);

  const chips = [
    { id: 'ALL', label: 'Everything', domId: 'filter-audit-all' },
    { id: 'RECORD_ADDED', label: 'Uploads', domId: 'filter-audit-uploads' },
    { id: 'ACCESS_GRANTED', label: 'Access given', domId: 'filter-audit-grants' },
    { id: 'ACCESS_REVOKED', label: 'Access removed', domId: 'filter-audit-revokes' },
  ];

  return (
    <div className="card" id="onchain-audit-trail-card">
      <div
        className="card-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}
      >
        <div>
          <h2>{title}</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px', maxWidth: '520px' }}>
            Every upload and every change of access is written to the blockchain, so this history cannot be edited or
            deleted.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={refresh}
          disabled={loading}
          title="Reload the history from the blockchain"
          id="refresh-audit-trail-btn"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="card-body" style={{ padding: '16px 20px' }}>
        <div role="group" aria-label="Filter activity" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              id={chip.domId}
              className={`btn btn-sm ${filter === chip.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(chip.id)}
              aria-pressed={filter === chip.id}
            >
              {chip.label} ({counts[chip.id]})
            </button>
          ))}
        </div>

        {loading && events.length === 0 ? (
          <LoadingState message="Loading activity from the blockchain..." />
        ) : error && events.length === 0 ? (
          <div className="error-state" role="alert" style={{ padding: '16px 20px' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>
              {isRpcError ? 'Cannot reach the blockchain right now' : 'Could not load the activity history'}
            </div>
            <p style={{ margin: '0 0 12px', fontSize: '0.875rem' }}>{error}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={refresh} id="retry-audit-trail-btn">
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {filter === 'ALL' ? 'Nothing has happened yet' : 'No activity of this kind yet'}
            </div>
            <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
              Uploading a record or giving a doctor access will show up here.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {groups.map((group) => (
              <section key={group.key} aria-label={group.heading}>
                <h3
                  style={{
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--color-text-muted)',
                    margin: '0 0 8px',
                  }}
                >
                  {group.heading}
                </h3>
                <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {group.items.map((evt) => (
                    <EventRow
                      key={evt.id || `${evt.txHash}_${evt.type}_${evt.recordId}_${evt.doctor || ''}`}
                      evt={evt}
                      myAddress={walletAddress}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {!maxItems && hasMore && (
          <div style={{ textAlign: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border-light)' }}>
            <button type="button" className="btn btn-secondary" onClick={loadMore} disabled={loadingMore} id="load-more-audit-btn">
              {loadingMore ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  Loading more...
                </>
              ) : (
                `Show older activity (${events.length} of ${total})`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
