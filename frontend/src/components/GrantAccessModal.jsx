import { useState } from 'react';
import Modal from './Modal';
import { grantAccess } from '../api/records';
import { getDoctors } from '../api/auth';
import { useToast } from '../context/ToastContext';
import { useAuditTrail } from '../context/AuditTrailContext';
import { PURPOSE_PRESETS, EXPIRY_OPTIONS, expiryIsoFromHours, describeExpiry } from './consentFormat';

const CUSTOM_PURPOSE = '__custom__';
const MAX_PURPOSE_BYTES = 128;
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function truncateHash(hash) {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * GrantAccessModal - Modal for granting a doctor access to a specific record.
 *
 * Props:
 *   record: { recordId, label, authorizedDoctors } - The record to grant access to
 *   onSuccess: function - Called after successful grant to refresh list
 */
export default function GrantAccessModal({ record, onSuccess }) {
  const { showToast } = useToast();
  const { addAuditEvent } = useAuditTrail();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [grantResult, setGrantResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [purposeChoice, setPurposeChoice] = useState(PURPOSE_PRESETS[0]);
  const [customPurpose, setCustomPurpose] = useState('');
  const [expiryIndex, setExpiryIndex] = useState(1); // default: 7 days

  async function handleOpen() {
    setIsOpen(true);
    setPurposeChoice(PURPOSE_PRESETS[0]);
    setCustomPurpose('');
    setExpiryIndex(1);
    setSelectedAddress('');
    setCustomAddress('');
    setIsCustomMode(false);
    setError('');
    setGrantResult(null);
    setCopied(false);
    setLoadingDoctors(true);

    try {
      const data = await getDoctors();
      const list = Array.isArray(data?.doctors) ? data.doctors : [];
      setDoctors(list);
      if (list.length > 0) {
        setSelectedAddress(list[0].walletAddress);
      } else {
        setIsCustomMode(true);
      }
    } catch {
      // If fetching doctors fails, fallback to custom address input
      setDoctors([]);
      setIsCustomMode(true);
    } finally {
      setLoadingDoctors(false);
    }
  }

  function handleClose() {
    if (loading) return;
    setIsOpen(false);
  }

  function handleCopyTxHash(hash) {
    if (!hash) return;
    navigator.clipboard?.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const targetAddress = (isCustomMode ? customAddress : selectedAddress).trim();

    if (!targetAddress) {
      setError('Please select an approved doctor or enter a wallet address.');
      return;
    }

    if (!ADDRESS_REGEX.test(targetAddress)) {
      setError('Please enter a valid 42-character Ethereum address (0x...).');
      return;
    }

    // Duplicate-grant guard: check if the doctor already appears in that record's authorizedDoctors
    const existingList = record.authorizedDoctors || [];
    const alreadyGranted = existingList.some(
      (doc) => doc.walletAddress?.toLowerCase() === targetAddress.toLowerCase()
    );

    if (alreadyGranted) {
      setError('This doctor already has access to this record.');
      return;
    }

    const purpose = (purposeChoice === CUSTOM_PURPOSE ? customPurpose : purposeChoice).trim();
    if (!purpose) {
      setError('Please say why this doctor needs access (for example, "Second opinion").');
      return;
    }
    if (new TextEncoder().encode(purpose).length > MAX_PURPOSE_BYTES) {
      setError(`The reason is too long (limit ${MAX_PURPOSE_BYTES} bytes).`);
      return;
    }
    const expiresAt = expiryIsoFromHours(EXPIRY_OPTIONS[expiryIndex].hours);

    setLoading(true);
    try {
      const result = await grantAccess(record.recordId, targetAddress, { purpose, expiresAt });
      setGrantResult(result);

      // Find doctor name for toast if available
      const docMatch = doctors.find(
        (d) => d.walletAddress?.toLowerCase() === targetAddress.toLowerCase()
      );
      const docDisplayName = docMatch?.name || `${targetAddress.slice(0, 6)}...${targetAddress.slice(-4)}`;

      addAuditEvent({
        type: 'ACCESS_GRANTED',
        recordId: record.recordId,
        label: record.label || `Record #${record.recordId}`,
        doctorAddress: targetAddress,
        doctorName: docDisplayName,
        txHash: result.txHash,
        purpose: result.purpose || purpose,
        expiresAt: result.expiresAt ?? expiresAt,
        timestamp: new Date().toISOString(),
      });

      showToast({
        type: 'success',
        title: 'Access granted',
        message: `${docDisplayName} can now access: ${record.label}`,
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      let message = err?.message || 'Failed to grant access. Please try again.';
      if (err?.code === 'NOT_A_PATIENT') {
        message += ' Your wallet may not be registered on the current chain. Sign out and sign in again, then retry.';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={handleOpen}
        id={`grant-access-${record.recordId}`}
      >
        Grant Access
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Grant Doctor Access">
        {grantResult ? (
          <div className="modal-body">
            <div className="success-block">
              <div className="success-title">Access granted successfully</div>
              <div className="success-detail" style={{ marginTop: '8px' }}>
                <strong>Record ID:</strong>
                <div className="hash-value" style={{ fontFamily: 'Courier New, monospace' }}>
                  {record.recordId}
                </div>
              </div>
              <div className="success-detail" style={{ marginTop: '10px' }}>
                <strong>Reason:</strong> {grantResult.purpose || '—'}
                <br />
                <strong>Access:</strong> {describeExpiry(grantResult.expiresAt)}
                {grantResult.expiresAt ? ' (ends automatically, no revoke needed)' : ''}
              </div>
              <div className="success-detail" style={{ marginTop: '10px' }}>
                <strong>Transaction Hash:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span className="hash-value" title={grantResult.txHash} style={{ fontFamily: 'Courier New, monospace' }}>
                    {truncateHash(grantResult.txHash)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => handleCopyTxHash(grantResult.txHash)}
                    aria-label="Copy transaction hash"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="modal-body">
              <p style={{ fontSize: '0.9375rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                Authorize an approved healthcare doctor to view and decrypt this record on-chain.
              </p>
              <div
                style={{
                  fontSize: '0.875rem',
                  color: 'var(--color-text-muted)',
                  marginBottom: '20px',
                  padding: '10px 14px',
                  background: 'var(--color-bg)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border-light)',
                }}
              >
                Record: <strong style={{ color: 'var(--color-text-primary)' }}>{record.label}</strong> (ID: {record.recordId})
              </div>

              {error && (
                <div className="error-state" role="alert">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {error}
                </div>
              )}

              {loadingDoctors ? (
                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <span className="spinner spinner-sm" aria-hidden="true" style={{ marginRight: '8px' }} />
                  Loading approved doctors...
                </div>
              ) : (
                <>
                  {!isCustomMode && doctors.length > 0 ? (
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" htmlFor="doctor-select" style={{ marginBottom: 0 }}>
                          Select Approved Doctor <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        <button
                          type="button"
                          className="btn-link"
                          style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          onClick={() => {
                            setIsCustomMode(true);
                            setError('');
                          }}
                        >
                          Enter custom address
                        </button>
                      </div>
                      <select
                        id="doctor-select"
                        className="form-select"
                        value={selectedAddress}
                        onChange={(e) => {
                          setSelectedAddress(e.target.value);
                          setError('');
                        }}
                        disabled={loading}
                      >
                        {doctors.map((doc) => (
                          <option key={doc.walletAddress} value={doc.walletAddress}>
                            {doc.name} ({doc.walletAddress.slice(0, 6)}...{doc.walletAddress.slice(-4)})
                          </option>
                        ))}
                      </select>
                      <div className="form-hint" style={{ marginTop: '6px', fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontFamily: 'Courier New, monospace' }}>
                        Wallet: {selectedAddress}
                      </div>
                    </div>
                  ) : (
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" htmlFor="custom-doctor-address" style={{ marginBottom: 0 }}>
                          Doctor Wallet Address <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
                        </label>
                        {doctors.length > 0 && (
                          <button
                            type="button"
                            className="btn-link"
                            style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            onClick={() => {
                              setIsCustomMode(false);
                              setError('');
                            }}
                          >
                            Choose from approved doctors
                          </button>
                        )}
                      </div>
                      {doctors.length === 0 && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                          No approved doctors yet. You can paste a doctor's wallet address directly.
                        </div>
                      )}
                      <input
                        id="custom-doctor-address"
                        type="text"
                        className="form-control"
                        placeholder="0x..."
                        value={customAddress}
                        onChange={(e) => {
                          setCustomAddress(e.target.value);
                          setError('');
                        }}
                        disabled={loading}
                        spellCheck="false"
                        autoComplete="off"
                        required
                      />
                      <div className="form-hint" style={{ marginTop: '4px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                        Enter the 42-character Ethereum address of the doctor.
                      </div>
                    </div>
                  )}
                </>
              )}

              {!loadingDoctors && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="grant-purpose">
                      Reason for access <span aria-hidden="true" style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <select
                      id="grant-purpose"
                      className="form-select"
                      value={purposeChoice}
                      onChange={(e) => {
                        setPurposeChoice(e.target.value);
                        setError('');
                      }}
                      disabled={loading}
                    >
                      {PURPOSE_PRESETS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value={CUSTOM_PURPOSE}>Other (type your own)...</option>
                    </select>
                    {purposeChoice === CUSTOM_PURPOSE && (
                      <input
                        id="grant-purpose-custom"
                        type="text"
                        className="form-control"
                        style={{ marginTop: '8px' }}
                        placeholder="e.g. Pre-surgery review"
                        value={customPurpose}
                        maxLength={100}
                        onChange={(e) => {
                          setCustomPurpose(e.target.value);
                          setError('');
                        }}
                        disabled={loading}
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="grant-expiry">
                      Access lasts
                    </label>
                    <select
                      id="grant-expiry"
                      className="form-select"
                      value={expiryIndex}
                      onChange={(e) => setExpiryIndex(Number(e.target.value))}
                      disabled={loading}
                    >
                      {EXPIRY_OPTIONS.map((o, i) => (
                        <option key={o.label} value={i}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <div className="form-hint" style={{ marginTop: '6px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                      The blockchain ends access by itself at that time. You can still revoke earlier.
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || loadingDoctors}
                id={`grant-submit-${record.recordId}`}
              >
                {loading ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    Granting...
                  </>
                ) : (
                  'Grant Access'
                )}
              </button>
            </div>
          </form>
        )}

        {grantResult && (
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Done
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
