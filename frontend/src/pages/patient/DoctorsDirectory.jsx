import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingState from '../../components/LoadingState';
import EmptyState from '../../components/EmptyState';
import { getDoctors } from '../../api/auth';
import useDocumentTitle from '../../hooks/useDocumentTitle';

/**
 * Truncates an Ethereum address to 0x1234...5678 format
 */
function truncateAddress(address) {
  if (!address) return '—';
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

/**
 * DoctorsDirectory - /patient/doctors
 * Directory of all approved hospital medical staff registered on-chain.
 * Patients can browse practitioners, copy verified wallet addresses,
 * and navigate directly to grant access to their medical records.
 */
export default function DoctorsDirectory() {
  useDocumentTitle('Doctors Directory');

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAddress, setCopiedAddress] = useState('');

  useEffect(() => {
    let ignore = false;
    async function fetchDoctors() {
      setLoading(true);
      setError('');
      try {
        const data = await getDoctors();
        if (!ignore) {
          setDoctors(Array.isArray(data?.doctors) ? data.doctors : []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err?.message || 'Failed to load approved hospital doctors.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    fetchDoctors();
    return () => {
      ignore = true;
    };
  }, []);

  function handleCopy(address) {
    if (!address) return;
    navigator.clipboard?.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => {
      setCopiedAddress('');
    }, 2000);
  }

  // Filter doctors by name or wallet address
  const filteredDoctors = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.walletAddress && d.walletAddress.toLowerCase().includes(q))
    );
  }, [doctors, searchQuery]);

  return (
    <Layout>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Hospital Doctors Directory</h1>
          <p className="page-description">
            Browse verified medical practitioners accredited on the blockchain. You can grant access to your encrypted records per practitioner.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link to="/patient/access" className="btn btn-secondary" id="directory-manage-access-btn">
            Manage Access & Consent
          </Link>
          <Link to="/patient/records" className="btn btn-primary" id="directory-my-records-btn">
            My Records
          </Link>
        </div>
      </div>

      {/* Summary Metrics Row */}
      <div className="summary-grid" style={{ marginBottom: '24px' }}>
        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Approved Doctors</span>
            <div className="summary-card-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value">{doctors.length}</div>
          <div className="summary-card-sub">Active hospital medical staff</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Accreditation</span>
            <div
              className="summary-card-icon"
              style={{ backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)' }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value" style={{ fontSize: '1.25rem', color: 'var(--color-success)' }}>
            Hospital Verified
          </div>
          <div className="summary-card-sub">On-chain DOCTOR_ROLE enabled</div>
        </div>

        <div className="summary-card">
          <div className="summary-card-header">
            <span className="summary-card-label">Consent Model</span>
            <div
              className="summary-card-icon"
              style={{ backgroundColor: 'var(--color-accent-light)', color: 'var(--color-accent)' }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
          <div className="summary-card-value" style={{ fontSize: '1.25rem', color: 'var(--color-accent)' }}>
            Zero Default Access
          </div>
          <div className="summary-card-sub">Explicit patient consent required</div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="form-control"
            placeholder="Search doctors by name or Ethereum wallet address (0x...)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', boxShadow: 'none', padding: '6px 0', fontSize: '0.9375rem' }}
            id="doctor-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Directory Content */}
      {loading ? (
        <LoadingState message="Loading approved hospital doctors from blockchain registry..." />
      ) : error ? (
        <div className="error-state" role="alert">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching doctors found' : 'No approved doctors registered yet'}
          description={
            searchQuery
              ? `No registered practitioners match "${searchQuery}". Try a different name or wallet address.`
              : 'There are currently no doctors approved by the hospital administrator on this network.'
          }
          action={
            searchQuery ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSearchQuery('')}
              >
                Clear Search Filter
              </button>
            ) : null
          }
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '20px',
            marginBottom: '32px',
          }}
          id="doctors-grid"
        >
          {filteredDoctors.map((doc) => {
            const isCopied = copiedAddress === doc.walletAddress;
            const initials = (doc.name || 'Dr')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={doc.walletAddress}
                className="card"
                style={{
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'transform var(--transition), box-shadow var(--transition)',
                }}
              >
                <div style={{ padding: '20px 22px' }}>
                  {/* Doctor Card Top */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0284c7 0%, #0f766e 100%)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.9375rem',
                        letterSpacing: '0.04em',
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--color-text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.name || 'Verified Doctor'}
                      </h3>
                      <div style={{ marginTop: '4px' }}>
                        <span className="badge badge-authorized" style={{ fontSize: '0.7rem' }}>
                          Approved Medical Staff
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Info Box */}
                  <div
                    style={{
                      background: 'var(--color-surface-subtle)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 12px',
                      marginBottom: '16px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-text-muted)',
                        marginBottom: '4px',
                      }}
                    >
                      Ethereum Wallet Address
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <code
                        style={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.8125rem',
                          color: 'var(--color-text-primary)',
                        }}
                        title={doc.walletAddress}
                      >
                        {truncateAddress(doc.walletAddress)}
                      </code>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleCopy(doc.walletAddress)}
                        title="Copy full wallet address"
                        style={{ padding: '2px 8px', fontSize: '0.725rem' }}
                      >
                        {isCopied ? (
                          <span style={{ color: 'var(--color-success)', fontWeight: '600' }}>Copied!</span>
                        ) : (
                          'Copy'
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Smart Contract Note */}
                  <div style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Registered in UserRegistry contract</span>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div
                  style={{
                    padding: '12px 22px',
                    borderTop: '1px solid var(--color-border-light)',
                    background: 'var(--color-surface-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)' }}>
                    Permissions: On-Demand
                  </span>
                  <Link
                    to={`/patient/access?doctor=${encodeURIComponent(doc.walletAddress)}`}
                    className="btn btn-primary btn-sm"
                    id={`grant-record-access-${doc.walletAddress.slice(2, 8).toLowerCase()}`}
                  >
                    Grant Record Access →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
