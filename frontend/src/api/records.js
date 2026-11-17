import api from './axios';
import {
  mockGetMyRecords,
  mockUploadRecord,
  mockGrantAccess,
  mockRevokeAccess,
  mockCheckAccess,
  mockViewRecord,
} from './mock';

// VITE_USE_MOCK=false by default; mock mode only runs when explicitly set to 'true'
const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

/**
 * GET /records/mine
 * Returns the authenticated patient's record list.
 */
export async function getMyRecords() {
  if (USE_MOCK) {
    return mockGetMyRecords();
  }
  const response = await api.get('/records/mine');
  return response.data;
}

/**
 * POST /records/upload
 * @param {FormData} formData - Contains 'file' (binary) and 'label' (string)
 */
export async function uploadRecord(formData) {
  if (USE_MOCK) {
    return mockUploadRecord(formData);
  }
  const response = await api.post('/records/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * POST /records/:id/grant
 * @param {string} recordId
 * @param {string} doctorAddress - Doctor's wallet address
 */
export async function grantAccess(recordId, doctorAddress) {
  if (USE_MOCK) {
    return mockGrantAccess(recordId, doctorAddress);
  }
  const response = await api.post(`/records/${recordId}/grant`, { doctorAddress });
  return response.data;
}

/**
 * POST /records/:id/revoke
 * @param {string} recordId
 * @param {string} doctorAddress - Doctor's wallet address
 */
export async function revokeAccess(recordId, doctorAddress) {
  if (USE_MOCK) {
    return mockRevokeAccess(recordId, doctorAddress);
  }
  const response = await api.post(`/records/${recordId}/revoke`, { doctorAddress });
  return response.data;
}

/**
 * GET /records/:id/access-check
 * @param {string} recordId
 * @returns {{ authorized: boolean }}
 */
export async function checkAccess(recordId) {
  if (USE_MOCK) {
    return mockCheckAccess(recordId);
  }
  const response = await api.get(`/records/${recordId}/access-check`);
  return response.data;
}

/**
 * GET /records/:id/view
 * Should only be called after checkAccess returns true.
 * @param {string} recordId
 * @returns {{ recordId, label, content }}
 */
export async function viewRecord(recordId) {
  if (USE_MOCK) {
    return mockViewRecord(recordId);
  }
  const response = await api.get(`/records/${recordId}/view`);
  return response.data;
}

/**
 * GET /records/shared-with-me
 * Returns a bare array of records accessible to the authenticated doctor:
 * [{ recordId, owner, ownerName, label, uploadedAt, cid, fileHash }]
 * Error: RPC_ERROR (503) when node is unavailable.
 * @returns {Promise<Array<{ recordId: string, owner: string, ownerName: string, label: string, uploadedAt: string, cid: string, fileHash: string }>>}
 */
export async function getSharedWithMe() {
  if (USE_MOCK) {
    return [];
  }
  const response = await api.get('/records/shared-with-me');
  return response.data;
}

/**
 * GET /audit-trail
 * Returns paginated role-scoped on-chain audit trail events:
 * { total, limit, offset, events: [{ type, eventName, recordId, label, owner, ownerName, doctor, doctorName, cid, fileHash, txHash, blockNumber, timestamp }] }
 * Error: RPC_ERROR (503) when node is unavailable.
 * @param {number} [limit=20]
 * @param {number} [offset=0]
 * @returns {Promise<{ total: number, limit: number, offset: number, events: Array<object> }>}
 */
export async function getAuditTrail(limit = 20, offset = 0) {
  if (USE_MOCK) {
    return { total: 0, limit, offset, events: [] };
  }
  const response = await api.get('/audit-trail', {
    params: { limit, offset },
  });
  return response.data;
}
