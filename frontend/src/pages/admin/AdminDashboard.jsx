import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingState from '../../components/LoadingState';
import EmptyState from '../../components/EmptyState';
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
  const { name, email, walletAddress } = useAuth();

  const [doctorEmail, setDoctorEmail] = useState('doctor@demo.local');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [healthStatus, setHealthStatus] = useState('checking');
  const [pingLatency, setPingLatency] = useState(null);
  const [lastCheckTime, setLastCheckTime] = useState(null);

  // Pending doctors state
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [doctorsError, setDoctorsError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [copiedAddress, setCopiedAddress] = useState('');

  // Headline numbers for the overview cards (full lists live on the Users pages)
  const [userCounts, setUserCounts] = useState(null);

  const approvalCommand = `npm run approve-doctor -- ${doctorEmail.trim() || '<email>'}`;

  const fetchPendingDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    setDoctorsError('');
    try {
      const res = await api.get('/admin/pending-doctors');
      setPendingDoctors(Array.isArray(res.data?.doctors) ? res.data.doctors : []);
    } catch (err) {
      setDoctorsError(err?.message || 'Failed to load pending doctor applications.');
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  const fetchUserCounts = useCallback(async () => {
    try {
      const res = await api.get('/admin/users');
      const list = Array.isArray(res.data?.users) ? res.data.users : [];
      const doctors = list.filter((u) => u.role === 'doctor');
      const patients = list.filter((u) => u.role === 'patient');
      setUserCounts({
        doctorsApproved: doctors.filter((d) => d.status === 'approved').length,
        doctorsPending: doctors.filter((d) => d.status === 'pending').length,
        doctorsDisabled: doctors.filter((d) => d.status === 'rejected').length,
        patients: patients.length,
        records: patients.reduce((sum, p) => sum + (p.recordCount || 0), 0),
      });
    } catch {
      setUserCounts(null);
    }
  }, []);

  const refreshDoctorLists = useCallback(
    () => Promise.all([fetchPendingDoctors(), fetchUserCounts()]),
    [fetchPendingDoctors, fetchUserCounts]
  );

  useEffect(() => {
    refreshDoctorLists();
  }, [refreshDoctorLists]);

  async function handleApprove(doc) {
    const id = doc.id || doc.email;
    setActionLoading((prev) => ({ ...prev, [doc.id]: 'approving' }));
    setActionError('');
    setActionSuccess('');
    try {
      await api.post(`/admin/doctors/${encodeURIComponent(id)}/approve`);
      setActionSuccess(`Successfully approved Dr. ${doc.name} (${doc.email}). Registered in UserRegistry.`);
      await refreshDoctorLists();
    } catch (err) {
      setActionError(err?.message || `Failed to approve doctor ${doc.email}.`);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
    }
  }

  async function handleReject(doc) {
    const id = doc.id || doc.email;
    setActionLoading((prev) => ({ ...prev, [doc.id]: 'rejecting' }));
    setActionError('');
    setActionSuccess('');
    try {
      await api.post(`/admin/doctors/${encodeURIComponent(id)}/reject`);
      setActionSuccess(`Registration for Dr. ${doc.name} (${doc.email}) was rejected.`);
      await refreshDoctorLists();
    } catch (err) {
      setActionError(err?.message || `Failed to reject doctor ${doc.email}.`);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[doc.id];
        return next;
      });
    }
  }

  function handleCopyAddress(address) {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(''), 2000);
  }

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

      {/* Pending Medical Practitioner Approvals */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2>Pending Medical Practitioner Approvals</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Review applicant credentials, authorize cryptographic DOCTOR_ROLE, or reject registration.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchPendingDoctors}
            disabled={loadingDoctors}
            title="Refresh pending applications"
            id="refresh-pending-doctors-btn"
          >
            {loadingDoctors ? 'Refreshing...' : 'Refresh List'}
          </button>
        </div>

        {actionSuccess && (
          <div className="success-state" role="status" style={{ margin: '16px 20px 0' }} id="admin-action-success">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{actionSuccess}</span>
          </div>
        )}

        {actionError && (
          <div className="error-state" role="alert" style={{ margin: '16px 20px 0' }} id="admin-action-error">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span>{actionError}</span>
          </div>
        )}

        <div className="card-body">
          {loadingDoctors ? (
            <LoadingState message="Loading pending doctor applications..." />
          ) : doctorsError ? (
            <div className="error-state" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{doctorsError}</span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchPendingDoctors}
                style={{ marginLeft: '12px' }}
              >
                Retry
              </button>
            </div>
          ) : pendingDoctors.length === 0 ? (
            <EmptyState
              title="No Pending Doctor Registrations"
              description="All practitioner applications have been reviewed. New applicant registrations will appear here for administrative approval."
            />
          ) : (
            <div className="table-wrapper">
              <table className="data-table" aria-label="Pending doctor applications">
                <thead>
                  <tr>
                    <th scope="col">Practitioner</th>
                    <th scope="col">Email Address</th>
                    <th scope="col">Derived Wallet</th>
                    <th scope="col">Registration Date</th>
                    <th scope="col">Status</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingDoctors.map((doc) => {
                    const isApproving = actionLoading[doc.id] === 'approving';
                    const isRejecting = actionLoading[doc.id] === 'rejecting';
                    const isBusy = Boolean(actionLoading[doc.id]);
                    const isCopied = copiedAddress === doc.walletAddress;
                    const safeId = (doc.id || doc.email || 'doc').replace(/[^a-zA-Z0-9]/g, '-');

                    return (
                      <tr key={doc.id || doc.email}>
                        <td>
                          <div className="table-cell-primary">{doc.name || 'Dr. Applicant'}</div>
                          <div className="table-cell-secondary" style={{ fontFamily: 'ui-monospace, monospace' }}>
                            ID: {doc.id ? `${doc.id.slice(0, 8)}...` : '—'}
                          </div>
                        </td>
                        <td>
                          <div className="table-cell-primary">{doc.email}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code
                              style={{
                                fontFamily: 'ui-monospace, monospace',
                                fontSize: '0.8125rem',
                              }}
                              title={doc.walletAddress}
                            >
                              {doc.walletAddress
                                ? `${doc.walletAddress.slice(0, 6)}...${doc.walletAddress.slice(-4)}`
                                : '—'}
                            </code>
                            {doc.walletAddress && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleCopyAddress(doc.walletAddress)}
                                title="Copy full wallet address"
                                style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                              >
                                {isCopied ? 'Copied' : 'Copy'}
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>
                            {doc.createdAt
                              ? new Date(doc.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Recent'}
                          </span>
                        </td>
                        <td>
                          <span className="badge badge-revoked" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
                            Pending Approval
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApprove(doc)}
                              disabled={isBusy}
                              id={`approve-doctor-${safeId}`}
                            >
                              {isApproving ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger-outline btn-sm"
                              onClick={() => handleReject(doc)}
                              disabled={isBusy}
                              id={`reject-doctor-${safeId}`}
                            >
                              {isRejecting ? 'Rejecting...' : 'Reject'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Collapsed Fallback: CLI Command Generator */}
      <details
        style={{
          marginTop: '24px',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          backgroundColor: 'var(--color-surface)',
        }}
        id="cli-fallback-details"
      >
        <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--color-text-primary)' }}>
          Manual Administrative CLI Tool (Fallback)
        </summary>
        <div style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            If you need to approve a doctor directly via terminal script instead of the live web pipeline:
          </p>
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
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
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
      </details>

      {/* Where to manage things */}
      <div style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '1.0625rem', marginBottom: '12px' }}>Manage the system</h2>
        <div className="summary-grid">
          <Link to="/admin/doctors" className="summary-card" style={{ textDecoration: 'none', color: 'inherit' }} id="admin-card-doctors">
            <div className="summary-card-header">
              <span className="summary-card-label">Doctors</span>
            </div>
            <div className="summary-card-value">
              {userCounts ? userCounts.doctorsApproved + userCounts.doctorsPending + userCounts.doctorsDisabled : '—'}
            </div>
            <div className="summary-card-sub">
              {userCounts
                ? `${userCounts.doctorsApproved} approved · ${userCounts.doctorsPending} pending · ${userCounts.doctorsDisabled} disabled`
                : 'Approve, disable or re-enable doctors'}
            </div>
          </Link>
          <Link to="/admin/patients" className="summary-card" style={{ textDecoration: 'none', color: 'inherit' }} id="admin-card-patients">
            <div className="summary-card-header">
              <span className="summary-card-label">Patients</span>
            </div>
            <div className="summary-card-value">{userCounts ? userCounts.patients : '—'}</div>
            <div className="summary-card-sub">
              {userCounts ? `${userCounts.records} records stored in total` : 'See every registered patient'}
            </div>
          </Link>
          <Link to="/admin/audit" className="summary-card" style={{ textDecoration: 'none', color: 'inherit' }} id="admin-card-audit">
            <div className="summary-card-header">
              <span className="summary-card-label">Activity history</span>
            </div>
            <div className="summary-card-value" style={{ fontSize: '1.25rem' }}>Who did what</div>
            <div className="summary-card-sub">Uploads, access given and removed</div>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
