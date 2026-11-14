# Frontend State & Status Report

## Done

1. **Patient Dashboard Live Integration (Phase C1 - `frontend-patient`):**
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
- [ ] **Manual Refresh & Double Click Safety:**
  1. Click "Refresh" in the patient header. Expect records to reload cleanly.
  2. Rapidly double click action submit buttons; expect submission state to disable buttons and prevent duplicate transactions.

---

## Known Issues & Backend Gaps

See [`docs/BACKEND_GAPS.md`](./BACKEND_GAPS.md) for detailed descriptions.
- `GET /records/shared-with-me` is not implemented in the backend; doctor lookup remains on-demand by numeric record ID.
