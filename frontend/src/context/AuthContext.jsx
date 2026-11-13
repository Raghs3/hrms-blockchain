import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'hrms_auth';

/**
 * AuthProvider wraps the app and provides authentication state.
 * State is persisted in localStorage so refreshing the page
 * keeps the user logged in.
 */
export function AuthProvider({ children }) {
  const [authState, setAuthState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Keep the token in sync so the Axios interceptor can read it
  useEffect(() => {
    if (authState?.token) {
      localStorage.setItem('hrms_token', authState.token);
    } else {
      localStorage.removeItem('hrms_token');
    }
  }, [authState?.token]);

  function loginUser(userData) {
    const user = userData.user || userData;
    const state = {
      token: userData.token,
      role: user.role,
      walletAddress: user.walletAddress,
      userId: user.userId || user.id,
      name: user.name,
      email: user.email,
      status: user.status,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem('hrms_token', userData.token);
    setAuthState(state);
  }

  function logoutUser() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('hrms_token');
    setAuthState(null);
  }

  const value = {
    ...authState,
    isAuthenticated: !!authState?.token,
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
