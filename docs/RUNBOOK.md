# HealthChain Operational Runbook

This runbook provides complete operational procedures for deploying, configuring, running, testing, and troubleshooting the HealthChain decentralized healthcare records application.

---

## 1. System Architecture Overview

HealthChain is a 3-tier decentralized healthcare record management system:

```
┌────────────────────────┐      HTTP / REST       ┌────────────────────────┐
│     React Frontend     │ ◄────────────────────► │     Express Backend    │
│  (React 19 + Vite 8)   │   Bearer JWT Auth      │  (Node.js / Express 5) │
│  Port: 5173            │                        │  Port: 4000            │
└────────────────────────┘                        └──────────┬─────────────┘
                                                             │
                                        ┌────────────────────┴────────────────────┐
                                        │                                         │
                                        ▼                                         ▼
                             ┌─────────────────────┐                   ┌─────────────────────┐
                             │  Hardhat Blockchain │                   │      IPFS Nodes     │
                             │ (EVM Local Node)    │                   │ (Local AES Stub /   │
                             │ Port: 8545          │                   │  Pinata Pinning)    │
                             └─────────────────────┘                   └─────────────────────┘
```

1. **Smart Contracts Layer** (`contracts/`): two Solidity contracts deployed on an EVM-compatible node (Hardhat local network). `UserRegistry` holds on-chain roles (patient, doctor, hospital admin). `RecordRegistry` holds immutable record metadata (CID, SHA-256 integrity hash, patient owner) and the access permissions, queried with `checkAccess(recordId, doctorAddress)`.
2. **Backend Gateway Layer**: Express 5 service (`backend/`). Mediates identity authentication (bcrypt passwords, signed JWT tokens), AES-256-GCM record payload encryption at rest, IPFS pinning, and interaction with the EVM via `ethers.js`.
3. **Frontend Application Layer**: React 19 single-page application (`frontend/`). Role-based dashboards for Patients and Doctors, client-side input validation, session history preservation, and error boundaries.

---

## 2. Prerequisites & Environment

### System Requirements
- **Node.js**: `v18.x` or `v20.x` LTS (Node 20 recommended)
- **npm**: `v9.x` or `v10.x`
- **Operating System**: macOS, Linux, or Windows (WSL2 recommended for Windows)

### Port Allocation
| Service | Default Port | Protocol | Purpose |
|---|---|---|---|
| Hardhat EVM Node | `8545` | JSON-RPC (HTTP) | Local blockchain simulation |
| Backend API | `4000` | HTTP / REST | Authentication, encryption, chain gateway |
| Frontend Vite Server | `5173` | HTTP | Client web application |

---

## 3. Configuration & Environment Variables

### Backend Configuration (`backend/.env`)
Create `backend/.env` from the template and fill in the secrets:
```bash
cd backend
cp .env.example .env
```
Required values (see `backend/README.md` for the full table):
```env
PORT=4000
RPC_URL=http://127.0.0.1:8545
# Printed by the deploy script (these are the defaults on a fresh Hardhat node)
USER_REGISTRY_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RECORD_REGISTRY_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
# Hardhat account #0, a public test key valid only on the local chain
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Generate each with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<random>
WALLET_SECRET=<random>      # derives every user's wallet; rotating it orphans existing accounts and records
ENCRYPTION_KEY=<64 hex chars>
# Optional: leave empty to use the local encrypted file stub instead of Pinata
PINATA_JWT=
# Optional: set true to enable the legacy name+role login and the login-page quick-fill buttons
DEMO_AUTH=false
```

### Frontend Configuration (`frontend/.env` or defaults)
By default the app talks to `http://localhost:4000`. To override, copy `frontend/.env.example` to `frontend/.env.local`:
```env
VITE_API_BASE_URL=http://localhost:4000
VITE_USE_MOCK=false
```

---

## 4. Step-by-Step Startup Sequence

Follow these steps in separate terminal windows to launch the full environment:

### Step 4.1: Start the Local Hardhat Node
```bash
cd contracts
npx hardhat node
```
*Expected Output:*
- Spawns 20 test accounts with 10,000 ETH each.
- RPC JSON-RPC listening on `http://127.0.0.1:8545`.

### Step 4.2: Compile and Deploy Smart Contracts
Open a second terminal to deploy `UserRegistry` and `RecordRegistry` to the local chain:
```bash
cd contracts
npx hardhat run scripts/deploy.js --network localhost
```
*Expected Output:*
- Prints both deployed addresses (on a fresh node: `UserRegistry` `0x5FbDB2315678afecb367f032d93F642f64180aa3`, `RecordRegistry` `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`).
- If they differ from `backend/.env`, update `USER_REGISTRY_ADDRESS` and `RECORD_REGISTRY_ADDRESS`.

### Step 4.3: Initialize and Start the Backend API
```bash
# Navigate to backend directory
cd backend

# Install dependencies if not already installed
npm install

# Seed the demo accounts (admin, approved doctor, patient); run once per fresh chain
npm run seed

# Start the Express server
npm start
```
*Expected Output:*
- `Backend listening on http://localhost:4000 (file storage: local stub) CORS origin: http://localhost:5173`

### Step 4.4: Start the Frontend Application
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies if not already installed
npm install

# Start Vite development server
npm run dev
```
*Expected Output:*
- `VITE v8.3.0 ready in ... ms`
- `Local: http://localhost:5173/`

---

## 5. Seeded Test Accounts

The following demo accounts are created by `npm run seed` in `backend/` (`backend/scripts/seed.js`):

| Role | Email | Password | Display Name | Permissions & Notes |
|---|---|---|---|---|
| **Patient** | `patient@demo.local` | `Patient1234!` | Riya Sharma | Can upload records, view own record list, grant/revoke doctor access |
| **Doctor** | `doctor@demo.local` | `Doctor1234!` | Dr. Kapoor | Approved status. Can look up records by ID and view decrypted content when authorized |
| **Admin** | `admin@demo.local` | `Admin1234!` | Administrator | System administrator for doctor credential approval |

*Note: The Login screen shows one-click persona quick-login buttons only when the backend runs with `DEMO_AUTH=true` (they use the legacy name+role login, not these accounts). With the default `DEMO_AUTH=false`, type the email and password above.*

---

## 6. Verification & Smoke Test Procedures

### Pre-Flight Read-Only Sanity Checks (Terminal)
Verify the backend service is responding and authenticating correctly:
```bash
# Check unauthorized access returns HTTP 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/auth/me
# Expected: 401

# Test login endpoint
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@demo.local","password":"Patient1234!"}' | grep -q "token" && echo "Login OK"
# Expected: Login OK
```

### End-to-End Patient Flow Rehearsal
1. Navigate to `http://localhost:5173/login`.
2. Sign in as `patient@demo.local` / `Patient1234!`.
3. Verify landing on `/patient`:
   - Summary cards show Total Records, Active Authorized Doctors, Recent Upload, Access Status.
   - Connected wallet address is displayed.
4. Navigate to **Upload Record** (`/patient/upload`):
   - Choose a test file: `.pdf`, `.png`, `.jpg`, `.doc`, `.docx` or `.txt`, up to 10 MB (the file contents must match the extension).
   - Fill in a record label (e.g. `Cardiology Consultation Report`).
   - Click **Upload Record**.
   - Verify success banner with IPFS CID and Blockchain Transaction Hash.
5. Navigate to **Access & Consent** (`/patient/access`):
   - Locate the uploaded record.
   - Click **Grant Access** -> select `Dr. Kapoor` -> submit transaction.
   - Verify doctor chip appears under "Authorized Doctors" and status badge updates to `Authorized`.
6. Click **Revoke** on Dr. Kapoor:
   - Confirm modal prompt -> submit revocation.
   - Verify badge flips to `Private` and doctor chip is removed.

### End-to-End Multi-Role Lifecycle Rehearsal (Phase L)
The complete end-to-end integration across all roles (Admin, Doctor, Patient) was verified with 30 passing assertions:
1. **Administrator Authentication**:
   - Log into `/admin` with `admin@demo.local` / `Admin1234!`.
   - Verify `role: 'admin'`, landing on the Hospital Administrator Portal.
   - Run live EVM node & gateway diagnostics (`GET /health`).
2. **Doctor Onboarding & Security Boundary**:
   - Register a new practitioner via `/login` -> Register tab (e.g. `dr.smith@hospital.local`).
   - Verify status is initialized to `pending` and JWT token is strictly withheld.
   - Verify unapproved login attempts return HTTP 403 `DOCTOR_PENDING`.
3. **On-Chain Approval Pipeline**:
   - Administrator clicks **Approve** next to the pending practitioner on `/admin` (or runs `npm run approve-doctor -- <email>` in `backend/`).
   - Verify the practitioner's deterministic wallet is derived and registered in `UserRegistry`.
   - Approved practitioner logs in, receives token, and status updates to `approved`.
4. **Patient Directory Discovery & Record Upload**:
   - Patient logs into `/patient`.
   - Navigates to **Doctors Directory** (`/patient/doctors`); verifies newly approved practitioner appears with verified badge and wallet address.
   - Navigates to **Upload Record** (`/patient/upload`); uploads encrypted text document.
   - Verifies IPFS CID and Ethereum transaction hash are anchored on-chain.
5. **Zero-Trust Access Control & Plaintext Decryption**:
   - Prior to consent grant, practitioner lookup reports `authorized: false` and view returns HTTP 403.
   - Patient grants consent on `/patient/access`; verifies `ACCESS_GRANTED` event on audit trail.
   - Practitioner checks access; verified `authorized: true`.
   - Practitioner views the decrypted record; verifies content and the `RecordRegistry` SHA-256 integrity match.
6. **On-Chain Revocation**:
   - Patient revokes practitioner access; verifies `ACCESS_REVOKED` event.
   - Practitioner re-check immediately denies access (`authorized: false`, view HTTP 403 `ACCESS_DENIED`).

---

## 7. Operational Troubleshooting & Error Recovery

### Issue: "Nonce too high" or "Replacement transaction underpriced"
- **Cause**: The local Hardhat node was restarted but the backend still holds state from the old chain (record ids in `backend/data/store.json` restart at 1, and old accounts are no longer registered on-chain).
- **Resolution**: follow the "Clean Reset Procedure" in `backend/README.md`: stop everything, delete `backend/data/store.json` and `backend/.local-ipfs/`, restart `npx hardhat node` and redeploy from `contracts/`, then `cd backend && npm run seed && npm start`.

### Issue: Browser Network Error / CORS Rejection
- **Cause**: Backend server is offline or frontend is sending requests to an incorrect port.
- **Resolution**:
  1. Check backend status: `curl http://localhost:4000/auth/me`.
  2. Confirm `CORS_ORIGIN` in `backend/.env` matches the frontend origin (default `http://localhost:5173`).

### Issue: Newly Registered Doctor Cannot Log In
- **Symptom**: User sees "Pending Administrator Approval" badge after registering as a Doctor.
- **Cause**: Expected system behavior. Doctor accounts require administrative validation before EVM access is enabled.
- **Resolution**: The account remains in `pending` state until approved via administrator workflow. For immediate testing, use the pre-seeded approved doctor `doctor@demo.local`.

### Issue: File Upload Rejection
- **Allowed Formats**: `.pdf`, `.png`, `.jpg`/`.jpeg`, `.doc`, `.docx`, `.txt`.
- **Maximum Size**: 10 MB.
- **Reason for rejection**: the backend checks the extension and the file's magic bytes. A file whose contents do not match its extension is rejected with `FILE_CONTENT_MISMATCH`; other types (e.g. `.md`, `.csv`, `.json`, `.exe`) are rejected with `UNSUPPORTED_FILE_TYPE`. Files are encrypted with AES-256-GCM on the server, not in the browser.

