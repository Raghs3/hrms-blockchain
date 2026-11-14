# Backend Gaps & Architecture Notes

This document tracks capabilities needed or beneficial for the frontend UI that are currently missing from the backend API, along with the implemented frontend fallbacks.

---

## 1. Doctor-Accessible Records List (`GET /records/shared-with-me`)
- **Gap:** The backend provides `GET /records/mine` exclusively for patients (403 `WRONG_ROLE` if called by a doctor). There is currently no endpoint allowing a doctor to query the list of records they have been granted access to.
- **Why it matters:** On the Doctor Dashboard, doctors cannot see a server-side list of patient records shared with them; they must know the numeric `recordId` in advance.
- **Frontend Fallback Implemented:** The Doctor Dashboard implements an in-memory session history tracking lookups and viewed records during the active session (`useSessionHistory`). Summary cards display "Records Viewed (This Session)" and "Last Lookup". The `RecordLookup` component provides an on-demand numeric ID lookup executing `GET /records/:id/access-check` and `GET /records/:id/view`, accompanied by a "Recent lookups (this session)" list with click-to-reuse actions.

---

## 2. Patient Search / Record Lookup by Patient Address
- **Gap:** Doctors have no query endpoint to search records associated with a specific patient wallet address without the exact on-chain record ID.
- **Frontend Fallback Implemented:** Access verification is scoped directly to on-chain `recordId`.

---

## 3. Doctor Directory Dropdown in Grant Access Modal
- **Status:** The backend provides `GET /doctors` (returning `{ doctors: [{ name, walletAddress }] }`), but `GrantAccessModal.jsx` currently requires manual entry of the doctor's wallet address.
- **Recommended Enhancement:** In Phase B, incorporate a doctor selection dropdown populated by `GET /doctors` into `GrantAccessModal.jsx`.

---

## 4. Hospital Administrator Online Approval API (`GET /admin/pending-doctors`, `POST /admin/approve-doctor`)
- **Gap:** The backend manages doctor approvals exclusively via the CLI script (`npm run approve-doctor -- <email>`). There are no authenticated REST endpoints for administrators to query pending registrations or trigger approval over HTTP.
- **Frontend Fallback Implemented:** The Hospital Administrator Portal (`/admin`) provides an administrative dashboard featuring:
  - System metric cards (Administrator credentials, Node Status, Gateway Status).
  - CLI Doctor Approval Command Generator: Admins can enter a practitioner's email, generate the cryptographic on-chain approval CLI command, copy it with a single click, and view step-by-step verification instructions.
  - Staff Accounts Roster: Pre-configured cryptographic identities initialized in the encrypted store.
  - Live system diagnostics and gateway pinging via `GET /health`.
