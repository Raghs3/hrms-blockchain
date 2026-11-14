import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import RecordTable from '../../components/RecordTable';
import { getMyRecords } from '../../api/records';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * PatientRecords - /patient/records
 * Full records repository with live data, IPFS CIDs, and links to access management.
 */
export default function PatientRecords() {
  useDocumentTitle('My Records');

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
          <h1>My Healthcare Records</h1>
          <p className="page-description">
            Complete history of your encrypted medical records stored on IPFS and registered on-chain.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadRecords}
            disabled={loading}
            title="Reload records from blockchain"
            id="refresh-records-btn"
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
          <Link to="/patient/upload" className="btn btn-primary" id="records-upload-btn">
            Upload Record
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Record Repository</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Total records: <strong>{records.length}</strong>
            </p>
          </div>
          <Link to="/patient/access" className="btn btn-secondary btn-sm" id="go-to-access-btn">
            Manage Doctor Permissions
          </Link>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <RecordTable
            records={sortedRecords}
            loading={loading}
            error={error}
            mode="records"
            onRetry={loadRecords}
          />
        </div>
      </div>
    </Layout>
  );
}

