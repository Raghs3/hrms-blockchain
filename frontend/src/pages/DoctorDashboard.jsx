import Layout from '../components/Layout';
import RecordLookup from '../components/RecordLookup';
import useSessionHistory from '../hooks/useSessionHistory';
import { useAuth } from '../context/AuthContext';

/**
 * DoctorDashboard - Doctor portal.
 * Real access check, decrypted plaintext viewing, on-chain consent verification,
 * and live in-memory session history.
 */
export default function DoctorDashboard() {
  const { walletAddress } = useAuth();
  const sessionHistory = useSessionHistory();
  const { viewedCount, lastLookup } = sessionHistory;

  const navItems = [
    {
      label: 'Dashboard',
      active: true,
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      label: 'Records',
      active: false,
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
      onClick: () => {
        document.getElementById('record-id-input')?.focus();
      },
    },
    {
      label: 'Access Check',
      active: false,
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      onClick: () => {
        document.getElementById('record-id-input')?.focus();
      },
    },
  ];

  return (
    <Layout navItems={navItems}>
      {/* Page header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Doctor Dashboard</h1>
          <p className="page-description">
            Access healthcare records that patients have authorized you to view.
          </p>
        </div>
      </div>

      {/* Doctor Summary Metrics */}
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Records Viewed</span>
            <div className="summary-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
                <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{viewedCount}</div>
          <div className="summary-card-sub">This session</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Last Lookup</span>
            <div
              className="summary-card-icon"
              style={{
                backgroundColor: lastLookup?.result === 'GRANTED' ? 'var(--color-success-bg)' : 'var(--color-surface)',
                color: lastLookup?.result === 'GRANTED' ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 17a7 7 0 0114 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
          </div>
          <div
            className="summary-card-value"
            style={{
              fontSize: lastLookup ? '1.125rem' : '1.5rem',
              color: lastLookup?.result === 'GRANTED' ? 'var(--color-success)' : lastLookup?.result === 'DENIED' ? 'var(--color-danger)' : 'var(--color-text-primary)',
            }}
          >
            {lastLookup ? `#${lastLookup.id} (${lastLookup.result})` : '—'}
          </div>
          <div className="summary-card-sub">
            {lastLookup ? `Verified at ${lastLookup.timestamp}` : 'No lookups yet'}
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Access Control</span>
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
            Blockchain Verified
          </div>
          <div className="summary-card-sub">On-chain consent enforcement</div>
        </div>
      </div>

      {/* Connected wallet info bar */}
      <div className="info-bar" aria-label="Connected wallet information">
        <div className="info-bar-left">
          <span className="info-label">Doctor Wallet Address</span>
          <span className="info-value" title={walletAddress}>
            {walletAddress || '—'}
          </span>
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          Role: <strong style={{ color: 'var(--color-success)' }}>Doctor</strong>
        </div>
      </div>

      {/* Self-contained Record Lookup and Viewer */}
      <RecordLookup sessionHistory={sessionHistory} />

      {/* Doctor Verification Workflow instructions */}
      <div
        style={{
          marginTop: '24px',
          padding: '16px 20px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '3px solid var(--color-accent)',
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-accent)',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Doctor Verification Workflow
        </div>
        <ul
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            paddingLeft: '16px',
            lineHeight: '1.9',
            margin: 0,
          }}
        >
          <li>Sign in with your approved doctor email and password.</li>
          <li>Enter the numeric Record ID (e.g. <strong style={{ fontFamily: 'Courier New, monospace' }}>1</strong>) shared by the patient.</li>
          <li>If the patient has granted access on-chain, you will see <strong>Access Granted</strong>.</li>
          <li>Click <strong>View Record</strong> to decrypt, verify blockchain integrity, and view the record content.</li>
          <li>If the patient revokes access, the same Record ID will show <strong>Access Denied</strong>.</li>
        </ul>
      </div>
    </Layout>
  );
}
