import axios from 'axios';
import { normalizeError } from './errors';

/**
 * Configured Axios instance (ONE API client module).
 * - Base URL from VITE_API_BASE_URL
 * - Bearer token attached from localStorage on every request
 * - Central 401 handling (clears session and redirects to /login)
 * - Errors normalized to { code, message, status } from backend 'error' code
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Authorization header from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('hrms_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(normalizeError(error))
);

// Response interceptor: central 401 handling & error normalization
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
    const requestUrl = error.config?.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (status === 401 && !isAuthEndpoint) {
      // Clear auth state on unauthorized from protected requests
      localStorage.removeItem('hrms_token');
      localStorage.removeItem('hrms_auth');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export default api;
