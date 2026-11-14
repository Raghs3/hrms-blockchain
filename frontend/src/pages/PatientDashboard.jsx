import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import RecordTable from '../components/RecordTable';
import UploadRecord from '../components/UploadRecord';
import { useAuth } from '../context/AuthContext';
import { getMyRecords } from '../api/records';

/**
 * PatientDashboard - Main patient portal.
 * Real data loading, metrics computation, sorting, upload/grant/revoke workflows.
 */
export default function PatientDashboard() {
  const { walletAddress } = useAuth();

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navItems = [
    {
      label: 'Dashboard',
      active: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6"/>
        </svg>
      ),
    },
    {
      label: 'My Records',
      active: false,
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
      onClick: () => {
        window.scrollTo({ top: 300, behavior: 'smooth' });
      },
    },
    {
      label: 'Upload Record',
      active: false,
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      ),
      onClick: () => {
        document.getElementById('upload-record-btn')?.click();
      },
    },
  ];

  // Authoritative loadRecords function for user actions and refreshes
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

  // Fetch once on mount without synchronous setState in effect
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

  // Sort a copy by timestamp descending (newest first)
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const timeA = new Date(a.uploadedAt).getTime() || 0;
      const timeB = new Date(b.uploadedAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [records]);

  // Metrics computed strictly from real loaded data
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

  // Recent upload computed from newest record by timestamp, never records[0]
  const recentUploadLabel = useMemo(() => {
    if (sortedRecords.length === 0) return '—';
    const newest = sortedRecords[0];
    return newest.label || `Record #${newest.recordId}`;
  }, [sortedRecords]);

  return (
    <Layout navItems={navItems}>
      {/* Page header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div className="page-header-left">
          <h1>Patient Dashboard</h1>
          <p className="page-description">
            Manage your healthcare records, grant doctor permissions, and verify access on the blockchain.
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
              <>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ marginRight: '6px' }}>
                  <path d="M13.65 2.35A7.958 7.958 0 008 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0016 8c0-2.21-.89-4.21-2.35-5.65z" fill="currentColor"/>
                </svg>
                Refresh
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Total Records</span>
            <div className="summary-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{totalRecords}</div>
          <div className="summary-card-sub">Encrypted & pinned to IPFS</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Active Authorized Doctors</span>
            <div className="summary-card-icon" style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M3 17a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{uniqueDoctorsCount}</div>
          <div className="summary-card-sub">Unique doctors with access</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Recent Upload</span>
            <div className="summary-card-icon" style={{ backgroundColor: '#f1f5f9', color: 'var(--color-text-secondary)' }} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M10 6v4l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
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
            <div className="summary-card-icon" style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="4" y="9" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                <path d="M7 9V6a3 3 0 116 0v3" stroke="currentColor" strokeWidth="1.6"/>
              </svg>
            </div>
          </div>
          <div className="summary-card-value" style={{ fontSize: '1.25rem', color: 'var(--color-accent)' }}>
            Patient Controlled
          </div>
          <div className="summary-card-sub">Smart contract verified</div>
        </div>
      </div>

      {/* Wallet address info bar */}
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

      {/* Records section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2>My Healthcare Records</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              View your records, assign doctor access, or revoke permissions on-chain.
            </p>
          </div>
          <UploadRecord onSuccess={loadRecords} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <RecordTable
            records={sortedRecords}
            loading={loading}
            error={error}
            onRecordUpdate={loadRecords}
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
