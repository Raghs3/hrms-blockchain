# Frontend State & Status Report

## Done

1. **API Contract Audit:**
   - Audited `docs/API_CONTRACT.md` against `backend/src/routes.js` and `backend/src/auth.js`.
   - Added missing error specifications for `NOT_A_DOCTOR` on `POST /records/:id/grant`, `INVALID_ADDRESS` on `POST /records/:id/revoke`, and documented `TOO_MANY_REQUESTS` on rate-limited endpoints.

2. **Unified API Client Module (`src/api/axios.js`):**
   - Configured Axios instance with `baseURL` derived from `import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'`.
   - Request interceptor automatically attaches `Authorization: Bearer <token>` from `localStorage.getItem('hrms_token')`.
   - Response interceptor implements centralized 401 handling (clears session and redirects to `/login` when unauthorized).
   - Response interceptor automatically normalizes all error rejections into `{ code, message, status }` using the shared error helper.

3. **Shared Error Mapping Helper (`src/api/errors.js`):**
   - Implemented mapping for all 20 backend error codes:
     - Auth: `INVALID_CREDENTIALS`, `DOCTOR_PENDING`, `DOCTOR_REJECTED`, `EMAIL_EXISTS`, `VALIDATION_ERROR`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `UNAUTHENTICATED`, `WRONG_ROLE`, `TOO_MANY_REQUESTS`, `INVALID_LOGIN`.
     - Record & Consent: `FILE_REQUIRED`, `NOT_A_PATIENT`, `NOT_A_DOCTOR`, `NOT_RECORD_OWNER`, `RECORD_NOT_FOUND`, `ACCESS_DENIED`, `INVALID_ADDRESS`, `INTEGRITY_CHECK_FAILED`, `UPLOAD_ERROR`, `INTERNAL_ERROR`.
   - Provides `normalizeError(err)` and `getErrorMessage(code, fallback)`.

4. **Real Backend Integration by Default (`VITE_USE_MOCK=false`):**
   - Updated `src/api/auth.js` and `src/api/records.js` so mock mode only runs when `VITE_USE_MOCK === 'true'`.
   - Created `frontend/.env.example` with `VITE_API_BASE_URL=http://localhost:4000` and `VITE_USE_MOCK=false`.
   - Updated `frontend/.env` to `VITE_USE_MOCK=false`.

5. **Component Error Handling Standardization:**
   - Refactored `GrantAccessModal.jsx`, `RevokeAccessModal.jsx`, `UploadRecord.jsx`, `PatientDashboard.jsx`, `DoctorDashboard.jsx`, and `Login.jsx` to consume `err.message` from normalized errors.

6. **Numeric Record IDs:**
   - Removed stale `rec_101` demo string from `DoctorDashboard.jsx`.
   - Enforced numeric ID guidance throughout the doctor lookup and verification UI.

7. **Live UI Mock Cleanup:**
   - Removed hardcoded mock number `1` from Doctor Dashboard's "Accessible Records" card (updated to "On-Demand" lookup).
   - Removed "DEMO PROFILES" quick-fill buttons and demo profile section from `Login.jsx`.

8. **Auth Context Compatibility:**
   - Updated `src/context/AuthContext.jsx` to unpack both `{ token, user: { ... } }` (real auth) and `{ token, role, ... }` (demo auth) payloads.

---

## Known Issues & Deferred Items

1. **Email/Password Login Screens Deferred:**
   - As explicitly instructed, new login/registration screens were **not** built in this session. The existing form provides name + role input compatible with `POST /auth/demo-login` (when `DEMO_AUTH=true`) or programmatic credentials via `login({ email, password })`.
2. **Doctor Address Manual Entry:**
   - In `GrantAccessModal.jsx`, patients currently enter doctor wallet addresses manually. In Phase B, a dropdown backed by `GET /doctors` can be added.

---

## Backend Gaps

See [`docs/BACKEND_GAPS.md`](./BACKEND_GAPS.md) for detailed descriptions.
- The backend does not have an endpoint (`GET /records/shared-with-me`) for doctors to query all records granted to them. The UI falls back to on-demand verification by numeric record ID.
