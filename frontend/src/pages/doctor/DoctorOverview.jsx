import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { useDoctorSession } from '../../context/DoctorSessionContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * DoctorOverview - /doctor
 * Doctor portal overview dashboard displaying active session metrics,
 * a preview of recent lookups, quick link to Record Lookup, and workflow guidelines.
 */
export default function DoctorOverview() {
  useDocumentTitle('Overview');
  const { walletAddress } = useAuth();
  const { viewedCount, lastLookup, lookups } = useDoctorSession();

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
          <h1>Doctor Overview</h1>
          <p className="page-description">
            Access healthcare records that patients have authorized you to view.
          </p>
        </div>
        <div>
          <Link to="/doctor/lookup" className="btn btn-primary" id="go-to-lookup-header-btn">
            Go to Record Lookup
          </Link>
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

      {/* Recent Lookups Session Preview Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2>Recent Lookups (This Session)</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Records verified against smart contract permissions during your current login session.
            </p>
          </div>
          <Link to="/doctor/lookup" className="btn btn-primary btn-sm" id="open-record-lookup-btn">
            Open Record Lookup
          </Link>
        </div>
        <div className="card-body">
          {lookups.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
              No record lookups performed yet in this session. Use the Record Lookup page to verify and view records.
            </p>
          ) : (
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {lookups.slice(0, 3).map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span
                      style={{
                        fontFamily: 'Courier New, monospace',
                        fontWeight: 'var(--font-weight-semibold)',
                        fontSize: '0.875rem',
                      }}
                    >
                      Record #{item.id}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 'var(--font-weight-bold)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor:
                          item.result === 'GRANTED'
                            ? 'var(--color-success-bg)'
                            : 'var(--color-danger-bg)',
                        color:
                          item.result === 'GRANTED'
                            ? 'var(--color-success)'
                            : 'var(--color-danger)',
                      }}
                    >
                      {item.result}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                      {item.timestamp}
                    </span>
                  </div>
                  <Link
                    to="/doctor/lookup"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    View in Lookup
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
