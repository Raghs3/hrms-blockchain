# Frontend State & Status Report

## Done (Phase B1 & B2)

1. **Real Authentication UI (Phase B2 - `frontend/auth-ui`):**
   - Replaced demo login with a dual-tab "Sign In" and "Create Account" interface in `frontend/src/pages/Login.jsx`.
   - Client-side validation: email regex verification, password minimum length (8 characters), and password confirmation matching.
   - Distinct server error code handling:
     - Login: `INVALID_CREDENTIALS`, `DOCTOR_PENDING`, `DOCTOR_REJECTED`.
     - Register: `EMAIL_EXISTS`, `VALIDATION_ERROR`.
   - Dedicated "Pending Administrator Approval" screen displayed immediately upon doctor registration (no token returned; status "pending").
   - Session expiration warning banner displayed when navigated with `?expired=1`.
   - Removed all demo remnants, pickers, and hardcoded placeholders.

2. **3-State AuthContext Lifecycle:**
   - AuthContext operates in three distinct states: `'loading'`, `'authenticated'`, `'unauthenticated'`.
   - On app startup, restores `hrms_token` from `localStorage` and verifies it via `GET /auth/me`.
   - If valid, populates `{ user, role, walletAddress, name, email, userId }`.
   - If invalid, expired, or 401, clears storage and transitions cleanly to `unauthenticated`.
   - User role is strictly derived from the verified server response (never selected or toggled by client state).
   - `loginUser` saves `hrms_token` and updates state; `logoutUser` wipes token and state completely.

3. **Route Protection & Admin Access Guard:**
   - `ProtectedRoute` renders a spinner (`LoadingState`) while verifying the session on app mount.
   - Redirects unauthenticated users to `/login`.
   - Detects administrator role (`role === 'admin'`) and renders an honest notice explaining that admin accounts are managed via backend scripts (e.g., `npm run approve-doctor`), preventing redirect loops.
   - Redirects patients away from doctor routes and doctors away from patient routes.

4. **Sidebar & Layout Improvements:**
   - Displays user's name, role label, and full copyable Ethereum wallet address.
   - Includes a one-click copy button with transient "Copied!" visual feedback.
   - Functional Sign Out button triggers `logoutUser()` and redirects to `/login`.
   - Removed unused `useState` import.

5. **API Client & 401 Interceptor Refinement:**
   - `src/api/axios.js` checks request URL (`error.config?.url`) instead of `window.location.pathname`.
   - 401 errors from `/auth/login` or `/auth/register` pass through to forms without clearing storage or reloading the page.
   - Protected 401s clear `hrms_token` and redirect to `/login?expired=1`.
   - `src/api/auth.js` streamlines `login({ email, password })`, `register()`, `getMe()`, and `getDoctors()`.

---

## Manual Test Checklist

- [ ] **Patient Registration & Auto-Login:**
  1. Go to `/login` and click "Create Account".
  2. Register with `name`, `email`, password (>= 8 chars), role "Patient".
  3. Expect immediate redirect to `/patient` with wallet address displayed in sidebar.
- [ ] **Doctor Registration & Pending State:**
  1. Go to `/login` -> "Create Account".
  2. Register with role "Doctor".
  3. Expect "Registration Submitted - Pending Administrator Approval" screen.
  4. Attempting to log in immediately with the doctor credentials displays "Your doctor registration is pending approval by the hospital administrator."
- [ ] **Admin Approval & Doctor Login:**
  1. Run `npm run approve-doctor -- <doctor-email>` in `backend/`.
  2. Sign in as the approved doctor.
  3. Expect redirect to `/doctor` with role "Doctor" in sidebar.
- [ ] **Invalid Credentials:**
  1. Attempt login with wrong password.
  2. Expect error banner: "The email or password you entered is incorrect."
- [ ] **Role Protection & Redirection:**
  1. While logged in as a patient, navigate to `/doctor`.
  2. Expect automatic redirect back to `/patient`.
- [ ] **Admin Account Login:**
  1. Sign in with the seeded admin account.
  2. Expect clean Admin Access notice explaining CLI management with a working Sign Out button.
- [ ] **Session Expiry / 401:**
  1. Clear or invalidate `hrms_token` in DevTools localStorage while on a dashboard.
  2. Trigger any backend request or refresh the page.
  3. Expect redirect to `/login?expired=1` with "Your session has expired. Please sign in again." banner.
- [ ] **Sign Out:**
  1. Click "Sign Out" in the sidebar.
  2. Expect immediate redirect to `/login` with `localStorage.getItem('hrms_token')` removed.

---

## Known Issues & Backend Gaps

See [`docs/BACKEND_GAPS.md`](./BACKEND_GAPS.md) for detailed descriptions.
- `GET /records/shared-with-me` is not implemented in the backend; doctor lookup remains on-demand by numeric record ID.
- In `GrantAccessModal.jsx`, patients currently enter doctor wallet addresses manually; can be enhanced with a dropdown populated by `GET /doctors`.
