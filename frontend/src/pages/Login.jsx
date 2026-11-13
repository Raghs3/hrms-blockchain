import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../api/auth';

/**
 * Login page - Professional healthcare login.
 * No password field (demo mode). Uses name + role.
 */
export default function Login() {
  const { isAuthenticated, role: existingRole, loginUser } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [role, setRole] = useState('patient');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Already logged in → redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to={existingRole === 'doctor' ? '/doctor' : '/patient'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      const userData = await login(name.trim(), role);
      loginUser({ ...userData, name: userData.name || name.trim() });
      navigate(userData.role === 'doctor' ? '/doctor' : '/patient', { replace: true });
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Left informational panel */}
      <div className="login-left-panel" aria-hidden="true">
        <div>
          <div className="login-brand-name">HealthChain</div>
          <div className="login-brand-sub">Blockchain Healthcare Records</div>
        </div>

        <div className="login-left-content">
          <h2>
            Secure. Decentralized.<br />
            Patient-controlled.
          </h2>
          <p>
            A blockchain-backed healthcare record management portal that puts
            patients in total control of medical record consent and doctor access.
          </p>
          <div className="login-features">
            <div className="login-feature-item">
              <span className="login-feature-dot"></span>
              Patient-controlled access
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot"></span>
              Secure healthcare records
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot"></span>
              Blockchain-backed permissions
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot"></span>
              Decentralized record storage
            </div>
          </div>
        </div>

        <div className="login-footer-note">
          Healthcare Record Management System • Blockchain Project
        </div>
      </div>

      {/* Right login form */}
      <div className="login-right-panel">
        <div className="login-form-container">
          <h1>Sign In</h1>
          <p className="login-subtitle">
            Access the HealthChain portal
          </p>

          <div className="demo-note" role="note">
            Enter your full name and select your role to access the portal.
          </div>

          {error && (
            <div className="error-state" role="alert" style={{ marginBottom: '20px' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="login-name">Full Name</label>
              <input
                id="login-name"
                type="text"
                className="form-control"
                placeholder="e.g. Riya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                autoComplete="name"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-role">Role</label>
              <select
                id="login-role"
                className="form-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={loading}
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
              id="login-submit-btn"
              style={{ marginTop: '8px' }}
            >
              {loading ? (
                <>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
