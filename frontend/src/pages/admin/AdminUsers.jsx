import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import LoadingState from '../../components/LoadingState';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import api from '../../api/axios';

const VIEWS = {
  all: {
    title: 'All Users',
    description: 'Everyone with an account: administrators, doctors and patients.',
    docTitle: 'All Users',
  },
  doctor: {
    title: 'Doctors',
    description: 'Approve new doctors, and disable or re-enable existing ones.',
    docTitle: 'Doctors',
  },
  patient: {
    title: 'Patients',
    description: 'Every registered patient and how many records they have stored.',
    docTitle: 'Patients',
  },
};

function shortAddress(address) {
  if (!address) return '—';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

const ROLE_LABEL = { admin: 'Administrator', doctor: 'Doctor', patient: 'Patient' };

function StatusBadge({ user }) {
  if (user.role !== 'doctor') {
    return <span className="badge badge-authorized">Active</span>;
  }
  if (user.status === 'approved') return <span className="badge badge-authorized">Approved</span>;
  if (user.status === 'rejected') return <span className="badge badge-revoked">Disabled</span>;
  return (
    <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309' }}>
      Pending approval
    </span>
  );
}

function SummaryCard({ label, value, sub, tone }) {
  const color =
    tone === 'good' ? 'var(--color-success)' : tone === 'warn' ? '#b45309' : tone === 'bad' ? 'var(--color-danger, #b91c1c)' : undefined;
  return (
    <div className="summary-card">
      <div className="summary-card-header">
        <span className="summary-card-label">{label}</span>
      </div>
      <div className="summary-card-value" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="summary-card-sub">{sub}</div>
    </div>
  );
}

/**
 * AdminUsers - /admin/users, /admin/doctors, /admin/patients
 * One page, three views over GET /admin/users. Doctors can be approved, rejected,
 * disabled and re-enabled from here.
 */
export default function AdminUsers({ view = 'all' }) {
  const config = VIEWS[view] || VIEWS.all;
  useDocumentTitle(config.docTitle);
  const { email: myEmail } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null); // { kind: 'success' | 'error', text }
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // doctors only
  const [roleFilter, setRoleFilter] = useState('all'); // "All users" view only
  const [busy, setBusy] = useState({}); // userId -> 'approving' | 'rejecting' | 'disabling' | 'enabling'
  const [confirmDisableId, setConfirmDisableId] = useState(null);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await api.get('/admin/users');
      setUsers(Array.isArray(res.data?.users) ? res.data.users : []);
    } catch (err) {
      setError(err?.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const doctors = useMemo(() => users.filter((u) => u.role === 'doctor'), [users]);
  const patients = useMemo(() => users.filter((u) => u.role === 'patient'), [users]);
  const admins = useMemo(() => users.filter((u) => u.role === 'admin'), [users]);
  const doctorCounts = {
    approved: doctors.filter((d) => d.status === 'approved').length,
    pending: doctors.filter((d) => d.status === 'pending').length,
    rejected: doctors.filter((d) => d.status === 'rejected').length,
  };
  const totalRecords = patients.reduce((sum, p) => sum + (p.recordCount || 0), 0);
  const patientsWithoutRecords = patients.filter((p) => p.recordCount === 0).length;

  const rows = useMemo(() => {
    let list = users;
    if (view === 'doctor') list = doctors;
    else if (view === 'patient') list = patients;
    else if (roleFilter !== 'all') list = users.filter((u) => u.role === roleFilter);

    if (statusFilter !== 'all' && (view === 'doctor' || roleFilter === 'doctor')) {
      list = list.filter((u) => u.role !== 'doctor' || u.status === statusFilter);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.walletAddress && u.walletAddress.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, doctors, patients, view, roleFilter, statusFilter, search]);

  async function act(user, action, url, successText) {
    setBusy((prev) => ({ ...prev, [user.id]: action }));
    setNotice(null);
    try {
      await api.post(url);
      setNotice({ kind: 'success', text: successText });
      setConfirmDisableId(null);
      await load();
    } catch (err) {
      setNotice({ kind: 'error', text: err?.message || `Action failed for ${user.email}.` });
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[user.id];
        return next;
      });
    }
  }

  const approve = (u) =>
    act(u, 'approving', `/admin/doctors/${encodeURIComponent(u.id)}/approve`, `${u.name} has been approved and can now sign in.`);
  const reject = (u) =>
    act(u, 'rejecting', `/admin/doctors/${encodeURIComponent(u.id)}/reject`, `${u.name}'s application was rejected.`);
  const disable = (u) =>
    act(u, 'disabling', `/admin/doctors/${encodeURIComponent(u.id)}/reject`, `${u.name} has been disabled. They can no longer sign in or view records.`);
  const reenable = (u) =>
    act(u, 'enabling', `/admin/doctors/${encodeURIComponent(u.id)}/approve`, `${u.name} has been re-enabled.`);

  function copyAddress(address) {
    navigator.clipboard?.writeText(address);
    setCopied(address);
    setTimeout(() => setCopied(''), 2000);
  }

  const showRecordsColumn = view !== 'doctor';
  const showStatusFilter = view === 'doctor' || (view === 'all' && roleFilter === 'doctor');

  function renderActions(user) {
    if (user.role !== 'doctor') return null;
    const b = busy[user.id];
    const idSafe = (user.id || '').replace(/[^a-zA-Z0-9]/g, '-');

    if (user.status === 'pending') {
      return (
        <div style={{ display: 'inline-flex', gap: '8px' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => approve(user)} disabled={Boolean(b)} id={`approve-doctor-${idSafe}`}>
            {b === 'approving' ? 'Approving...' : 'Approve'}
          </button>
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => reject(user)} disabled={Boolean(b)} id={`reject-doctor-${idSafe}`}>
            {b === 'rejecting' ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      );
    }
    if (user.status === 'rejected') {
      return (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => reenable(user)} disabled={Boolean(b)} id={`reenable-doctor-${idSafe}`}>
          {b === 'enabling' ? 'Re-enabling...' : 'Re-enable'}
        </button>
      );
    }
    if (confirmDisableId === user.id) {
      return (
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => disable(user)} disabled={Boolean(b)} id={`confirm-disable-doctor-${idSafe}`}>
            {b === 'disabling' ? 'Disabling...' : 'Confirm disable'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmDisableId(null)} disabled={Boolean(b)}>
            Cancel
          </button>
        </div>
      );
    }
    return (
      <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setConfirmDisableId(user.id)} disabled={Boolean(b)} id={`disable-doctor-${idSafe}`}>
        Disable
      </button>
    );
  }

  return (
    <Layout>
      <div className="page-header">
        <div className="page-header-left">
          <h1>{config.title}</h1>
          <p className="page-description">{config.description}</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => { setLoading(true); load(); }} disabled={loading} id="refresh-users-btn">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div className="summary-grid" style={{ marginBottom: '24px' }}>
          {view === 'all' && (
            <>
              <SummaryCard label="Total users" value={users.length} sub={`${admins.length} admin · ${doctors.length} doctors · ${patients.length} patients`} />
              <SummaryCard label="Doctors" value={doctors.length} sub={`${doctorCounts.approved} approved · ${doctorCounts.pending} pending · ${doctorCounts.rejected} disabled`} />
              <SummaryCard label="Patients" value={patients.length} sub={`${totalRecords} records stored in total`} />
            </>
          )}
          {view === 'doctor' && (
            <>
              <SummaryCard label="Approved" value={doctorCounts.approved} sub="Can sign in and view shared records" tone="good" />
              <SummaryCard label="Waiting for approval" value={doctorCounts.pending} sub="Cannot sign in yet" tone={doctorCounts.pending ? 'warn' : undefined} />
              <SummaryCard label="Disabled / rejected" value={doctorCounts.rejected} sub="Blocked from signing in" tone={doctorCounts.rejected ? 'bad' : undefined} />
            </>
          )}
          {view === 'patient' && (
            <>
              <SummaryCard label="Patients" value={patients.length} sub="Registered accounts" />
              <SummaryCard label="Records stored" value={totalRecords} sub="Encrypted records on the blockchain" />
              <SummaryCard label="No records yet" value={patientsWithoutRecords} sub="Patients who have not uploaded anything" />
            </>
          )}
        </div>
      )}

      {notice && (
        <div
          className={notice.kind === 'success' ? 'success-state' : 'error-state'}
          role={notice.kind === 'success' ? 'status' : 'alert'}
          style={{ marginBottom: '16px' }}
          id="admin-users-notice"
        >
          <span>{notice.text}</span>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '16px', padding: '14px 20px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by name, email or wallet address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1 1 260px', maxWidth: '420px' }}
            id="admin-users-search"
            aria-label="Search users"
          />
          {view === 'all' && (
            <div role="group" aria-label="Filter by role" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                ['all', `Everyone (${users.length})`],
                ['doctor', `Doctors (${doctors.length})`],
                ['patient', `Patients (${patients.length})`],
                ['admin', `Admins (${admins.length})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn btn-sm ${roleFilter === id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRoleFilter(id)}
                  aria-pressed={roleFilter === id}
                  id={`filter-role-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {showStatusFilter && (
            <div role="group" aria-label="Filter by status" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                ['all', 'Any status'],
                ['approved', `Approved (${doctorCounts.approved})`],
                ['pending', `Pending (${doctorCounts.pending})`],
                ['rejected', `Disabled (${doctorCounts.rejected})`],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`btn btn-sm ${statusFilter === id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStatusFilter(id)}
                  aria-pressed={statusFilter === id}
                  id={`filter-status-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <LoadingState message="Loading users..." />
      ) : error ? (
        <div className="error-state" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); load(); }} style={{ marginLeft: '12px' }}>
            Try again
          </button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={search || statusFilter !== 'all' || roleFilter !== 'all' ? 'No users match these filters' : 'No users yet'}
          description={
            search || statusFilter !== 'all' || roleFilter !== 'all'
              ? 'Try a different search or clear the filters.'
              : 'Accounts will show up here once people register.'
          }
          action={
            search || statusFilter !== 'all' || roleFilter !== 'all' ? (
              <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setStatusFilter('all'); setRoleFilter('all'); }}>
                Clear filters
              </button>
            ) : null
          }
        />
      ) : (
        <div className="card">
          <div className="table-wrapper">
            <table className="data-table" aria-label="Users">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Email</th>
                  <th scope="col">Wallet</th>
                  <th scope="col">Status</th>
                  {showRecordsColumn && <th scope="col">Records</th>}
                  <th scope="col">Joined</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((user) => (
                  <tr key={user.id} data-user-role={user.role} data-user-status={user.status}>
                    <td>
                      <div className="table-cell-primary">
                        {user.name}
                        {user.email && myEmail && user.email.toLowerCase() === myEmail.toLowerCase() && (
                          <span className="badge badge-neutral" style={{ marginLeft: '8px', fontSize: '0.65rem' }}>You</span>
                        )}
                      </div>
                      <div className="table-cell-secondary">{ROLE_LABEL[user.role] || user.role}</div>
                    </td>
                    <td>
                      <div className="table-cell-primary">{user.email}</div>
                    </td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.8125rem' }} title={user.walletAddress}>
                          {shortAddress(user.walletAddress)}
                        </code>
                        {user.walletAddress && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => copyAddress(user.walletAddress)}
                            style={{ padding: '2px 6px', fontSize: '0.7rem' }}
                            title="Copy full wallet address"
                          >
                            {copied === user.walletAddress ? 'Copied' : 'Copy'}
                          </button>
                        )}
                      </span>
                    </td>
                    <td>
                      <StatusBadge user={user} />
                    </td>
                    {showRecordsColumn && (
                      <td>
                        {user.role === 'patient' ? (
                          user.recordCount === null || user.recordCount === undefined ? '—' : user.recordCount
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>
                    )}
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{formatDate(user.createdAt)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{renderActions(user)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 20px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
            Showing {rows.length} of {users.length} accounts.
            {view !== 'patient' && (
              <> Disabling a doctor blocks their sign-in and any open session; their on-chain role stays, but the backend refuses to act for them.</>
            )}
          </div>
        </div>
      )}

      {view === 'all' && !loading && !error && (
        <p style={{ marginTop: '16px', fontSize: '0.8125rem' }}>
          Looking for something specific? <Link to="/admin/doctors">Manage doctors</Link> · <Link to="/admin/patients">View patients</Link> ·{' '}
          <Link to="/admin/audit">Activity history</Link>
        </p>
      )}
    </Layout>
  );
}
