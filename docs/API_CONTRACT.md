# API Contract — Healthcare Records Backend

> Source: `backend/src/routes.js`, `backend/src/auth.js`  
> All errors have shape `{ error: "<CODE>" }`. Auth = Bearer JWT.  
> Rate-limited endpoints return 429 `{ error: "TOO_MANY_REQUESTS" }` on breach.

---

## Auth Endpoints

### `POST /auth/register`
**File:** `routes.js:56` → `auth.js:register`  
**Rate-limited:** `AUTH_RATE_LIMIT_MAX` (default 100) per 15 min per IP (`skipSuccessfulRequests: true`)  
**Auth:** None  
**Body:** `{ name: string, email: string, password: string (min 8), role: "patient"|"doctor" }`

| Scenario | Status | Response |
|---|---|---|
| Patient registered | 201 | `{ token: string, user: User }` |
| Doctor registered (pending) | 201 | `{ user: User }` *(no token)* |
| Validation failure | 400 | `{ error: "VALIDATION_ERROR" }` |
| Duplicate email | 409 | `{ error: "EMAIL_EXISTS" }` |

**User shape:** `{ id, name, email, role, status, walletAddress, createdAt }`  
*Patient is auto-approved + on-chain registered. Doctor is status=pending, no on-chain registration, no token.*

---

### `POST /auth/login`
**File:** `routes.js:57` → `auth.js:login`  
**Rate-limited:** `AUTH_RATE_LIMIT_MAX` (default 100) per 15 min per IP (`skipSuccessfulRequests: true`)  
**Auth:** None  
**Body:** `{ email: string, password: string }`

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ token: string, user: User }` |
| Bad credentials | 401 | `{ error: "INVALID_CREDENTIALS" }` |
| Doctor pending | 403 | `{ error: "DOCTOR_PENDING" }` |
| Doctor rejected | 403 | `{ error: "DOCTOR_REJECTED" }` |
| Validation failure | 400 | `{ error: "VALIDATION_ERROR" }` |

---

### `POST /auth/demo-login`
**File:** `routes.js:58` → `auth.js:demoLogin`  
**Rate-limited:** `AUTH_RATE_LIMIT_MAX` (default 100) per 15 min per IP (`skipSuccessfulRequests: true`)  
**Available only when:** `DEMO_AUTH=true` (default: false)  
**Body:** `{ name: string, role: "patient"|"doctor" }`

| Scenario | Status | Response |
|---|---|---|
| DEMO_AUTH disabled | 404 | `{ error: "NOT_FOUND" }` |
| Success | 200 | `{ token, role, walletAddress, userId, name }` |
| Validation failure | 400 | `{ error: "INVALID_LOGIN" }` |

---

### `GET /auth/me`
**File:** `routes.js:59` → `auth.js:me`  
**Auth:** Bearer token (any role)

| Scenario | Status | Response |
|---|---|---|
| Valid token | 200 | `{ user: User }` |
| Expired token | 401 | `{ error: "TOKEN_EXPIRED" }` |
| Bad/missing token | 401 | `{ error: "INVALID_TOKEN" }` |

---

### `GET /doctors`
**File:** `routes.js:60` → `auth.js:doctors`  
**Auth:** Bearer token (patient or doctor)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ doctors: [{ name: string, walletAddress: string }] }` |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| Wrong role (admin) | 403 | `{ error: "WRONG_ROLE" }` |

*Returns only approved doctors.*

---

## Admin Endpoints

> All admin endpoints require a valid Bearer token for an account with role `"admin"`.

### `GET /admin/pending-doctors`
**File:** `routes.js`  
**Auth:** Bearer token (admin only)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ doctors: [User] }` (only accounts where role="doctor" and status="pending") |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| Wrong role (patient/doctor) | 403 | `{ error: "WRONG_ROLE" }` |

*User shape:* `{ id, name, email, role, status, walletAddress, createdAt }`

---

### `POST /admin/doctors/:id/approve`
**File:** `routes.js` → `auth.js:approveDoctor`  
**Auth:** Bearer token (admin only)  
**Param:** `:id` — Account ID (UUID) or email address of the doctor

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ status: "approved", doctor: User }` |
| Doctor not found | 404 | `{ error: "DOCTOR_NOT_FOUND" }` |
| Account not a doctor | 400 | `{ error: "NOT_A_DOCTOR" }` |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| Wrong role (patient/doctor) | 403 | `{ error: "WRONG_ROLE" }` |

*Executes on-chain `UserRegistry.registerDoctor(wallet)` if not already registered, and updates store status to `"approved"`.*

---

### `POST /admin/doctors/:id/reject`
**File:** `routes.js` → `auth.js:rejectDoctor`  
**Auth:** Bearer token (admin only)  
**Param:** `:id` — Account ID (UUID) or email address of the doctor

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ status: "rejected", doctor: User }` |
| Doctor not found | 404 | `{ error: "DOCTOR_NOT_FOUND" }` |
| Account not a doctor | 400 | `{ error: "NOT_A_DOCTOR" }` |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| Wrong role (patient/doctor) | 403 | `{ error: "WRONG_ROLE" }` |

*Updates store status to `"rejected"`. Login attempts for this doctor will return 403 `DOCTOR_REJECTED`.*

---

## Record Endpoints

> All record endpoints require a valid Bearer token from `/auth/login`.  
> `req.wallet` is derived from the authenticated account id (or demo name) on every request.

### `POST /records/upload`
**File:** `routes.js:62`  
**Auth:** patient only  
**Body:** `multipart/form-data` — `file` (required, max 10 MB), `label` (optional string)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ recordId, cid, txHash, uploadedAt }` |
| No file | 400 | `{ error: "FILE_REQUIRED" }` |
| Not a patient | 403 | `{ error: "WRONG_ROLE" }` |
| Not on-chain patient | 403 | `{ error: "NOT_A_PATIENT" }` |

*File is AES-256-GCM encrypted before IPFS/local storage. CID + SHA-256 hash logged on-chain.*

---

### `GET /records/mine`
**File:** `routes.js:132`  
**Auth:** patient only

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `[{ recordId, label, uploadedAt, authorizedDoctors: [{ walletAddress, name }], cid, fileHash }]` |
| Not a patient | 403 | `{ error: "WRONG_ROLE" }` |

*Additive field: `fileHash` (bytes32 hex string) is included for on-chain integrity verification.*

---

### `GET /records/shared-with-me`
**File:** `routes.js:149`  
**Auth:** doctor only

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `[{ recordId: string, owner: string, ownerName: string, label: string, uploadedAt: string, cid: string, fileHash: string }]` |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| Wrong role (patient/admin) | 403 | `{ error: "WRONG_ROLE" }` |
| RPC failure | 503 | `{ error: "RPC_ERROR", message: string }` |

*Reconstructs active doctor authorizations from `AccessGranted` event logs filtered and confirmed against smart contract `checkAccess`.*

---

### `POST /records/:id/grant`
**File:** `routes.js:185`  
**Auth:** patient only  
**Body:** `{ doctorAddress: string (wallet address) }`

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ txHash, status: "granted" }` |
| Not record owner | 403 | `{ error: "NOT_RECORD_OWNER" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |
| Invalid address | 400 | `{ error: "INVALID_ADDRESS" }` |
| Not registered doctor | 400 | `{ error: "NOT_A_DOCTOR" }` |

---

### `POST /records/:id/revoke`
**File:** `routes.js:191`  
**Auth:** patient only  
**Body:** `{ doctorAddress: string (wallet address) }`

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ txHash, status: "revoked" }` |
| Not record owner | 403 | `{ error: "NOT_RECORD_OWNER" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |
| Invalid address | 400 | `{ error: "INVALID_ADDRESS" }` |

---

### `GET /records/:id/access-check`
**File:** `routes.js:197`  
**Auth:** any authenticated user

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ authorized: boolean }` |
| Bad token | 401 | `{ error: "INVALID_TOKEN" }` |

---

### `GET /records/:id/view`
**File:** `routes.js:209`  
**Auth:** any authenticated user (contract enforces access)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ recordId, owner, label, content: string }` |
| Access denied by contract | 403 | `{ error: "ACCESS_DENIED" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |
| Integrity check failed | 500 | `{ error: "INTEGRITY_CHECK_FAILED" }` |

*Additive field: `owner` (wallet address of the patient who owns the record) is returned in the response.*
*The blockchain itself gates access; the backend cannot serve a file the chain has not approved.*

---

## Audit Trail Endpoints

### `GET /audit-trail`
**File:** `routes.js`  
**Auth:** any authenticated user  
**Query Params:**
- `limit`: number (optional, default 50, max 100)
- `offset`: number (optional, default 0)

**Role Scoping:**
- **Patient (`role="patient"`):** Returns events for records owned by the calling patient (`RecordAdded`, `AccessGranted`, `AccessRevoked`).
- **Doctor (`role="doctor"`):** Returns events where the doctor is the participant/grantee (`AccessGranted`, `AccessRevoked`).
- **Admin (`role="admin"`):** Returns all on-chain events across all records.

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ total: number, limit: number, offset: number, events: [AuditEvent] }` |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| RPC failure | 503 | `{ error: "RPC_ERROR", message: string }` |

**AuditEvent shape:**
```json
{
  "type": "RECORD_ADDED" | "ACCESS_GRANTED" | "ACCESS_REVOKED",
  "eventName": "RecordAdded" | "AccessGranted" | "AccessRevoked",
  "recordId": "1",
  "label": "Blood Test Report",
  "owner": "0x9b69...",
  "ownerName": "Riya Sharma",
  "doctor": "0x37f0...",
  "doctorName": "Dr. Kapoor",
  "cid": "bafy...",
  "fileHash": "0x560f...",
  "txHash": "0x8129...",
  "blockNumber": 12,
  "timestamp": "2026-11-16T18:57:41.000Z"
}
```

---

## Health

### `GET /health`
**File:** `server.js:10`  
**Auth:** None  
**Response:** `200 { ok: true, demoAuth: boolean }`

---

## JWT Payload

```json
{
  "sub": "<account-id>",
  "name": "<display name>",
  "role": "patient|doctor|admin",
  "iat": 1234567890,
  "exp": 1234567890
}
```

- Expiry: **8 hours**
- Secret: `JWT_SECRET` env var
- Role comes from the **stored account** on every request (never from request body)
- `sub` is the account UUID used to derive the deterministic wallet via HMAC-SHA256(WALLET_SECRET, id)

