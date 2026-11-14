import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * Profile - User profile page for both patient and doctor roles.
 * Displays session identity, wallet address, and account status strictly
 * from useAuth() without making any outbound API calls.
 */
export default function Profile() {
  useDocumentTitle('Profile');
  const { name, email, role, walletAddress, user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  function handleCopyWallet() {
    if (!walletAddress) return;
    navigator.clipboard?.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSignOut() {
    logoutUser();
    navigate('/login', { replace: true });
  }

  const roleDisplay =
    role === 'doctor'
      ? 'Doctor (Medical Practitioner)'
      : role === 'admin'
      ? 'Administrator'
      : 'Patient';

  const statusDisplay = user?.status
    ? user.status.charAt(0).toUpperCase() + user.status.slice(1)
    : 'Active';

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>User Profile</h1>
          <p className="page-description">
            Your verified identity, blockchain wallet credentials, and account details.
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '640px' }}>
        <div className="card-header">
          <div>
            <h2>Account Details</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Authenticated via decentralized identity and deterministic wallet derivation.
            </p>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Full Name */}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                Full Name
              </div>
              <div style={{ fontSize: '1.125rem', fontWeight: '600', marginTop: '4px' }}>
                {name || user?.name || '—'}
              </div>
            </div>

            {/* Email Address */}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                Email Address
              </div>
              <div style={{ fontSize: '1rem', marginTop: '4px' }}>
                {email || user?.email || '—'}
              </div>
            </div>

            {/* Role */}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                Account Role
              </div>
              <div style={{ marginTop: '4px' }}>
                <span className="badge badge-authorized" style={{ fontSize: '0.875rem' }}>
                  {roleDisplay}
                </span>
              </div>
            </div>

            {/* Account Status */}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                Account Status
              </div>
              <div style={{ fontSize: '0.9375rem', marginTop: '4px', color: 'var(--color-success)', fontWeight: '600' }}>
                {statusDisplay}
              </div>
            </div>

            {/* Connected Wallet */}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                Ethereum Wallet Address
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '6px',
                  padding: '12px 14px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <code
                  style={{
                    fontFamily: 'Courier New, monospace',
                    fontSize: '0.875rem',
                    wordBreak: 'break-all',
                    flex: 1,
                  }}
                  id="profile-wallet-address"
                >
                  {walletAddress || '—'}
                </code>
                {walletAddress && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyWallet}
                    title="Copy wallet address"
                    id="profile-copy-wallet-btn"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            </div>

            {/* Sign Out Button */}
            <div style={{ marginTop: '16px', paddingTop: '20px', borderTop: '1px solid var(--color-border-light)' }}>
              <button
                type="button"
                className="btn btn-danger-outline"
                onClick={handleSignOut}
                id="profile-sign-out-btn"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

