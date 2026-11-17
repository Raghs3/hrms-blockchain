import { useState, useEffect, useCallback } from 'react';
import { getAccessReceipts } from '../api/records';
import LoadingState from './LoadingState';

function truncate(str, head = 10, tail = 8) {
  if (!str || str.length <= head + tail + 3) return str || '';
  return `${str.slice(0, head)}...${str.slice(-tail)}`;
}

function formatWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * AccessReceipts - "Who opened your record": every read is backed by an on-chain
 * AccessReceipt transaction (the backend only releases a file after that is mined).
 *
 * Props:
 *   title, description: heading text
 *   viewer: 'patient' | 'doctor' (changes the sentence wording)
 *   maxItems: rows to show
 *   refreshKey: change to force a reload
 */
export default function AccessReceipts({
  title = 'Who opened your records',
  description = 'Every time a record is opened, a receipt is written to the blockchain first. These cannot be edited or deleted.',
  viewer = 'patient',
  maxItems = 10,
  refreshKey = 0,
}) {
  const [data, setData] = useState({ total: 0, receipts: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openTech, setOpenTech] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getAccessReceipts({ limit: maxItems }));
    } catch (err) {
      setError(err?.message || 'Failed to load access receipts.');
    } finally {
      setLoading(false);
    }
  }, [maxItems]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  return (
    <div className="card" id="access-receipts">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2>{title}</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{description}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>
      <div className="card-body">
        {loading && <LoadingState message="Loading access receipts from the blockchain..." />}

        {!loading && error && (
          <div className="error-state" role="alert">
            {error}
          </div>
        )}

        {!loading && !error && data.receipts.length === 0 && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            {viewer === 'patient'
              ? 'No one has opened your records yet.'
              : 'You have not opened any records yet.'}
          </div>
        )}

        {!loading && !error && data.receipts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.receipts.map((r) => {
              const who =
                r.selfAccess || viewer === 'doctor' ? 'You' : r.accessorName || truncate(r.accessor, 6, 4);
              const what = r.label || `Record #${r.recordId}`;
              const key = r.txHash;
              return (
                <div
                  key={key}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-light)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.9375rem' }}>
                      <strong>{who}</strong> opened <strong>{what}</strong>
                      {viewer === 'doctor' && r.ownerName ? <> (patient {r.ownerName})</> : null}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{formatWhen(r.timestamp)}</div>
                  </div>
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span className="badge badge-authorized" style={{ fontSize: '0.7rem' }}>Logged on-chain</span>
                    <button
                      type="button"
                      onClick={() => setOpenTech(openTech === key ? null : key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.8125rem', padding: 0 }}
                    >
                      {openTech === key ? 'Hide technical details' : 'Technical details'}
                    </button>
                  </div>
                  {openTech === key && (
                    <div style={{ marginTop: '8px', fontSize: '0.78rem', fontFamily: 'ui-monospace, monospace', color: 'var(--color-text-secondary)', lineHeight: 1.6, wordBreak: 'break-all' }}>
                      <div>tx: {r.txHash}</div>
                      <div>block: {r.blockNumber}</div>
                      <div>reader wallet: {r.accessor}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {data.total > data.receipts.length && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Showing the latest {data.receipts.length} of {data.total} receipts.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
