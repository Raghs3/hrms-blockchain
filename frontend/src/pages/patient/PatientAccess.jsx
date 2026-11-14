import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import RecordTable from '../../components/RecordTable';
import { getMyRecords } from '../../api/records';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * PatientAccess - /patient/access
 * Access & Consent control portal for managing doctor permissions per record.
 */
export default function PatientAccess() {
  useDocumentTitle('Access & Consent');

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMyRecords();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      let message = err?.message || 'Failed to load records. Please try again.';
      if (err?.code === 'NOT_A_PATIENT') {
        message += ' Your wallet may not be registered on the current chain. Sign out and sign in again, then retry.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    getMyRecords()
      .then((data) => {
        if (!ignore) {
          setRecords(Array.isArray(data) ? data : []);
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
  }, []);

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
              'Refresh'
            )}
          </button>
          <Link to="/patient/records" className="btn btn-secondary" id="view-records-link">
            Record List
          </Link>
        </div>
      </div>

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
    </Layout>
  );
}
