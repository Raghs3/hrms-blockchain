import { useState, useEffect } from 'react';
import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login, register, demoLogin } from '../api/auth';
import api from '../api/axios';
import LoadingState from '../components/LoadingState';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login & Register Page.
 * - Tabs for Sign In and Create Account
 * - Client-side validation with authoritative backend response handling
 * - Distinct handling for DOCTOR_PENDING, DOCTOR_REJECTED, INVALID_CREDENTIALS, EMAIL_EXISTS, VALIDATION_ERROR
 * - Dedicated Pending Approval view for newly registered doctors
 */
export default function Login() {
  const { isLoading, isAuthenticated, role: currentRole, loginUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === '1';

  // Mode: 'login' | 'register'
  const [tab, setTab] = useState('login');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRole, setRegRole] = useState('patient');

  // Status & error states
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [doctorPendingData, setDoctorPendingData] = useState(null);

  // Persona quick-login enabled ONLY when GET /health returns demoAuth: true or VITE_DEMO_AUTH=true
  const [demoAuthEnabled, setDemoAuthEnabled] = useState(
    () => import.meta.env.VITE_DEMO_AUTH === 'true'
  );

  useEffect(() => {
    let isMounted = true;
    api
      .get('/health')
      .then((res) => {
        if (isMounted) {
          setDemoAuthEnabled(res.data?.demoAuth === true || import.meta.env.VITE_DEMO_AUTH === 'true');
        }
      })
      .catch(() => {
        if (isMounted && import.meta.env.VITE_DEMO_AUTH !== 'true') {
          setDemoAuthEnabled(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // If session verification is in progress
  if (isLoading) {
    return (
      <div className="login-page">
        <div className="login-right-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <LoadingState message="Verifying session..." />
        </div>
      </div>
    );
  }

  // Already authenticated → redirect to appropriate dashboard
  if (isAuthenticated) {
    const home = currentRole === 'admin' ? '/admin' : currentRole === 'doctor' ? '/doctor' : '/patient';
    return <Navigate to={home} replace />;
  }

  // Handle Login submission
  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    const email = loginEmail.trim();
    const password = loginPassword;

    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await login({ email, password });
      loginUser(res);
      const targetRole = res.user?.role;
      const home = targetRole === 'admin' ? '/admin' : targetRole === 'doctor' ? '/doctor' : '/patient';
      navigate(home, { replace: true });
    } catch (err) {
      if (err?.code === 'DOCTOR_REJECTED') {
        setError('Your doctor account has been rejected or disabled by the administrator.');
      } else if (err?.code === 'DOCTOR_PENDING') {
        setError('Your doctor registration is pending approval by the hospital administrator.');
      } else {
        setError(err?.message || 'Login failed. Please check your credentials.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Handle optional persona quick-login (POST /auth/demo-login)
  async function handleDemoLogin(name, role) {
    setError('');
    setSubmitting(true);
    try {
      const res = await demoLogin({ name, role });
      loginUser(res);
      const targetRole = res.role || res.user?.role || role;
      const home = targetRole === 'admin' ? '/admin' : targetRole === 'doctor' ? '/doctor' : '/patient';
      navigate(home, { replace: true });
    } catch (err) {
      setError(err?.message || 'Demo quick-login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Register submission
  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    const name = regName.trim();
    const email = regEmail.trim();
    const password = regPassword;
    const confirmPassword = regConfirmPassword;

    if (!name) {
      setError('Please enter your full name.');
      return;
    }
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await register({
        name,
        email,
        password,
        role: regRole,
      });

      if (regRole === 'doctor') {
        // Doctor registrations require admin approval; backend returns 201 { user } with status "pending"
        setDoctorPendingData(res.user);
      } else {
        // Patients are approved immediately and receive a JWT token
        loginUser(res);
        navigate('/patient', { replace: true });
      }
    } catch (err) {
      setError(err?.message || 'Registration failed. Please check your information.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      {/* Left informational branding panel */}
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
              <span className="login-feature-dot" />
              Patient-controlled access
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot" />
              Secure healthcare records
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot" />
              Blockchain-backed permissions
            </div>
            <div className="login-feature-item">
              <span className="login-feature-dot" />
              Decentralized record storage
            </div>
          </div>
        </div>

        <div className="login-footer-note">
          Healthcare Record Management System • Blockchain Project
        </div>
      </div>

      {/* Right panel: Sign In / Register / Doctor Pending */}
      <div className="login-right-panel">
        <div className="login-form-container">
          {doctorPendingData ? (
            /* Doctor Pending Approval Screen */
            <div className="doctor-pending-card" role="region" aria-label="Registration Pending">
              <div className="doctor-pending-icon" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <h2 className="doctor-pending-title">Registration Submitted</h2>
              <div className="doctor-pending-badge">Pending Administrator Approval</div>
              <p className="doctor-pending-desc">
                Your doctor account application for <strong>{doctorPendingData.email}</strong> has
                been recorded. In accordance with hospital protocol, doctor accounts require
                verification and approval by an administrator before access is granted.
              </p>
              <div className="doctor-pending-info">
                Once approved by the administrator, you will be able to sign in using your email and password to access shared patient records.
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                onClick={() => {
                  setDoctorPendingData(null);
                  setTab('login');
                  setError('');
                }}
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="auth-tab-group" role="tablist" aria-label="Authentication Options">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'login'}
                  className={`auth-tab-btn${tab === 'login' ? ' active' : ''}`}
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'register'}
                  className={`auth-tab-btn${tab === 'register' ? ' active' : ''}`}
                  onClick={() => {
                    setTab('register');
                    setError('');
                  }}
                >
                  Create Account
                </button>
              </div>

              {isExpired && !error && (
                <div className="warning-state" role="alert" style={{ marginBottom: '20px' }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  Your session has expired. Please sign in again.
                </div>
              )}

              {error && (
                <div
                  className="error-state"
                  role="alert"
                  style={{ marginBottom: '20px' }}
                  data-testid="auth-error-alert"
                  id="auth-error-banner"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span id="login-error-text">{error}</span>
                </div>
              )}

              {tab === 'login' ? (
                /* Sign In Form */
                <form onSubmit={handleLogin} noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-email">Email Address</label>
                    <input
                      id="login-email"
                      type="email"
                      className="form-control"
                      placeholder="name@example.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={submitting}
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="login-password">Password</label>
                    <input
                      id="login-password"
                      type="password"
                      className="form-control"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={submitting}
                      autoComplete="current-password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block btn-lg"
                    disabled={submitting}
                    id="login-submit-btn"
                    style={{ marginTop: '16px' }}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner spinner-sm" aria-hidden="true" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </button>

                  {/* Optional Persona Quick-Login via POST /auth/demo-login (rendered ONLY when demoAuth: true or VITE_DEMO_AUTH=true) */}
                  {demoAuthEnabled && (
                    <div
                      style={{
                        marginTop: '20px',
                        padding: '12px 14px',
                        background: 'var(--color-surface-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--color-border-light)',
                      }}
                      id="demo-persona-login"
                    >
                      <div
                        style={{
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          color: 'var(--color-text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          marginBottom: '8px',
                        }}
                      >
                        Demo Persona Quick-Login
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={submitting}
                          onClick={() => handleDemoLogin('Riya Sharma', 'patient')}
                          id="demo-login-patient"
                        >
                          Patient (Riya Sharma)
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={submitting}
                          onClick={() => handleDemoLogin('Dr. Kapoor', 'doctor')}
                          id="demo-login-doctor"
                        >
                          Doctor (Dr. Kapoor)
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              ) : (
                /* Create Account Form */
                <form onSubmit={handleRegister} noValidate>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-name">Full Name</label>
                    <input
                      id="reg-name"
                      type="text"
                      className="form-control"
                      placeholder="Your Full Name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      disabled={submitting}
                      autoComplete="name"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-email">Email Address</label>
                    <input
                      id="reg-email"
                      type="email"
                      className="form-control"
                      placeholder="name@example.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      disabled={submitting}
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-role">Account Role</label>
                    <select
                      id="reg-role"
                      className="form-select"
                      value={regRole}
                      onChange={(e) => setRegRole(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="patient">Patient (Instant access)</option>
                      <option value="doctor">Doctor (Requires administrator approval)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-password">Password</label>
                    <input
                      id="reg-password"
                      type="password"
                      className="form-control"
                      placeholder="Minimum 8 characters"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      disabled={submitting}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-confirm-password">Confirm Password</label>
                    <input
                      id="reg-confirm-password"
                      type="password"
                      className="form-control"
                      placeholder="Re-enter password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      disabled={submitting}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block btn-lg"
                    disabled={submitting}
                    id="register-submit-btn"
                    style={{ marginTop: '16px' }}
                  >
                    {submitting ? (
                      <>
                        <span className="spinner spinner-sm" aria-hidden="true" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
