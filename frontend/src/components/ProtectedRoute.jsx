import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingState from './LoadingState';

/**
 * ProtectedRoute - Guards routes based on authentication and role.
 *
 * Props:
 *   requiredRole: 'patient' | 'doctor' (optional)
 *
 * Behavior:
 *   - Loading → show loading spinner
 *   - Not authenticated → redirect to /login
 *   - Admin role → display dedicated honest Admin notice (managed via CLI)
 *   - Wrong role → redirect to user's home dashboard
 */
export default function ProtectedRoute({ children, requiredRole }) {
  const { isLoading, isAuthenticated, role, email, logoutUser } = useAuth();

  if (isLoading) {
    return (
      <div className="route-loading-container" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState message="Verifying session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'admin') {
    return (
      <div className="admin-notice-page">
        <div className="admin-notice-card">
          <div className="admin-notice-badge">Admin Access</div>
          <h2>Administrator Account</h2>
          <p className="admin-notice-email">
            Signed in as <strong>{email}</strong>
          </p>
          <div className="admin-notice-box">
            <p>
              Admin accounts are managed via backend scripts (e.g. <code>npm run approve-doctor</code>).
              There is no patient or doctor portal interface for administrator roles.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              logoutUser();
              window.location.href = '/login';
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to={role === 'patient' ? '/patient' : '/doctor'} replace />;
  }

  return children;
}

