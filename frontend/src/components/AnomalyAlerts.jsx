import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAnomalies, ACCESS_RECEIPT_EVENT } from '../api/records';
import LoadingState from './LoadingState';

const RULE_LABELS = {
  BURST: 'Burst of records',
  WIDE_REACH: 'Many patients',
  OFF_HOURS: 'Outside working hours',
};

function formatWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/**
 * AnomalyAlerts - Unusual access activity, found by simple explainable rules over the
 * on-chain access receipts (not machine learning). Admin only.
 *
 * Props:
 *   compact: show only the first few alerts and link to the full page
 */
export default function AnomalyAlerts({ compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getAnomalies());
    } catch (err) {
      setError(err?.message || 'Failed to run the access checks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    window.addEventListener(ACCESS_RECEIPT_EVENT, load);
    return () => window.removeEventListener(ACCESS_RECEIPT_EVENT, load);
  }, [load]);

  const findings = data?.findings || [];
  const shown = compact ? findings.slice(0, 3) : findings;
  const o = data?.options;

  return (
    <div className="card" id="anomaly-alerts" style={{ marginTop: compact ? '24px' : 0, marginBottom: compact ? 0 : '24px' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2>
            Unusual access activity
            {findings.length > 0 && (
              <span className="badge badge-revoked" style={{ marginLeft: '10px', fontSize: '0.75rem' }}>
                {findings.length} alert{findings.length > 1 ? 's' : ''}
              </span>
            )}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Checks every record read against three simple rules. Alerts are leads to review, not proof of wrongdoing.
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          Re-scan
        </button>
      </div>

      <div className="card-body">
        {loading && <LoadingState message="Scanning access receipts..." />}
        {!loading && error && <div className="error-state" role="alert">{error}</div>}

        {!loading && !error && findings.length === 0 && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
            No unusual activity found in {data?.considered ?? 0} reads by doctors.
          </div>
        )}

        {!loading && !error && shown.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {shown.map((f, i) => {
              const key = `${f.rule}-${f.accessor}-${f.firstAt}-${i}`;
              const high = f.severity === 'high';
              return (
                <div
                  key={key}
                  data-severity={f.severity}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${high ? 'var(--color-danger)' : 'var(--color-border-light)'}`,
                    background: 'var(--color-surface)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '0.9375rem' }}>
                      <span
                        className={`badge ${high ? 'badge-denied' : 'badge-revoked'}`}
                        style={{ fontSize: '0.7rem', marginRight: '8px' }}
                      >
                        {high ? 'High' : 'Medium'} · {RULE_LABELS[f.rule] || f.rule}
                      </span>
                      {f.summary}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      {formatWhen(f.firstAt)}
                      {f.firstAt !== f.lastAt ? ` – ${formatWhen(f.lastAt)}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(open === key ? null : key)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: '0.8125rem', padding: '6px 0 0' }}
                  >
                    {open === key ? 'Hide evidence' : 'Show evidence'}
                  </button>
                  {open === key && (
                    <div style={{ marginTop: '6px', fontSize: '0.78rem', fontFamily: 'ui-monospace, monospace', color: 'var(--color-text-secondary)', lineHeight: 1.6, wordBreak: 'break-all' }}>
                      <div>records: {f.recordIds.map((r) => `#${r}`).join(', ')}</div>
                      {f.txHashes.map((h) => (
                        <div key={h}>receipt tx: {h}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {compact && findings.length > shown.length && (
              <Link to="/admin/audit" style={{ fontSize: '0.875rem' }}>
                See all {findings.length} alerts
              </Link>
            )}
          </div>
        )}

        {!loading && !error && o && !compact && (
          <div style={{ marginTop: '14px', fontSize: '0.78rem', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
            Rules in use: records opened outside {pad(o.workStartHour)}:00–{pad(o.workEndHour)}:00 local time (UTC
            {o.utcOffsetMinutes >= 0 ? '+' : '-'}
            {Math.floor(Math.abs(o.utcOffsetMinutes) / 60)}:{pad(Math.abs(o.utcOffsetMinutes) % 60)}); {o.burstRecords}+ different
            records within {o.burstWindowMinutes} minutes; records of {o.wideReachPatients}+ different patients within{' '}
            {o.wideReachWindowMinutes} minutes. Opening your own records is never flagged.
          </div>
        )}
      </div>
    </div>
  );
}
