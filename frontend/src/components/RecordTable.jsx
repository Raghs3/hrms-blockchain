import { Link } from 'react-router-dom';
import LoadingState from './LoadingState';
import EmptyState from './EmptyState';
import GrantAccessModal from './GrantAccessModal';
import RevokeAccessModal from './RevokeAccessModal';

function truncateHash(hash) {
  if (!hash) return '—';
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

/**
 * RecordTable - Patient's record list as a professional data table.
 *
 * Props:
 *   records: array of record objects (sorted newest-first)
 *   loading: boolean
 *   error: string
 *   onRecordUpdate: function - Called when a record is updated (grant/revoke)
 *   onRetry: function - Called to retry loading records on error
 *   mode: 'records' | 'access' | 'preview' | 'all' (default: 'all')
 */
export default function RecordTable({
  records = [],
  loading,
  error,
  onRecordUpdate,
  onRetry,
  mode = 'all',
}) {
  function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (loading) {
    return <LoadingState message="Loading healthcare records from blockchain..." />;
  }

  if (error) {
    return (
      <div
        className="error-state"
        role="alert"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </div>
        {onRetry && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRetry}
            style={{ marginLeft: 'auto' }}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!records || records.length === 0) {
    return (
      <EmptyState
        title="No healthcare records yet"
        description="Upload your first medical record to get started with secure blockchain storage and doctor consent."
        action={
          <Link to="/patient/upload" className="btn btn-primary" id="upload-first-record-link">
            Upload your first record
          </Link>
        }
      />
    );
  }

  const displayedRecords = mode === 'preview' ? records.slice(0, 3) : records;

  return (
    <div className="table-wrapper">
      <table className="data-table" aria-label="Patient medical records">
        <thead>
          <tr>
            <th scope="col">Record</th>
            <th scope="col">Uploaded</th>
            {mode === 'records' && <th scope="col">IPFS CID</th>}
            {(mode === 'access' || mode === 'all') && <th scope="col">Authorized Doctors</th>}
            <th scope="col">Status</th>
            <th scope="col">{mode === 'records' || mode === 'preview' ? 'Access' : 'Actions'}</th>
          </tr>
        </thead>
        <tbody>
          {displayedRecords.map((record) => {
            const hasDoctors = Array.isArray(record.authorizedDoctors) && record.authorizedDoctors.length > 0;
            return (
              <tr key={record.recordId}>
                {/* Record info */}
                <td>
                  <div className="table-cell-primary">{record.label || 'Untitled Record'}</div>
                  <div className="table-cell-secondary" style={{ fontFamily: 'Courier New, monospace' }}>
                    ID: {record.recordId}
                  </div>
                </td>

                {/* Date */}
                <td>
                  <div className="table-cell-primary">{formatDate(record.uploadedAt)}</div>
                </td>

                {/* IPFS CID column (for records mode) */}
                {mode === 'records' && (
                  <td>
                    <span
                      style={{ fontFamily: 'Courier New, monospace', fontSize: '0.8125rem' }}
                      title={record.cid}
                    >
                      {truncateHash(record.cid)}
                    </span>
                  </td>
                )}

                {/* Authorized doctors (for access / all modes) */}
                {(mode === 'access' || mode === 'all') && (
                  <td>
                    {hasDoctors ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {record.authorizedDoctors.map((doc) => (
                          <div key={doc.walletAddress} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="doctor-chip" title={doc.walletAddress}>
                              {doc.name || `${doc.walletAddress.slice(0, 6)}...${doc.walletAddress.slice(-4)}`}
                            </span>
                            <RevokeAccessModal
                              record={record}
                              doctor={doc}
                              onSuccess={() => onRecordUpdate && onRecordUpdate()}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="no-doctors" style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        No doctors authorized
                      </span>
                    )}
                  </td>
                )}

                {/* Status Badge */}
                <td>
                  {hasDoctors ? (
                    <span className="badge badge-authorized">Authorized</span>
                  ) : (
                    <span className="badge badge-neutral">Private</span>
                  )}
                </td>

                {/* Actions / Access Link */}
                <td>
                  {mode === 'records' || mode === 'preview' ? (
                    <Link
                      to="/patient/access"
                      className="btn btn-secondary btn-sm"
                      id={`manage-access-${record.recordId}`}
                    >
                      Manage access
                    </Link>
                  ) : (
                    <div className="table-actions">
                      <GrantAccessModal
                        record={record}
                        onSuccess={() => onRecordUpdate && onRecordUpdate()}
                      />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
