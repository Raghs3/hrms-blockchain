# Backend Gaps & Architecture Notes

This document tracks capabilities needed or beneficial for the frontend UI, their current implementation status, and closed backend gaps.

---

## 1. Doctor-Accessible Records List (`GET /records/shared-with-me`)
- **Status:** **CLOSED (Implemented in Phase B2)**
- **Backend Implementation:** `GET /records/shared-with-me` in `backend/src/routes.js`.
  - Accessible only by doctors (`requireAuth("doctor")`).
  - Reads `AccessGranted` event logs through the ethers provider filter for the doctor's wallet address (`recordRegistry.filters.AccessGranted(null, null, doctorAddress)`).
  - Confirms each candidate record via smart contract `checkAccess`.
  - Returns `[{ recordId, owner, ownerName, label, uploadedAt, cid, fileHash }]`.
  - Handles empty results (`[]`) and RPC failures gracefully (`503 RPC_ERROR`).
- **Frontend Integration Opportunity:** The Doctor Dashboard can now consume `GET /records/shared-with-me` to show an active table of patient records shared with the clinician without requiring manual numeric ID input.

---

## 2. Patient Search / Record Lookup by Patient Address
- **Status:** Open Architectural Trade-off (Scoped to `recordId`).
- **Context:** In Ethereum, searching mappings across unbounded accounts without an off-chain indexer causes out-of-gas errors. Access verification is scoped directly to on-chain `recordId`.

---

## 3. Doctor Directory Dropdown in Grant Access Modal
- **Status:** **CLOSED (Implemented in Phase E)**
- The backend provides `GET /doctors` (returning `{ doctors: [{ name, walletAddress }] }`). `GrantAccessModal.jsx` populates an approved doctor selection dropdown directly from this endpoint.

---

## 4. Hospital Administrator Online Approval API (`GET /admin/pending-doctors`, `POST /admin/doctors/:id/approve`, `POST /admin/doctors/:id/reject`)
- **Status:** **CLOSED (Implemented in Phase B1)**
- **Backend Implementation:**
  - `GET /admin/pending-doctors`: Lists practitioner accounts with status `"pending"` (sanitized, passwordHash excluded). Guarded by `requireAuth("admin")`.
  - `POST /admin/doctors/:id/approve`: Executes on-chain registration (`UserRegistry.registerDoctor(wallet)`), updates status to `"approved"`, and sets practitioner display name. Supports lookup by UUID or email.
  - `POST /admin/doctors/:id/reject`: Updates status to `"rejected"`. Login attempts for rejected doctors are denied with 403 `DOCTOR_REJECTED`.
  - CLI Script Compatibility: `scripts/approve-doctor.js` reuses the exact same extracted `approveDoctor` function.
- **Frontend Integration Opportunity:** The Hospital Admin Portal (`/admin`) can now display pending doctor requests in a live table and provide one-click "Approve" and "Reject" buttons over HTTP.

---

## 5. On-Chain Audit Trail API (`GET /audit-trail`)
- **Status:** **CLOSED (Implemented in Phase B6)**
- **Backend Implementation:** `GET /audit-trail` in `backend/src/routes.js`.
  - Role-scoped querying:
    - **Patient:** Events for records owned by the patient (`RecordAdded`, `AccessGranted`, `AccessRevoked`).
    - **Doctor:** Events where the doctor is the grantee/actor (`AccessGranted`, `AccessRevoked`).
    - **Admin:** All on-chain events across the registry.
  - Returns block timestamp, transaction hash, block number, formatted event types, and pagination metadata (`total`, `limit`, `offset`).
- **Frontend Integration Opportunity:** `AuditTrail.jsx` and `AuditTrailContext.jsx` can now fetch real immutable on-chain event history from `GET /audit-trail` instead of relying solely on `sessionStorage`.

---

## 6. On-Chain Data Completeness (Additive Response Fields)
- **Status:** **CLOSED (Implemented in Phase B3, B4, B5)**
  - `fileHash`: Included in each item of `GET /records/mine` for verifying unencrypted file SHA-256 integrity against the on-chain hash.
  - `owner`: Included in `GET /records/:id/view` response so clinicians can view the patient owner wallet address.
  - `demoAuth`: Exposed as boolean in `GET /health` (`{ ok: true, demoAuth: false }`) without exposing any secrets.
