import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import api from '../../api/axios';

/**
 * AdminDashboard - /admin
 * Hospital Administrator Portal for supervising system health,
 * verifying practitioner credentials, and generating on-chain approval commands.
 */
export default function AdminDashboard() {
  useDocumentTitle('Admin Portal');
  const { name, email, userId, walletAddress } = useAuth();

  const [doctorEmail, setDoctorEmail] = useState('doctor@demo.local');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [healthStatus, setHealthStatus] = useState('checking');
  const [pingLatency, setPingLatency] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(null);

  const approvalCommand = `npm run approve-doctor -- ${doctorEmail.trim() || '<email>'}`;

  function handleCopyCommand() {
    navigator.clipboard?.writeText(approvalCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  }

  function checkHealth() {
    setHealthStatus('checking');
    const start = performance.now();
    api.get('/health')
      .then((res) => {
        const duration = Math.round(performance.now() - start);
        if (res?.data?.ok) {
          setHealthStatus('online');
          setPingLatency(duration);
        } else {
          setHealthStatus('degraded');
          setPingLatency(duration);
        }
        setLastCheckTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      })
      .catch(() => {
        setHealthStatus('offline');
        setPingLatency(null);
        setLastCheckTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      });
  }

  useEffect(() => {
    let ignore = false;
    const start = performance.now();
    api.get('/health')
      .then((res) => {
        if (!ignore) {
          const duration = Math.round(performance.now() - start);
          if (res?.data?.ok) {
            setHealthStatus('online');
            setPingLatency(duration);
          } else {
            setHealthStatus('degraded');
            setPingLatency(duration);
          }
          setLastCheckTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      })
      .catch(() => {
        if (!ignore) {
          setHealthStatus('offline');
          setPingLatency(null);
          setLastCheckTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1>Hospital Administration Portal</h1>
            <span
              className="badge"
              style={{
                fontSize: '0.7rem',
                backgroundColor: 'var(--color-primary)',
                color: '#ffffff',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                padding: '2px 8px',
              }}
            >
              Superuser
            </span>
          </div>
          <p className="page-description">
            System governance, blockchain node diagnostics, and medical staff authorization pipeline.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={checkHealth}
            disabled={healthStatus === 'checking'}
            title="Refresh system diagnostics"
          >
            {healthStatus === 'checking' ? 'Checking Node...' : 'Ping Gateway'}
          </button>
          <Link to="/admin/profile" className="btn btn-secondary" id="admin-profile-btn">
            Admin Profile
          </Link>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="dashboard-grid">
        {/* Card 1: Admin Identity */}
        <div className="summary-card">
          <span className="summary-card-icon" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          <div className="summary-card-content">
            <span className="summary-card-label">Admin Identity</span>
            <span className="summary-card-value" style={{ fontSize: '1.125rem' }}>
              {name || 'Hospital Admin'}
            </span>
            <span className="summary-card-subtext">
              {email || 'admin@demo.local'}{walletAddress ? ` • ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : ''}
            </span>
          </div>
        </div>

        {/* Card 2: Blockchain Gateway */}
        <div className="summary-card">
          <span
            className="summary-card-icon"
            style={{
              background: healthStatus === 'online' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              color: healthStatus === 'online' ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeLinecap="round"/>
              <path d="M12 6v6l4 2" strokeLinecap="round"/>
            </svg>
          </span>
          <div className="summary-card-content">
            <span className="summary-card-label">EVM Node (8545)</span>
            <span className="summary-card-value" style={{ fontSize: '1.125rem' }}>
              {healthStatus === 'online' ? 'Connected' : 'Offline'}
            </span>
            <span className="summary-card-subtext">
              {healthStatus === 'online' && pingLatency
                ? `Ping: ${pingLatency}ms${lastCheckTime ? ` (${lastCheckTime})` : ''}`
                : 'Hardhat Localhost'}
            </span>
          </div>
        </div>

        {/* Card 3: Smart Contract Security */}
        <div className="summary-card">
          <span className="summary-card-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </span>
          <div className="summary-card-content">
            <span className="summary-card-label">Smart Contracts</span>
            <span className="summary-card-value" style={{ fontSize: '1.125rem' }}>Dual Registry</span>
            <span className="summary-card-subtext">UserRegistry + RecordRegistry</span>
          </div>
        </div>

        {/* Card 4: Access Governance */}
        <div className="summary-card">
          <span className="summary-card-icon" style={{ background: '#e0e7ff', color: '#4338ca' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <div className="summary-card-content">
            <span className="summary-card-label">Access Governance</span>
            <span className="summary-card-value" style={{ fontSize: '1.125rem' }}>Zero-Trust RBAC</span>
            <span className="summary-card-subtext">Smart Contract Consent</span>
          </div>
        </div>
      </div>

      {/* Practitioner Approval Station */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Practitioner On-Chain Approval Station</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Authorize medical practitioners and register their cryptographic wallet addresses in <code>UserRegistry.sol</code>.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-light)',
              marginBottom: '20px',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '6px' }}>
              How Doctor Approval Works in HealthChain:
            </div>
            <ol style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', paddingLeft: '20px', lineHeight: 1.6 }}>
              <li>Doctors register via the portal with role <code>doctor</code> and receive initial status <code>pending</code>.</li>
              <li>Hospital administrators verify credentials and run the cryptographic approval pipeline.</li>
              <li>The pipeline derives the deterministic wallet and executes <code>UserRegistry.registerDoctor(wallet)</code> on the blockchain.</li>
              <li>Once registered on-chain, the practitioner can immediately check access and view authorized patient records.</li>
            </ol>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="doctor-email-input">
              Practitioner Email Address to Approve
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                id="doctor-email-input"
                type="email"
                className="form-control"
                placeholder="e.g. doctor@demo.local"
                value={doctorEmail}
                onChange={(e) => setDoctorEmail(e.target.value)}
                style={{ flex: 1, minWidth: '240px' }}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDoctorEmail('doctor@demo.local')}
              >
                Demo Doctor
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDoctorEmail('new.doctor@hospital.org')}
              >
                Sample Applicant
              </button>
            </div>
          </div>

          {/* Generated Command Box */}
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold', marginBottom: '6px' }}>
              Generated Administrative CLI Command
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                backgroundColor: '#0f172a',
                color: '#38bdf8',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #1e293b',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.875rem' }}>
                {approvalCommand}
              </code>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleCopyCommand}
                id="copy-approval-cmd-btn"
                style={{ fontSize: '0.75rem', padding: '4px 12px' }}
              >
                {copiedCmd ? 'Copied to Clipboard!' : 'Copy Command'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Staff Roster */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <div>
            <h2>Verified System Accounts Roster</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Pre-configured cryptographic identities initialized in the encrypted store.
            </p>
          </div>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div className="table-wrapper">
            <table className="data-table" aria-label="System staff accounts">
              <thead>
                <tr>
                  <th scope="col">Name & Role</th>
                  <th scope="col">Email Address</th>
                  <th scope="col">On-Chain Role</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <div className="table-cell-primary">{name || 'Admin User'}</div>
                    <div className="table-cell-secondary" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      ID: {userId || 'u_admin'}
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-primary">{email || 'admin@demo.local'}</div>
                  </td>
                  <td>
                    <span className="badge" style={{ backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-accent)' }}>
                      DEFAULT_ADMIN_ROLE
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-authorized">Approved</span>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="table-cell-primary">Dr. Kapoor</div>
                    <div className="table-cell-secondary" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      Practitioner
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-primary">doctor@demo.local</div>
                  </td>
                  <td>
                    <span className="badge badge-authorized">
                      DOCTOR_ROLE (Registered)
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-authorized">Approved</span>
                  </td>
                </tr>

                <tr>
                  <td>
                    <div className="table-cell-primary">Riya Sharma</div>
                    <div className="table-cell-secondary" style={{ fontFamily: 'ui-monospace, monospace' }}>
                      Patient
                    </div>
                  </td>
                  <td>
                    <div className="table-cell-primary">patient@demo.local</div>
                  </td>
                  <td>
                    <span className="badge badge-granted">
                      PATIENT_ROLE (Registered)
                    </span>
                  </td>
                  <td>
                    <span className="badge badge-authorized">Approved</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
