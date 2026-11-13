# Backend Gaps & Architecture Notes

This document tracks capabilities needed or beneficial for the frontend UI that are currently missing from the backend API, along with the implemented frontend fallbacks.

---

## 1. Doctor-Accessible Records List (`GET /records/shared-with-me`)
- **Gap:** The backend provides `GET /records/mine` exclusively for patients (403 `WRONG_ROLE` if called by a doctor). There is currently no endpoint allowing a doctor to query the list of records they have been granted access to.
- **Why it matters:** On the Doctor Dashboard, doctors cannot see a table or list of patient records shared with them; they must know the numeric `recordId` in advance.
- **Frontend Fallback Implemented:** The Doctor Dashboard's "Accessible Records" summary card displays "On-Demand" instead of hardcoded numbers. The UI provides an on-demand Record Lookup input where the doctor enters the numeric ID (e.g. `1`) to execute `GET /records/:id/access-check` and `GET /records/:id/view`.

---

## 2. Patient Search / Record Lookup by Patient Address
- **Gap:** Doctors have no query endpoint to search records associated with a specific patient wallet address without the exact on-chain record ID.
- **Frontend Fallback Implemented:** Access verification is scoped directly to on-chain `recordId`.

---

## 3. Doctor Directory Dropdown in Grant Access Modal
- **Status:** The backend provides `GET /doctors` (returning `{ doctors: [{ name, walletAddress }] }`), but `GrantAccessModal.jsx` currently requires manual entry of the doctor's wallet address.
- **Recommended Enhancement:** In Phase B, incorporate a doctor selection dropdown populated by `GET /doctors` into `GrantAccessModal.jsx`.
