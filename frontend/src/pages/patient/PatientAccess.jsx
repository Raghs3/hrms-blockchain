import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import RecordTable from '../../components/RecordTable';
import AuditTrail from '../../components/AuditTrail';
import AccessReceipts from '../../components/AccessReceipts';
import { useAuditTrail } from '../../context/AuditTrailContext';
import { getMyRecords } from '../../api/records';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * PatientAccess - /patient/access
 * Access & Consent control portal for managing doctor permissions per record.
 */
export default function PatientAccess() {
  useDocumentTitle('Access & Consent');

  const [searchParams] = useSearchParams();
  const targetDoctor = searchParams.get('doctor');
  const { seedFromRecords } = useAuditTrail();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyRecords();
      const list = Array.isArray(data) ? data : [];
      setRecords(list);
      seedFromRecords(list);
    } catch (err) {
      let message = err?.message || 'Failed to load records. Please try again.';
      if (err?.code === 'NOT_A_PATIENT') {
        message += ' Your wallet may not be registered on the current chain. Sign out and sign in again, then retry.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [seedFromRecords]);

  useEffect(() => {
    let ignore = false;
    getMyRecords()
      .then((data) => {
        if (!ignore) {
          const list = Array.isArray(data) ? data : [];
          setRecords(list);
          seedFromRecords(list);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          let message = err?.message || 'Failed to load records. Please try again.';
          if (err?.code === 'NOT_A_PATIENT') {
            message += ' Your wallet may not be registered on the current chain. Sign out and sign in again, then retry.';
          }
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [seedFromRecords]);

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const timeA = new Date(a.uploadedAt).getTime() || 0;
      const timeB = new Date(b.uploadedAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [records]);

  return (
    <Layout>
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
          <h1>Access & Consent Control</h1>
          <p className="page-description">
            Grant permission to authorized doctors or immediately revoke access on the blockchain.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadRecords}
            disabled={loading}
            title="Reload permissions from blockchain"
            id="refresh-access-btn"
          >
            {loading ? (
              <>
                <span className="spinner spinner-sm" aria-hidden="true" />
                Refreshing...
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                </svg>
                Refresh
              </>
            )}
          </button>
          <Link to="/patient/records" className="btn btn-secondary" id="view-records-link">
            Record List
          </Link>
        </div>
      </div>

      {/* Target Doctor Callout from Directory */}
      {targetDoctor && (
        <div
          className="card"
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            backgroundColor: 'var(--color-accent-subtle)',
            borderColor: '#bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className="summary-card-icon"
              style={{ width: '32px', height: '32px', background: 'var(--color-accent)', color: '#ffffff' }}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </span>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Target Doctor Selected: <code style={{ fontFamily: 'ui-monospace, monospace' }}>{targetDoctor}</code>
              </div>
              <div style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                Select a record below and click &quot;Grant Access&quot; to authorize this practitioner on-chain.
              </div>
            </div>
          </div>
          <Link to="/patient/doctors" className="btn btn-secondary btn-sm">
            View All Doctors
          </Link>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Doctor Permissions</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Select a doctor from the registry to grant access, or click Revoke to terminate consent on-chain.
            </p>
          </div>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <RecordTable
            records={sortedRecords}
            loading={loading}
            error={error}
            mode="access"
            onRecordUpdate={loadRecords}
            onRetry={loadRecords}
          />
        </div>
      </div>

      {/* Who actually opened a record (on-chain receipts) */}
      <div style={{ marginTop: '24px' }}>
        <AccessReceipts viewer="patient" maxItems={10} refreshKey={records.length} />
      </div>

      {/* On-Chain Access Audit Trail */}
      <div style={{ marginTop: '24px' }}>
        <AuditTrail maxItems={10} title="Access & Permission Transaction History" />
      </div>
    </Layout>
  );
}

