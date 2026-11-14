import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';

/**
 * NotFound - Displayed when navigating to an unrecognized route.
 * Shows an honest error message and a button returning to the user's home or login.
 */
export default function NotFound() {
  useDocumentTitle('Page Not Found');
  const { isAuthenticated, role } = useAuth();

  const homePath = isAuthenticated
    ? role === 'doctor'
      ? '/doctor'
      : '/patient'
    : '/login';

  const buttonText = isAuthenticated ? 'Back to Dashboard' : 'Back to Sign In';

  return (
    <div
      className="not-found-page"
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          padding: '40px 32px',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
          aria-hidden="true"
        >
          <svg width="28" height="28" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M10 6v5M10 14v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '8px' }}>
          Page Not Found
        </h1>
        <p
          style={{
            fontSize: '0.9375rem',
            color: 'var(--color-text-secondary)',
            marginBottom: '28px',
            lineHeight: '1.6',
          }}
        >
          The page you requested could not be found or may have been moved.
        </p>

        <Link
          to={homePath}
          className="btn btn-primary btn-lg"
          style={{ width: '100%', justifyContent: 'center' }}
          id="not-found-back-btn"
        >
          {buttonText}
        </Link>
      </div>
    </div>
  );
}

