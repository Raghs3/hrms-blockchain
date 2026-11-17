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

### `GET /admin/doctors`
**File:** `routes.js`  
**Auth:** Bearer token (admin only)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ doctors: [User] }` (every doctor account: status `"pending"`, `"approved"` or `"rejected"`) |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| Wrong role (patient/doctor) | 403 | `{ error: "WRONG_ROLE" }` |

*Feeds the admin portal's practitioner roster. `"rejected"` is shown as "Disabled" in the UI.*

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

*Updates store status to `"rejected"`. Login attempts for this doctor will return 403 `DOCTOR_REJECTED`. It also works on an already-approved doctor (this is the admin portal's **Disable** button): any token the doctor already holds is refused with 403 `DOCTOR_REJECTED` on its next request, and the doctor disappears from `GET /doctors`. The on-chain doctor role is not removed (the contract has no function for it); the backend refuses to act for the account. Calling `/approve` again re-enables the doctor.*

---

## Record Endpoints

> All record endpoints require a valid Bearer token from `/auth/login`.  
> `req.wallet` is derived from the authenticated account id (or demo name) on every request.

### `POST /records/upload`
**File:** `routes.js:109`  
**Auth:** patient only  
**Body:** `multipart/form-data` — `file` (required, max 10 MB), `label` (optional string)  
**Supported Extensions & Magic Bytes:**
- `.txt` (valid UTF-8, no NUL bytes)
- `.pdf` (starts with `%PDF`)
- `.png` (starts with `89 50 4E 47`)
- `.jpg` / `.jpeg` (starts with `FF D8 FF`)
- `.doc` (starts with `D0 CF 11 E0`)
- `.docx` (ZIP format starting with `PK 03 04` and containing `word/document.xml`)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ recordId, cid, txHash, uploadedAt, mimeType, originalFileName, sizeBytes }` |
| No file provided | 400 | `{ error: "FILE_REQUIRED" }` |
| Empty file (0 bytes) | 400 | `{ error: "FILE_EMPTY" }` |
| File exceeds 10 MB | 400 | `{ error: "FILE_TOO_LARGE" }` |
| Disallowed extension | 400 | `{ error: "UNSUPPORTED_FILE_TYPE" }` |
| Content does not match extension | 400 | `{ error: "FILE_CONTENT_MISMATCH" }` |
| Not a patient | 403 | `{ error: "WRONG_ROLE" }` |
| Not on-chain patient | 403 | `{ error: "NOT_A_PATIENT" }` |

*File is AES-256-GCM encrypted before IPFS/local storage. Raw byte SHA-256 hash and IPFS CID are anchored on-chain.*

---

### `GET /records/mine`
**File:** `routes.js:149`  
**Auth:** patient only

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `[{ recordId, label, uploadedAt, authorizedDoctors: [{ walletAddress, name }], cid, fileHash, mimeType, originalFileName, sizeBytes }]` |
| Not a patient | 403 | `{ error: "WRONG_ROLE" }` |

*Additive fields: `fileHash` (bytes32 hex string), `mimeType` (string, defaults to "text/plain"), `originalFileName` (string|null), and `sizeBytes` (number|null).*

---

### `GET /records/shared-with-me`
**File:** `routes.js:167`  
**Auth:** doctor only

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `[{ recordId: string, owner: string, ownerName: string, purpose: string|null, expiresAt: string|null, label: string, uploadedAt: string, cid: string, fileHash: string, mimeType: string, originalFileName: string|null, sizeBytes: number|null }]` |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| Wrong role (patient/admin) | 403 | `{ error: "WRONG_ROLE" }` |
| RPC failure | 503 | `{ error: "RPC_ERROR", message: string }` |

*Reconstructs active doctor authorizations from `AccessGranted` event logs, each confirmed against the contract's `getGrant` (so expired and revoked grants drop out). `purpose` / `expiresAt` describe the grant (`expiresAt: null` = until revoked).*

---

### `POST /records/:id/grant`
**File:** `routes.js:203`  
**Auth:** patient only  
**Body:** `{ doctorAddress: string (wallet address), purpose?: string (max 128 bytes, default "General care"), expiresAt?: ISO date string | null (null/omitted = until revoked) }`

Access ends on its own at `expiresAt`; no revoke is needed. Granting again replaces the previous grant (use it to extend an expired one).

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ txHash, status: "granted", purpose: string, expiresAt: string|null }` |
| `expiresAt` not a date | 400 | `{ error: "INVALID_EXPIRY" }` |
| `expiresAt` already past (chain time) | 400 | `{ error: "EXPIRY_IN_PAST" }` |
| `purpose` empty / not a string | 400 | `{ error: "PURPOSE_REQUIRED" }` |
| `purpose` over 128 bytes | 400 | `{ error: "PURPOSE_TOO_LONG" }` |
| Not record owner | 403 | `{ error: "NOT_RECORD_OWNER" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |
| Invalid address | 400 | `{ error: "INVALID_ADDRESS" }` |
| Not registered doctor | 400 | `{ error: "NOT_A_DOCTOR" }` |

---

### `POST /records/:id/revoke`
**File:** `routes.js:209`  
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
**File:** `routes.js:215`  
**Auth:** any authenticated user

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ authorized: boolean }` |
| Bad token | 401 | `{ error: "INVALID_TOKEN" }` |

---

### `GET /records/:id/view`
**File:** `routes.js:226`  
**Auth:** any authenticated user (contract enforces access)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ recordId, owner, label, fileHash, cid, content: string, encoding: "utf8"|"base64", mimeType: string, originalFileName: string|null, sizeBytes: number|null, accessReceipt: { txHash: string, blockNumber: number, timestamp: string|null } }` |
| Access denied by contract (no grant, revoked or expired) | 403 | `{ error: "ACCESS_DENIED" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |
| Integrity check failed | 500 | `{ error: "INTEGRITY_CHECK_FAILED" }` |

*Log-before-release:* after the contract's `getRecord` check and the integrity check, the backend sends a `recordAccess(recordId)` transaction from the caller's wallet and waits for it to be mined. Only then is content returned; `accessReceipt` is that transaction. A denied request writes nothing and costs no gas. Every successful view (including the owner's) adds one `AccessReceipt` event. Doctor wallets are funded by the admin account (like patients) because each read is a transaction.

*Encoding & Content behavior:*
- For `text/plain` records: `content` is a standard UTF-8 string, `encoding: "utf8"`.
- For binary formats (`pdf`, `png`, `jpg`, `doc`, `docx`): `content` is base64 encoded, `encoding: "base64"`.
- On-chain integrity: The server validates SHA-256 hash against `record.fileHash` on raw decrypted bytes before returning. The browser also validates SHA-256 over raw bytes (decoded from base64 or encoded from text).

---

## Access Receipts

### `GET /access-receipts`
**Auth:** any authenticated user  
**Query Params:** `recordId` (optional filter), `limit` (default 50, max 100), `offset` (default 0)

Who actually opened what: one row per on-chain `AccessReceipt`.
- **Patient:** reads of their own records, by anyone (their own views have `selfAccess: true`).
- **Doctor:** their own reads.
- **Admin:** all receipts.

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ total, limit, offset, receipts: [{ recordId, label, owner, ownerName, accessor, accessorName, selfAccess: boolean, timestamp, txHash, blockNumber }] }` (newest first) |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |
| RPC failure | 503 | `{ error: "RPC_ERROR", message: string }` |

Receipts are deliberately not mixed into `/audit-trail` yet (the frontend audit component would need to render a new event type first).

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

**AuditEvent shape** (`purpose` / `expiresAt` are only set on `AccessGranted`):
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
  "purpose": "second opinion" | null,
  "expiresAt": "2026-11-18T10:00:00.000Z" | null,
  "cid": "bafy...",
  "fileHash": "0x560f...",
  "mimeType": "application/pdf" | "text/plain" | null,
  "originalFileName": "lab_results.pdf" | null,
  "sizeBytes": 2048 | null,
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

