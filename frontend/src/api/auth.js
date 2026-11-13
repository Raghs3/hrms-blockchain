import api from './axios';

/**
 * Log in to the system with email and password.
 * POST /auth/login
 *
 * @param {{ email: string, password: string } | string} credentialsOrEmail
 * @param {string} [password]
 * @returns {Promise<{ token: string, user: object }>}
 */
export async function login(credentialsOrEmail, password) {
  const payload =
    typeof credentialsOrEmail === 'object' && credentialsOrEmail !== null
      ? credentialsOrEmail
      : { email: credentialsOrEmail, password };

  const response = await api.post('/auth/login', payload);
  return response.data;
}

/**
 * Register a new account.
 * POST /auth/register
 *
 * @param {{ name: string, email: string, password: string, role: 'patient' | 'doctor' }} data
 * @returns {Promise<{ token?: string, user: object }>}
 */
export async function register(data) {
  const response = await api.post('/auth/register', data);
  return response.data;
}

/**
 * Get the currently authenticated user profile.
 * GET /auth/me
 *
 * @returns {Promise<{ user: object }>}
 */
export async function getMe() {
  const response = await api.get('/auth/me');
  return response.data;
}

/**
 * List approved doctors.
 * GET /doctors
 *
 * @returns {Promise<{ doctors: Array<{ name: string, walletAddress: string }> }>}
 */
export async function getDoctors() {
  const response = await api.get('/doctors');
  return response.data;
}

