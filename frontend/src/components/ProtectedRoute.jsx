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
  const { isLoading, isAuthenticated, role } = useAuth();

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

  if (requiredRole && role !== requiredRole) {
    const homePath = role === 'admin' ? '/admin' : role === 'doctor' ? '/doctor' : '/patient';
    return <Navigate to={homePath} replace />;
  }

  return children;
}

