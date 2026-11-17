/**
 * Shared error code mapping and error normalization helper.
 * Maps backend error codes to user-friendly messages.
 */

export const ERROR_MESSAGES = {
  // Auth error codes
  INVALID_CREDENTIALS: 'The email or password you entered is incorrect.',
  DOCTOR_PENDING: 'Your doctor registration is pending approval by the hospital administrator.',
  DOCTOR_REJECTED: 'Your doctor account has been rejected or disabled by the administrator.',
  EMAIL_EXISTS: 'An account with this email address already exists.',
  VALIDATION_ERROR: 'Invalid input. Please check the entered fields and try again.',
  INVALID_TOKEN: 'Your session is invalid or has expired. Please log in again.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  UNAUTHENTICATED: 'Authentication required. Please log in.',
  WRONG_ROLE: 'You do not have permission to perform this action.',
  TOO_MANY_REQUESTS: 'Too many requests. Please wait a few moments and try again.',
  INVALID_LOGIN: 'Name and a valid role (patient or doctor) are required.',

  // Record / consent error codes (from routes.js)
  FILE_REQUIRED: 'Please select a file to upload.',
  FILE_EMPTY: 'The selected file is empty. Please select a valid file with content.',
  FILE_TOO_LARGE: 'File exceeds the 10 MB limit. Please select a smaller file.',
  UNSUPPORTED_FILE_TYPE: 'Unsupported file type. Supported formats are PDF, PNG, JPG/JPEG, DOC, DOCX, and TXT.',
  FILE_CONTENT_MISMATCH: 'File content does not match its file extension. Please verify the file integrity.',
  NOT_A_PATIENT: 'Only registered patients can perform this action.',
  NOT_A_DOCTOR: 'The specified address is not a registered doctor.',
  NOT_RECORD_OWNER: 'You do not own this record and cannot modify its permissions.',
  RECORD_NOT_FOUND: 'The requested record could not be found.',
  ACCESS_DENIED: 'Access denied. You do not have permission to view this record.',
  INVALID_ADDRESS: 'Please enter a valid Ethereum wallet address (0x...).',
  INTEGRITY_CHECK_FAILED: 'Record integrity check failed. The decrypted content does not match the blockchain hash.',
  UPLOAD_ERROR: 'File upload failed. Ensure the file size is under 10 MB.',
  INTERNAL_ERROR: 'A server or blockchain error occurred. Please try again.',
  DOCTOR_NOT_FOUND: 'The specified doctor could not be found.',
  RPC_ERROR: 'Blockchain RPC node is currently unavailable. Please check the network connection and retry.',
};

/**
 * Returns a user-friendly message for a given error code.
 * @param {string} code
 * @param {string} [fallback]
 * @returns {string}
 */
export function getErrorMessage(code, fallback) {
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }
  return fallback || 'An unexpected error occurred. Please try again.';
}

/**
 * Normalizes an Axios or general error into a standardized Error object
 * with { code, message, status, raw }.
 * @param {any} error
 * @returns {Error & { code: string, status: number, raw: any }}
 */
export function normalizeError(error) {
  const code = error?.response?.data?.error || error?.code || 'UNKNOWN_ERROR';
  const backendMessage = error?.response?.data?.message;
  const friendlyMessage = getErrorMessage(code, backendMessage || error?.message);
  const status = error?.response?.status || 500;

  const normalized = new Error(friendlyMessage);
  normalized.code = code;
  normalized.status = status;
  normalized.raw = error;
  return normalized;
}
