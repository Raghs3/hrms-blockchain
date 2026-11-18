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

export const ACCESS_RECEIPT_EVENT = 'access-receipt-logged';

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
 * @param {{ purpose?: string, expiresAt?: string|null }} [terms] - Why access is granted, and when it
 *   ends on its own (ISO date; null/omitted = until revoked). The contract enforces both.
 */
export async function grantAccess(recordId, doctorAddress, terms = {}) {
  if (USE_MOCK) {
    return mockGrantAccess(recordId, doctorAddress);
  }
  const response = await api.post(`/records/${recordId}/grant`, {
    doctorAddress,
    purpose: terms.purpose,
    expiresAt: terms.expiresAt ?? null,
  });
  return response.data;
}

/**
 * GET /admin/anomalies (admin only)
 * Rule-based alerts over the access receipts:
 * { options, scanned, considered, findings: [{ rule, severity, accessor, accessorName, summary,
 *   count, firstAt, lastAt, recordIds, txHashes }] }
 */
export async function getAnomalies() {
  if (USE_MOCK) {
    return { options: null, scanned: 0, considered: 0, findings: [] };
  }
  const response = await api.get('/admin/anomalies');
  return response.data;
}

/**
 * GET /access-receipts
 * On-chain receipts of who actually opened which record (patient: reads of own records;
 * doctor: own reads). { total, limit, offset, receipts: [{ recordId, label, ownerName,
 * accessor, accessorName, selfAccess, timestamp, txHash, blockNumber }] }
 */
export async function getAccessReceipts({ recordId, limit = 10, offset = 0 } = {}) {
  if (USE_MOCK) {
    return { total: 0, limit, offset, receipts: [] };
  }
  const response = await api.get('/access-receipts', { params: { recordId, limit, offset } });
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
  if (response.data?.accessReceipt && typeof window !== 'undefined') {
    // Lets any open "who opened your records" panel reload without a manual refresh.
    window.dispatchEvent(new Event(ACCESS_RECEIPT_EVENT));
  }
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
