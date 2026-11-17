import { Component } from 'react';

/**
 * ErrorBoundary - Catches uncaught runtime render errors anywhere in the React tree,
 * logs them for debugging, and presents a dignified healthcare-themed recovery interface.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // Keep error logging clean and informative in development console
    console.error('Healthcare App ErrorBoundary caught an unhandled render exception:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected application error occurred.';

      return (
        <div className="error-boundary-wrapper" role="alert">
          <div className="error-boundary-card">
            <div className="error-boundary-icon" aria-hidden="true">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 className="error-boundary-title">Something went wrong</h1>
            <p className="error-boundary-desc">
              An unexpected interface error occurred. Your health records and blockchain permissions
              remain safe. You can reload the page or return to the main dashboard.
            </p>

            <div className="error-boundary-actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={this.handleReload}
                id="error-boundary-reload-btn"
              >
                Reload Application
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={this.handleGoHome}
                id="error-boundary-home-btn"
              >
                Return to Dashboard
              </button>
            </div>

            {/* Collapsible technical details for diagnostics */}
            {this.state.error && (
              <div className="error-details-box">
                <details>
                  <summary className="error-details-summary">Technical details for support</summary>
                  <pre className="error-stack-trace">
                    {errorMessage}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

