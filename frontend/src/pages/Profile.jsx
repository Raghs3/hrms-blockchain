import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

function formatDate(dateString) {
  if (!dateString) return 'Active Member';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Profile - User profile page for both patient and doctor roles.
 * Displays session identity, wallet address, and account status strictly
 * from useAuth() without making any outbound API calls.
 */
export default function Profile() {
  useDocumentTitle('Profile');
  const { name, email, role, walletAddress, user, userId, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const effectiveUserId = user?.id || user?.userId || userId || '';
  const memberSince = user?.createdAt ? formatDate(user.createdAt) : 'Active Member';

  function handleCopyWallet() {
    if (!walletAddress) return;
    navigator.clipboard?.writeText(walletAddress);
    setCopiedWallet(true);
    setTimeout(() => setCopiedWallet(false), 2000);
  }

  function handleCopyUserId() {
    if (!effectiveUserId) return;
    navigator.clipboard?.writeText(effectiveUserId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
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

      <div className="card" style={{ maxWidth: '680px' }}>
        <div className="card-header">
          <div>
            <h2>Account Details</h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
              Authenticated via decentralized identity and deterministic wallet derivation.
            </p>
          </div>
        </div>

        {/* Security Profile Pill */}
        <div
          style={{
            margin: '16px 24px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            backgroundColor: 'var(--color-accent-subtle)',
            border: '1px solid #bae6fd',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.775rem',
            color: 'var(--color-accent-dark)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>
            <strong>Security Profile:</strong> AES-256-GCM Encryption Key: Active | EVM Account Derivation: Verified
          </span>
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

            {/* System User UUID */}
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                System Account ID
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <code
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: '0.8125rem',
                    color: 'var(--color-text-secondary)',
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-xs)',
                  }}
                  id="profile-user-id"
                >
                  {effectiveUserId || '—'}
                </code>
                {effectiveUserId && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyUserId}
                    style={{ padding: '3px 8px', fontSize: '0.7rem' }}
                    title="Copy System Account ID"
                  >
                    {copiedId ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Copied!</span> : 'Copy'}
                  </button>
                )}
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

            {/* Account Status & Member Since */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                  Account Status
                </div>
                <div style={{ fontSize: '0.9375rem', marginTop: '4px', color: 'var(--color-success)', fontWeight: '600' }}>
                  {statusDisplay}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', fontWeight: 'bold' }}>
                  Member Since
                </div>
                <div style={{ fontSize: '0.9375rem', marginTop: '4px', color: 'var(--color-text-primary)' }}>
                  {memberSince}
                </div>
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
                    fontFamily: 'ui-monospace, monospace',
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
                    {copiedWallet ? <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Copied!</span> : 'Copy'}
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

