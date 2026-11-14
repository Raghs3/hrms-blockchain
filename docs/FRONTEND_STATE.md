# Frontend State & Status Report

## Done

1. **Structure & Navigation Routing (Phase E - `frontend-pages`):**
   - **Modular Role-Based Page Architecture:** Split the monolithic dashboards into dedicated pages, one per sidebar navigation item:
     - `/patient` (PatientOverview): Metric cards, short 3-record preview with link to full records, quick actions to upload/access, workflow instructions.
     - `/patient/records` (PatientRecords): Full data table with newest-first sorting, IPFS CIDs, and direct links to manage access.
     - `/patient/upload` (PatientUpload): Reusable inline `UploadRecordForm` with complete client validations (.txt/.md/.csv/.json, 10MB limit, empty file, <=100 char label), multi-step progress, shortened tx hash with copy, and "Upload another" / "View my records" actions. Replaced modal upload completely.
     - `/patient/access` (PatientAccess): Dedicated access & consent portal displaying record rows with authorized doctor chips, on-chain `RevokeAccessModal`, and `GrantAccessModal`.
     - `/patient/profile` and `/doctor/profile` (Profile): Shared profile displaying session identity, email, role, status, and wallet address with copy button directly from `useAuth()` with zero API calls.
     - `/doctor` (DoctorOverview): Summary cards, short preview of recent lookups, quick link to Record Lookup, and workflow card.
     - `/doctor/lookup` (DoctorLookupPage): Dedicated `RecordLookup` component with numeric string ID validation, access badges, secure plain text `<pre>` viewer, hide button, and recent lookup reuse buttons.
     - `/` (RootRedirect): Redirects authenticated doctors to `/doctor`, authenticated patients to `/patient`, preserves admin notice, and redirects unauthenticated visitors to `/login`.
     - `*` (NotFound): Friendly 404 page with navigation button back to the user's dashboard or login.
   - **Lifted Doctor Session History:** Wrapped doctor routes in `<DoctorSessionProvider>` using React Context so in-memory lookups, viewed counts, and recent lookup items survive route navigation between `/doctor`, `/doctor/lookup`, and `/doctor/profile`.
   - **Role-Based NavLink Sidebar:** Sidebar dynamically derives active navigation links using React Router `NavLink`, highlighting current pages and clearing mobile menus.
   - **Dynamic Document Titles:** Added `useDocumentTitle` hook setting `<title>` on every page route.

2. **Doctor Dashboard Live Integration (Phase C2 - `frontend-doctor`):**
   - **Self-Contained Lookup & Viewer:** Extracted lookup and viewing logic into `RecordLookup.jsx`, separating domain actions from page layout.
   - **Strict Numeric ID Validation:** Client-side digits-only regex (`/^\d+$/`) on trimmed input displaying `"Enter a numeric record ID"` and suppressing outbound requests on invalid input. Record IDs remain strings throughout.
   - **Access Verification:** Single "Check Access" action querying `GET /records/:id/access-check`. Displays clear "ACCESS GRANTED" or "ACCESS DENIED" badges.
   - **Secure Content Viewer:** "View Record" button enabled only upon granted access. Content rendered inside `<pre>` with whitespace preserved and line wrapping (React text rendering only, zero `dangerouslySetInnerHTML`). Detects binary/non-printable payload and displays `"Preview not supported in this demo"`.
   - **Revocation-Between-Check-and-View:** Catches 403 `ACCESS_DENIED` on view, immediately flips status badge to `DENIED`, updates session log, and renders: `"Access was revoked. You no longer have permission to view this record."`.
   - **Privacy Protection:** Automatically clears decrypted content on input change, upon starting a new check, when access is denied, and on component unmount. Added explicit "Hide record" button.
   - **Double-Click / Pending State Protection:** Check Access and View buttons disabled during in-flight network requests, showing active loading text and spinner.
   - **Live In-Memory Session History:** Created `useSessionHistory` tracking last 5 lookups (ID, result, timestamp), total records viewed, and most recent lookup, removing the hardcoded "On-Demand" placeholder. Added click-to-reuse buttons per recent lookup.
   - **Text & Flow Cleanup:** Rewrote instructions to describe real email/password authentication, ID lookup, IPFS decryption, and revocation denial.

2. **Patient Dashboard Live Integration (Phase C1 - `frontend-patient`):**
   - **Data Loading:** Implemented unified `loadRecords()` fetching `GET /records/mine`, called once on mount and automatically refreshed after upload, grant, or revoke, with an explicit "Refresh" button in the header.
   - **Sorting:** Sorted records newest-first by parsing `uploadedAt` descending (`new Date(b.uploadedAt) - new Date(a.uploadedAt)`), addressing the chain's oldest-first order.
   - **Metric Cards:** Fully computed from real loaded data (Total records = count, Active authorized doctors = unique count of doctor wallet addresses across all records, Recent upload = label of newest record by timestamp).
   - **Upload Record:** Restricted files to `.txt, .md, .csv, .json` (via HTML `accept` and client code validation), rejected empty files and files > 10 MB, required trimmed labels <= 100 chars, showed multi-step waiting state during encryption/IPFS/chain confirmation, disabled actions while pending, and showed shortened tx hash with copy button on success.
   - **Grant Access:** Populated doctor dropdown dynamically from `GET /doctors`, prevented duplicate grants on-chain before transaction dispatch, validated 42-char address format regex (`/^0x[a-fA-F0-9]{40}$/`), disabled actions while pending, and showed tx hash on success.
   - **Revoke Access:** Confirmation modal clearly stating doctor name and record label, disabled buttons while pending, showed tx hash with copy button, and handled stale/repeated revokes gracefully with UI refresh.
   - **Chain/Wallet Edge Case:** Appended helpful guidance on `NOT_A_PATIENT` contract errors instructing the patient to re-authenticate if the chain was reset.
   - **Workflow Documentation:** Rewrote "Demo Flow" in `PatientDashboard` and "Demo Instructions" in `DoctorDashboard` to describe the real production email/password and on-chain permission workflow.
   - **Style Cleanup:** Removed obsolete `.demo-note` class from `global.css`.

2. **Real Authentication UI (Phase B2 - `frontend/auth-ui`):**
   - Built dual-tab Sign In and Create Account interfaces in `Login.jsx`.
   - Client-side validation: email regex, password minimum 8 chars, password confirmation match.
   - Distinct server error code handling (`INVALID_CREDENTIALS`, `DOCTOR_PENDING`, `DOCTOR_REJECTED`, `EMAIL_EXISTS`, `VALIDATION_ERROR`).
   - Dedicated "Pending Administrator Approval" screen displayed immediately upon doctor registration.
   - Session expiration warning banner displayed when navigated with `?expired=1`.
   - 3-state `AuthContext` lifecycle (`loading`, `authenticated`, `unauthenticated`) with server-side role derivation.
   - `ProtectedRoute` with loading spinner and dedicated Administrator Account landing card.

3. **API Client & Shared Helpers (Phase B1 - `frontend/live-api`):**
   - Unified Axios instance in `src/api/axios.js` with Bearer token injection and centralized 401 handling.
   - Shared error normalization in `src/api/errors.js` mapping all 20 backend error codes to user-friendly messages.

---

## Page & Route Map (Phase E)

| Path | Component | Guard / Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/login` | `Login` | Public | Authentication (Sign In & Register tabs) |
| `/` | `RootRedirect` | None (inspects session) | Redirects to `/doctor` or `/patient` (or admin notice); unauthenticated to `/login` |
| `/patient` | `PatientOverview` | `requiredRole="patient"` | Metrics summary, 3-record preview, quick actions, workflow card |
| `/patient/records` | `PatientRecords` | `requiredRole="patient"` | Full records table with IPFS CIDs, newest-first sorting, access links |
| `/patient/upload` | `PatientUpload` | `requiredRole="patient"` | Inline `UploadRecordForm` with validations and post-upload actions |
| `/patient/access` | `PatientAccess` | `requiredRole="patient"` | Access & consent portal with doctor chips, Grant and Revoke modals |
| `/patient/profile` | `Profile` | `requiredRole="patient"` | Identity, email, role, status, wallet address with copy, sign out |
| `/doctor` | `DoctorOverview` | `requiredRole="doctor"` | Active session summary cards, recent lookups preview, workflow card |
| `/doctor/lookup` | `DoctorLookupPage` | `requiredRole="doctor"` | `RecordLookup` with numeric ID check, view, hide, click-to-reuse |
| `/doctor/profile` | `Profile` | `requiredRole="doctor"` | Identity, email, role, status, wallet address with copy, sign out |
| `*` | `NotFound` | Public | 404 error page with navigation back home |

---

## Manual Test Checklist

- [ ] **Patient Dashboard Empty State:**
  1. Register a new patient account.
  2. Verify total records is 0, active authorized doctors is 0, recent upload is "—".
  3. Verify empty state banner with "Upload your first record" button opens the upload modal.
- [ ] **Upload Medical Record:**
  1. Open upload modal. Attempt to upload a `.pdf` or empty file. Expect rejection with text-only error message.
  2. Select a `.txt` or `.md` file, provide a label, and submit.
  3. Expect waiting notice during IPFS pin and chain confirmation.
  4. Expect success block showing Record ID and shortened transaction hash with copy button.
  5. Close modal: expect table and metric cards to refresh with the new record at the top.
- [ ] **Grant Doctor Access:**
  1. Click "Grant Access" on the uploaded record.
  2. Verify dropdown lists approved doctors from `GET /doctors`.
  3. Select an approved doctor and submit. Verify transaction hash on success.
  4. Confirm the doctor chip appears under "Authorized Doctors" and the Active Doctors metric increments.
  5. Click "Grant Access" again and select the same doctor.
  6. Expect immediate message "This doctor already has access to this record" without triggering an on-chain transaction.
- [ ] **Revoke Doctor Access:**
  1. Click "Revoke" next to the authorized doctor chip.
  2. Confirm modal displays doctor name and record label.
  3. Click "Revoke Access". Expect transaction hash on success.
  4. Confirm doctor chip disappears from the table and metrics decrement accordingly.
- [ ] **Doctor Dashboard Record Lookup & Access Verification:**
  1. Log in as an approved doctor account (`doctor@demo.local`).
  2. Attempt lookup with empty or non-numeric string (e.g. `abc`, `-1`). Expect client validation message "Enter a numeric record ID" with zero network requests fired.
  3. Enter an unauthorized or nonexistent record ID (e.g. `999999`). Click "Check Access". Expect "ACCESS DENIED" badge with "Check Again" button and "View Record" button hidden.
  4. Enter an authorized record ID (shared by patient). Click "Check Access". Expect "ACCESS GRANTED" badge with "View Record" button enabled.
  5. Click "View Record". Expect record label, Record ID, and decrypted plain text rendered in `<pre>`.
  6. Verify "Records Viewed" metric increments to 1, and "Last Lookup" card reflects the record ID and GRANTED status.
  7. Click "Hide record". Verify decrypted content is hidden while status badge remains.
- [ ] **Revocation Between Check and View:**
  1. Have patient grant access to record ID X.
  2. Doctor clicks "Check Access" on record ID X -> "ACCESS GRANTED" badge appears.
  3. Patient revokes access to record ID X in another window.
  4. Doctor clicks "View Record".
  5. Expect status badge to flip immediately to "ACCESS DENIED" and display: "Access was revoked. You no longer have permission to view this record."
- [ ] **Session History & Reuse:**
  1. Perform lookups for several records (e.g. 1, 2, 999999).
  2. Confirm "Recent lookups (this session)" displays up to 5 entries with status chips and timestamps.
  3. Click "Load ID" on a recent lookup item. Confirm the ID is populated into the input and prior views are cleared.
- [ ] **Manual Refresh & Double Click Safety:**
  1. Click "Refresh" in the patient header. Expect records to reload cleanly.
  2. Rapidly double click action submit buttons; expect submission state to disable buttons and prevent duplicate transactions.

---

## Page & Route Map (Phase E)

| Path | Component | Guard / Access | Purpose |
| :--- | :--- | :--- | :--- |
| `/login` | `Login` | Public | Authentication (Sign In & Register tabs) |
| `/` | `RootRedirect` | None (inspects session) | Redirects to `/doctor` or `/patient` (or admin notice); unauthenticated to `/login` |
| `/patient` | `PatientOverview` | `requiredRole="patient"` | Metrics summary, 3-record preview, quick actions, workflow card |
| `/patient/records` | `PatientRecords` | `requiredRole="patient"` | Full records table with IPFS CIDs, newest-first sorting, access links |
| `/patient/upload` | `PatientUpload` | `requiredRole="patient"` | Inline `UploadRecordForm` with validations and post-upload actions |
| `/patient/access` | `PatientAccess` | `requiredRole="patient"` | Access & consent portal with doctor chips, Grant and Revoke modals |
| `/patient/profile` | `Profile` | `requiredRole="patient"` | Identity, email, role, status, wallet address with copy, sign out |
| `/doctor` | `DoctorOverview` | `requiredRole="doctor"` | Active session summary cards, recent lookups preview, workflow card |
| `/doctor/lookup` | `DoctorLookupPage` | `requiredRole="doctor"` | `RecordLookup` with numeric ID check, view, hide, click-to-reuse |
| `/doctor/profile` | `Profile` | `requiredRole="doctor"` | Identity, email, role, status, wallet address with copy, sign out |
| `*` | `NotFound` | Public | 404 error page with navigation back home |

---

## Known Issues & Backend Gaps

See [`docs/BACKEND_GAPS.md`](./BACKEND_GAPS.md) for detailed descriptions.
- `GET /records/shared-with-me` is not implemented in the backend; doctor lookup remains on-demand by numeric record ID.
