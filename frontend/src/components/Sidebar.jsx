import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PATIENT_NAV_ITEMS = [
  {
    label: 'Overview',
    to: '/patient',
    end: true,
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
    label: 'My Records',
    to: '/patient/records',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M3 2h10a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Upload Record',
    to: '/patient/upload',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v9M4.5 5.5L8 2l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Doctors',
    to: '/patient/doctors',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: 'Access & Consent',
    to: '/patient/access',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5.5 8l2 2 3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    to: '/patient/profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 14a5.5 5.5 0 0111 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

const DOCTOR_NAV_ITEMS = [
  {
    label: 'Overview',
    to: '/doctor',
    end: true,
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
    label: 'Record Lookup',
    to: '/doctor/lookup',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Profile',
    to: '/doctor/profile',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M2.5 14a5.5 5.5 0 0111 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

/**
 * Sidebar - Role-based navigation sidebar using NavLink with active state.
 *
 * Props:
 *   navItems: optional override array of nav items
 *   mobileOpen: boolean
 *   onMobileClose: function
 */
export default function Sidebar({ navItems, mobileOpen, onMobileClose }) {
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

  function truncateWallet(address) {
    if (!address) return '';
    if (address.length <= 14) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  const roleLabel =
    role === 'doctor' ? 'Doctor' : role === 'admin' ? 'Administrator' : 'Patient';

  const defaultItems = role === 'doctor' ? DOCTOR_NAV_ITEMS : PATIENT_NAV_ITEMS;
  const items = navItems || defaultItems;

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
          {items.map((item) => {
            if (item.to) {
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `sidebar-nav-item${isActive ? ' active' : ''}`}
                  onClick={onMobileClose}
                  id={`nav-link-${item.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                >
                  {item.icon && <span aria-hidden="true">{item.icon}</span>}
                  {item.label}
                </NavLink>
              );
            }
            return (
              <button
                key={item.label}
                type="button"
                className={`sidebar-nav-item${item.active ? ' active' : ''}`}
                aria-current={item.active ? 'page' : undefined}
                onClick={() => {
                  item.onClick?.();
                  onMobileClose?.();
                }}
              >
                {item.icon && <span aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-nav-item"
            onClick={handleLogout}
            aria-label="Sign out"
            id="sidebar-sign-out-btn"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 14H3a1 1 0 01-1-1V3a1 1 0 011-1h3M11 11l3-3m0 0l-3-3m3 3H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
