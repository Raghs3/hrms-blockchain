import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../api/auth';

const AuthContext = createContext(null);

const TOKEN_KEY = 'hrms_token';

/**
 * AuthProvider wraps the app and provides authentication state.
 * States:
 *   - 'loading': Verifying token with GET /auth/me on startup
 *   - 'authenticated': Token verified, user profile populated
 *   - 'unauthenticated': No token or verification failed
 */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState(() => {
    return localStorage.getItem(TOKEN_KEY) ? 'loading' : 'unauthenticated';
  });
  const [user, setUser] = useState(null);

  // Restore token on startup and verify via /auth/me
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    let isMounted = true;
    getMe()
      .then((data) => {
        if (!isMounted) return;
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!isMounted) return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('hrms_auth');
        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const loginUser = useCallback((authData) => {
    if (authData.token) {
      localStorage.setItem(TOKEN_KEY, authData.token);
    }
    const userData = authData.user || authData;
    setUser(userData);
    setStatus('authenticated');
  }, []);

  const logoutUser = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('hrms_auth');
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = {
    status,
    isLoading: status === 'loading',
    isAuthenticated: status === 'authenticated',
    user,
    role: user?.role || null,
    walletAddress: user?.walletAddress || '',
    name: user?.name || '',
    email: user?.email || '',
    userId: user?.id || user?.userId || null,
    loginUser,
    logoutUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

