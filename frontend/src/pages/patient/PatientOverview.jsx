import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import RecordTable from '../../components/RecordTable';
import { useAuth } from '../../context/AuthContext';
import { getMyRecords } from '../../api/records';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * PatientOverview - /patient
 * Overview dashboard displaying metrics, quick action links,
 * a short preview of the 3 newest records, and system workflow.
 */
export default function PatientOverview() {
  useDocumentTitle('Overview');
  const { walletAddress } = useAuth();

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

  const totalRecords = records.length;

  const uniqueDoctorsCount = useMemo(() => {
    const addresses = new Set();
    records.forEach((rec) => {
      if (Array.isArray(rec.authorizedDoctors)) {
        rec.authorizedDoctors.forEach((doc) => {
          if (doc?.walletAddress) {
            addresses.add(doc.walletAddress.toLowerCase());
          }
        });
      }
    });
    return addresses.size;
  }, [records]);

  const recentUploadLabel = useMemo(() => {
    if (sortedRecords.length === 0) return '—';
    const newest = sortedRecords[0];
    return newest.label || `Record #${newest.recordId}`;
  }, [sortedRecords]);

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
          <h1>Patient Overview</h1>
          <p className="page-description">
            Manage your healthcare records, grant doctor permissions, and verify access on the blockchain.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link to="/patient/upload" className="btn btn-primary" id="overview-upload-btn">
            Upload Record
          </Link>
          <Link to="/patient/access" className="btn btn-secondary" id="overview-access-btn">
            Manage Access
          </Link>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Total Records</span>
            <div className="summary-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{totalRecords}</div>
          <div className="summary-card-sub">Encrypted & pinned to IPFS</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Active Authorized Doctors</span>
            <div
              className="summary-card-icon"
              style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 17a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{uniqueDoctorsCount}</div>
          <div className="summary-card-sub">Unique doctors with access</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Recent Upload</span>
            <div
              className="summary-card-icon"
              style={{ backgroundColor: '#f1f5f9', color: 'var(--color-text-secondary)' }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div
            className="summary-card-value"
            style={{ fontSize: '1.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={recentUploadLabel}
          >
            {recentUploadLabel}
          </div>
          <div className="summary-card-sub">Latest repository update</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Access Status</span>
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
            Patient Controlled
          </div>
          <div className="summary-card-sub">Smart contract verified</div>
        </div>
      </div>

      {/* Wallet info bar */}
      <div className="info-bar" aria-label="Connected wallet information">
        <div className="info-bar-left">
          <span className="info-label">Connected Wallet</span>
          <span className="info-value" title={walletAddress} style={{ fontFamily: 'Courier New, monospace' }}>
            {walletAddress || '—'}
          </span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Role: <strong style={{ color: 'var(--color-text-primary)' }}>Patient</strong>
        </div>
      </div>

      {/* Records Preview Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Recent Healthcare Records</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Showing your 3 most recently uploaded records.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/patient/records" className="btn btn-secondary btn-sm" id="view-all-records-link">
              View all records
            </Link>
          </div>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <RecordTable
            records={sortedRecords}
            loading={loading}
            error={error}
            mode="preview"
            onRetry={loadRecords}
          />
        </div>
      </div>

      {/* System Flow explanation */}
      <div
        style={{
          marginTop: '24px',
          padding: '18px 22px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '4px solid var(--color-accent)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-accent)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Healthcare Record Workflow
        </div>
        <ol
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            paddingLeft: '16px',
            lineHeight: '1.9',
            margin: 0,
          }}
        >
          <li>Sign in with your registered email and password.</li>
          <li>Upload a text-based medical record (.txt, .md, .csv, or .json); it is encrypted, pinned to IPFS, and registered on the blockchain.</li>
          <li>Grant access to a doctor by picking an approved doctor from the dropdown or providing their wallet address.</li>
          <li>The doctor signs in to their portal, verifies access using the numeric Record ID, and decrypts the medical record content.</li>
          <li>When you wish to end access, click <strong>Revoke</strong> next to the doctor&apos;s name to immediately terminate access on-chain.</li>
        </ol>
      </div>
    </Layout>
  );
}

