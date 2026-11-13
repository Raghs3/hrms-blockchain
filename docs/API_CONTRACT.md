# API Contract — Healthcare Records Backend

> Source: `backend/src/routes.js`, `backend/src/auth.js`  
> All errors have shape `{ error: "<CODE>" }`. Auth = Bearer JWT.

---

## Auth Endpoints

### `POST /auth/register`
**File:** `routes.js:56` → `auth.js:register`  
**Rate-limited:** 20 req / 15 min per IP  
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
**Rate-limited:** 20 req / 15 min per IP  
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

### `GET /doctor/dashboard`
**File:** `routes.js:61`  
**Auth:** Bearer token (doctor only)

| Scenario | Status | Response |
|---|---|---|
| Doctor access | 200 | `{ ok: true }` |
| Patient access | 403 | `{ error: "WRONG_ROLE" }` |
| Unauthenticated | 401 | `{ error: "INVALID_TOKEN" }` |

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
**File:** `routes.js:85`  
**Auth:** patient only

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `[{ recordId, label, uploadedAt, authorizedDoctors: [{ walletAddress, name }], cid }]` |
| Not a patient | 403 | `{ error: "WRONG_ROLE" }` |

---

### `POST /records/:id/grant`
**File:** `routes.js:102`  
**Auth:** patient only  
**Body:** `{ doctorAddress: string (wallet address) }`

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ txHash, status: "granted" }` |
| Not record owner | 403 | `{ error: "NOT_RECORD_OWNER" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |
| Invalid address | 400 | `{ error: "INVALID_ADDRESS" }` |

---

### `POST /records/:id/revoke`
**File:** `routes.js:108`  
**Auth:** patient only  
**Body:** `{ doctorAddress: string (wallet address) }`

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ txHash, status: "revoked" }` |
| Not record owner | 403 | `{ error: "NOT_RECORD_OWNER" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |

---

### `GET /records/:id/access-check`
**File:** `routes.js:114`  
**Auth:** any authenticated user

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ authorized: boolean }` |
| Bad token | 401 | `{ error: "INVALID_TOKEN" }` |

---

### `GET /records/:id/view`
**File:** `routes.js:126`  
**Auth:** any authenticated user (contract enforces access)

| Scenario | Status | Response |
|---|---|---|
| Success | 200 | `{ recordId, label, content: string }` |
| Access denied by contract | 403 | `{ error: "ACCESS_DENIED" }` |
| Record not found | 404 | `{ error: "RECORD_NOT_FOUND" }` |
| Integrity check failed | 500 | `{ error: "INTEGRITY_CHECK_FAILED" }` |

*The blockchain itself gates access; the backend cannot serve a file the chain has not approved.*

---

## Health

### `GET /health`
**File:** `server.js:10`  
**Auth:** None  
**Response:** `200 { ok: true }`

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

