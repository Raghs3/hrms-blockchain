import api from './axios';
import { mockLogin } from './mock';

// VITE_USE_MOCK=false by default; mock mode only runs when explicitly set to 'true'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * Log in to the system.
 * Supports:
 * - Credentials object: login({ email, password })
 * - Direct args: login(email, password)
 * - Legacy demo args: login(name, 'patient' | 'doctor') -> calls /auth/demo-login
 *
 * @param {string|object} identifier - Email or full name, or credentials object
 * @param {string} [secretOrRole] - Password or role ('patient' | 'doctor')
 * @returns {Promise<object>}
 */
export async function login(identifier, secretOrRole) {
  if (USE_MOCK) {
    const name = typeof identifier === 'object' ? (identifier.name || identifier.email) : identifier;
    const role = typeof identifier === 'object' ? identifier.role : secretOrRole;
    return mockLogin(name, role);
  }

  // Object payload
  if (typeof identifier === 'object' && identifier !== null) {
    if (identifier.email && identifier.password) {
      const response = await api.post('/auth/login', identifier);
      return response.data;
    }
    if (identifier.name && identifier.role) {
      const response = await api.post('/auth/demo-login', identifier);
      return response.data;
    }
  }

  // Legacy demo login: name + role
  if (secretOrRole === 'patient' || secretOrRole === 'doctor') {
    const response = await api.post('/auth/demo-login', {
      name: identifier,
      role: secretOrRole,
    });
    return response.data;
  }

  // Real auth: email + password
  const response = await api.post('/auth/login', {
    email: identifier,
    password: secretOrRole,
  });
  return response.data;
}

/**
 * Register a new account.
 * POST /auth/register
 * @param {{ name: string, email: string, password: string, role: 'patient' | 'doctor' }} data
 * @returns {Promise<object>}
 */
export async function register(data) {
  const response = await api.post('/auth/register', data);
  return response.data;
}

/**
 * Get the currently authenticated user profile.
 * GET /auth/me
 * @returns {Promise<{ user: object }>}
 */
export async function getMe() {
  const response = await api.get('/auth/me');
  return response.data;
}

/**
 * List approved doctors.
 * GET /doctors
 * @returns {Promise<{ doctors: Array<{ name: string, walletAddress: string }> }>}
 */
export async function getDoctors() {
  const response = await api.get('/doctors');
  return response.data;
}
