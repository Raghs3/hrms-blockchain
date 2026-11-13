import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

/**
 * Sidebar - Navigation sidebar for dashboards.
 *
 * Props:
 *   navItems: Array<{ label, icon, active, onClick }>
 *   mobileOpen: boolean
 *   onMobileClose: function
 */
export default function Sidebar({ navItems = [], mobileOpen, onMobileClose }) {
  const { name, role, walletAddress, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  function handleLogout() {
    logoutUser();
    navigate('/login', { replace: true });
  }

  function handleCopyWallet() {
    if (!walletAddress) return;
    navigator.clipboard?.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Truncate wallet address for display
  function truncateWallet(address) {
    if (!address) return '';
    if (address.length <= 14) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  const roleLabel =
    role === 'doctor' ? 'Doctor' : role === 'admin' ? 'Administrator' : 'Patient';

  return (
    <>
      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 99,
          }}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`} role="navigation" aria-label="Main navigation">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="app-name">HealthChain</div>
          <div className="app-subtitle">Healthcare Record System</div>
        </div>

        {/* Profile */}
        <div className="sidebar-profile">
          <div className="profile-role">{roleLabel}</div>
          <div className="profile-name">{name || '—'}</div>
          {walletAddress && (
            <div className="profile-wallet-wrapper">
              <span className="profile-wallet" title={walletAddress}>
                {truncateWallet(walletAddress)}
              </span>
              <button
                type="button"
                className="wallet-copy-btn"
                onClick={handleCopyWallet}
                title="Copy full wallet address"
                aria-label="Copy full wallet address"
              >
                {copied ? (
                  <span className="wallet-copied-text">Copied!</span>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M11 5V3a1.5 1.5 0 00-1.5-1.5h-6A1.5 1.5 0 002 3v6A1.5 1.5 0 003.5 10.5H5" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`sidebar-nav-item${item.active ? ' active' : ''}`}
              aria-current={item.active ? 'page' : undefined}
              onClick={item.onClick}
            >
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-nav-item"
            onClick={handleLogout}
            aria-label="Sign out"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3m0 0l-3-3m3 3H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

