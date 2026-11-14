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

1. **Smart Contracts Layer**: Solidity contract `HealthcareRegistry.sol` deployed on an EVM-compatible node (Hardhat local network). Manages immutable record metadata (CID, SHA-256 integrity hash, patient owner) and on-chain access permission mapping (`hasAccess(recordId, doctorAddress)`).
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
Ensure `backend/.env` exists with the following configuration:
```env
PORT=4000
JWT_SECRET=super-secret-jwt-key-replace-in-production
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
ADMIN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Optional Pinata IPFS integration; leave empty or unset to use local encrypted stub
PINATA_JWT=
```

### Frontend Configuration (`frontend/.env` or defaults)
By default, the Vite dev server proxies or connects to `http://localhost:4000`. If overriding:
```env
VITE_API_URL=http://localhost:4000
```

---

## 4. Step-by-Step Startup Sequence

Follow these steps in separate terminal windows to launch the full environment:

### Step 4.1: Start the Local Hardhat Node
```bash
# In repository root
npx hardhat node
```
*Expected Output:*
- Spawns 20 test accounts with 10,000 ETH each.
- RPC JSON-RPC listening on `http://127.0.0.1:8545`.

### Step 4.2: Compile and Deploy Smart Contracts
Open a second terminal to deploy `HealthcareRegistry.sol` to the local chain:
```bash
# In repository root
npx hardhat run scripts/deploy.js --network localhost
```
*Expected Output:*
- Prints the deployed contract address (typically `0x5FbDB2315678afecb367f032d93F642f64180aa3`).
- If this address differs from `backend/.env`, update `CONTRACT_ADDRESS` in `backend/.env`.

### Step 4.3: Initialize and Start the Backend API
```bash
# Navigate to backend directory
cd backend

# Install dependencies if not already installed
npm install

# Seed the demo accounts into the backend database
npm run seed

# Start the Express server
npm run dev
# or: node src/index.js
```
*Expected Output:*
- `Connected to Ethereum RPC at http://127.0.0.1:8545`
- `HealthcareRegistry loaded at 0x5FbDB23...`
- `Backend server running on http://localhost:4000`

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

The following demo accounts are created during the backend seed process (`backend/src/seed.js`):

| Role | Email | Password | Display Name | Permissions & Notes |
|---|---|---|---|---|
| **Patient** | `patient@demo.local` | `Patient1234!` | Riya Sharma | Can upload records, view own record list, grant/revoke doctor access |
| **Doctor** | `doctor@demo.local` | `Doctor1234!` | Dr. Kapoor | Approved status. Can look up records by ID and view decrypted content when authorized |
| **Admin** | `admin@demo.local` | `Admin1234!` | Administrator | System administrator for doctor credential approval |

*Note: For testing and evaluation convenience, the redesigned Login screen provides one-click "Demo Accounts Quick-Fill" buttons for both Patient and Doctor.*

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
2. Click **Patient (Riya Sharma)** quick-fill button, then click **Sign In**.
3. Verify landing on `/patient`:
   - Summary cards show Total Records, Active Authorized Doctors, Recent Upload, Access Status.
   - Connected wallet address is displayed.
4. Navigate to **Upload Record** (`/patient/upload`):
   - Choose a test text file (e.g., `qa-fixtures/qa-report.txt` or any `.txt`, `.md`, `.json`, `.csv`).
   - Fill in a record label (e.g. `Cardiology Consultation Report`).
   - Click **Upload & Pin to Blockchain**.
   - Verify success banner with IPFS CID and Blockchain Transaction Hash.
5. Navigate to **Access & Consent** (`/patient/access`):
   - Locate the uploaded record.
   - Click **Grant Access** -> select `Dr. Kapoor` -> submit transaction.
   - Verify doctor chip appears under "Authorized Doctors" and status badge updates to `Authorized`.
6. Click **Revoke** on Dr. Kapoor:
   - Confirm modal prompt -> submit revocation.
   - Verify badge flips to `Private` and doctor chip is removed.

### End-to-End Doctor Flow Rehearsal
1. Sign out of patient session via sidebar.
2. Sign in as `doctor@demo.local` / `Doctor1234!`.
3. Verify landing on `/doctor`:
   - Metric cards display viewed records count and last lookup status.
4. Navigate to **Record Lookup** (`/doctor/lookup`):
   - Enter a record ID (e.g., `1`).
   - Click **Check Access**.
   - If granted: green badge displays `Access Granted by Patient`.
   - Click **View Decrypted Record**: secure plaintext preview opens with pre-formatted content.
   - Click **Hide Record**: content safely unmounts from DOM.
   - If denied: red badge displays `Access Denied (Blockchain Verified)` with patient privacy advisory.

---

## 7. Operational Troubleshooting & Error Recovery

### Issue: "Nonce too high" or "Replacement transaction underpriced"
- **Cause**: The local Hardhat node was restarted without resetting backend account nonce state, or concurrent transactions were broadcast.
- **Resolution**:
  1. Restart Hardhat node: `npx hardhat node`.
  2. Redeploy contract: `npx hardhat run scripts/deploy.js --network localhost`.
  3. Re-run backend seed: `cd backend && npm run seed && npm run dev`.

### Issue: Browser Network Error / CORS Rejection
- **Cause**: Backend server is offline or frontend is sending requests to an incorrect port.
- **Resolution**:
  1. Check backend status: `curl http://localhost:4000/auth/me`.
  2. Confirm CORS configuration in `backend/src/index.js` allows requests from `http://localhost:5173`.

### Issue: Newly Registered Doctor Cannot Log In
- **Symptom**: User sees "Pending Administrator Approval" badge after registering as a Doctor.
- **Cause**: Expected system behavior. Doctor accounts require administrative validation before EVM access is enabled.
- **Resolution**: The account remains in `pending` state until approved via administrator workflow. For immediate testing, use the pre-seeded approved doctor `doctor@demo.local`.

### Issue: File Upload Rejection
- **Allowed Formats**: Plain text files (`.txt`, `.md`, `.csv`, `.json`).
- **Maximum Size**: 10 MB.
- **Reason**: Binary files (e.g., raw `.pdf`, `.exe`) are rejected by client validation to safeguard against non-printable data corruption during client-side AES-GCM streaming.
