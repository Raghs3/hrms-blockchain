import { useState } from 'react';
import Modal from './Modal';
import { revokeAccess } from '../api/records';
import { useToast } from '../context/ToastContext';
import { useAuditTrail } from '../context/AuditTrailContext';

function truncateHash(hash) {
  if (!hash) return '';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

/**
 * RevokeAccessModal - Confirmation modal for revoking a doctor's access.
 *
 * Props:
 *   record: { recordId, label }
 *   doctor: { walletAddress, name }
 *   onSuccess: function - Called after successful revoke to refresh record list
 */
export default function RevokeAccessModal({ record, doctor, onSuccess }) {
  const { showToast } = useToast();
  const { addAuditEvent } = useAuditTrail();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revokeResult, setRevokeResult] = useState(null);
  const [copied, setCopied] = useState(false);

  function handleOpen() {
    setIsOpen(true);
    setError('');
    setRevokeResult(null);
    setCopied(false);
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

  async function handleRevoke() {
    setError('');
    setLoading(true);
    try {
      const result = await revokeAccess(record.recordId, doctor.walletAddress);
      setRevokeResult(result);
      addAuditEvent({
        type: 'ACCESS_REVOKED',
        recordId: record.recordId,
        label: record.label || `Record #${record.recordId}`,
        doctorAddress: doctor.walletAddress,
        doctorName: doctor.name || 'Doctor',
        txHash: result.txHash,
        timestamp: new Date().toISOString(),
      });
      showToast({
        type: 'info',
        title: 'Access revoked',
        message: `${doctor.name || 'Doctor'}'s access to "${record.label}" has been revoked.`,
      });
      if (onSuccess) {
        onSuccess(doctor.walletAddress);
      }
    } catch (err) {
      let message = err?.message || 'Failed to revoke access. Please try again.';
      if (err?.code === 'NOT_A_PATIENT') {
        message += ' Your wallet may not be registered on the current chain. Sign out and sign in again, then retry.';
      }
      setError(message);
      // For stale / repeated revoke attempts, also refresh the list so any out-of-sync UI updates
      if (onSuccess) {
        onSuccess(doctor.walletAddress);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-sm btn-danger-outline"
        onClick={handleOpen}
        id={`revoke-access-${record.recordId}-${doctor.walletAddress}`}
      >
        Revoke
      </button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Revoke Doctor Access">
        {revokeResult ? (
          <div className="modal-body">
            <div
              style={{
                padding: '16px',
                background: 'var(--color-warning-bg)',
                border: '1px solid #e8c97a',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                  color: 'var(--color-warning)',
                  marginBottom: '8px',
                }}
              >
                Access revoked successfully
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)' }}>
                <strong>Transaction Hash:</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                  <span
                    style={{
                      fontFamily: 'Courier New, monospace',
                      wordBreak: 'break-all',
                      background: 'rgba(255,255,255,0.7)',
                      padding: '4px 8px',
                      borderRadius: '3px',
                      color: 'var(--color-text-primary)',
                    }}
                    title={revokeResult.txHash}
                  >
                    {truncateHash(revokeResult.txHash)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={() => handleCopyTxHash(revokeResult.txHash)}
                    aria-label="Copy transaction hash"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="modal-body">
            {error && (
              <div className="error-state" role="alert" style={{ marginBottom: '16px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-light)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Doctor: <strong style={{ color: 'var(--color-text-primary)' }}>{doctor.name || 'Unnamed Doctor'}</strong>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Record: <strong style={{ color: 'var(--color-text-primary)' }}>{record.label}</strong> (ID: {record.recordId})
              </div>
            </div>

            <p className="confirm-text" style={{ fontSize: '1rem', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
              Are you sure you want to revoke this doctor&apos;s access?
            </p>
            <p
              className="confirm-text"
              style={{ marginTop: '8px', color: 'var(--color-text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}
            >
              This revocation is confirmed on the blockchain. Once revoked, the doctor will no longer be able to decrypt or view this medical record.
            </p>

            <div
              style={{
                marginTop: '14px',
                padding: '10px 12px',
                background: 'var(--color-bg)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-light)',
              }}
            >
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                Doctor Wallet Address
              </div>
              <div
                style={{
                  fontFamily: 'Courier New, monospace',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-secondary)',
                  wordBreak: 'break-all',
                }}
              >
                {doctor.walletAddress}
              </div>
            </div>
          </div>
        )}

        <div className="modal-footer">
          {revokeResult ? (
            <button type="button" className="btn btn-secondary" onClick={handleClose}>
              Done
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleRevoke}
                disabled={loading}
                id={`revoke-confirm-${record.recordId}`}
              >
                {loading ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    Revoking...
                  </>
                ) : (
                  'Revoke Access'
                )}
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
