# Backend — Healthcare Records API

## Quick Start

```bash
# 1. Copy and fill env
cp .env.example .env   # then edit .env

# 2. Install deps
npm install

# 3. Start Hardhat node (in contracts/)
cd ../contracts && npx hardhat node

# 4. Deploy contracts (in another terminal, in contracts/)
npx hardhat run scripts/deploy.js --network localhost

# 5. Run backend
cd ../backend && npm start

# 6. Seed demo accounts
npm run seed
```

## Demo Credentials (created by `npm run seed`)

One password per role: admin `Admin1234!`, doctors `Doctor1234!`, patients `Patient1234!`.

| Role | Name | Email | Status |
|------|------|-------|--------|
| Admin | Admin User | admin@demo.local | approved |
| Patient | Riya Sharma | patient@demo.local | approved |
| Patient | Arjun Mehta | arjun.mehta@demo.local | approved |
| Patient | Neha Kulkarni | neha.kulkarni@demo.local | approved |
| Patient | Imran Sheikh | imran.sheikh@demo.local | approved |
| Doctor | Dr. Kapoor | doctor@demo.local | approved |
| Doctor | Dr. Anjali Rao | anjali.rao@demo.local | approved |
| Doctor | Dr. Vikram Desai | vikram.desai@demo.local | approved |
| Doctor | Dr. Sneha Iyer | sneha.iyer@demo.local | pending (approve live from `/admin`) |
| Doctor | Dr. Rohan Gupta | rohan.gupta@demo.local | pending (approve live from `/admin`) |
| Doctor | Dr. Karan Malhotra | karan.malhotra@demo.local | rejected (shows as Disabled, cannot log in) |

> Patients and approved doctors are registered on-chain. Pending and rejected doctors are not, until an admin approves them. The seed is safe to re-run: existing accounts are skipped.

## Doctor Approval

```bash
npm run approve-doctor -- doctor@example.com
```

This sets the doctor's status to `approved` and registers them on-chain.

## Clean Reset Procedure

To completely reset both on-chain and off-chain state from scratch:
1. Stop all services (Hardhat node and backend).
2. Delete local store and IPFS storage:
   ```bash
   rm -rf data/store.json .local-ipfs/
   ```
3. Restart Hardhat node in `contracts/`:
   ```bash
   cd ../contracts && npx hardhat node
   ```
4. In another terminal, redeploy the contracts:
   ```bash
   npx hardhat run scripts/deploy.js --network localhost
   ```
5. In `backend/`, seed demo accounts:
   ```bash
   npm run seed
   ```
6. Start backend:
   ```bash
   npm start
   ```

> **Note on Fresh-Chain Self-Healing:** The backend automatically self-heals on-chain registrations for approved accounts during login if the Hardhat chain is restarted without clearing `store.json`. However, following the full clean reset procedure above is recommended for a 100% pristine environment.

## Environment Variables

| Variable                | Required | Default                    | Description                              |
|-------------------------|----------|----------------------------|------------------------------------------|
| `PORT`                  | No       | 4000                       | HTTP port                                |
| `RPC_URL`               | No       | http://127.0.0.1:8545      | Ethereum JSON-RPC endpoint               |
| `USER_REGISTRY_ADDRESS` | **Yes**  | —                          | Deployed UserRegistry contract address   |
| `RECORD_REGISTRY_ADDRESS`| **Yes** | —                          | Deployed RecordRegistry contract address |
| `ADMIN_PRIVATE_KEY`     | **Yes**  | —                          | Hardhat deployer account private key     |
| `JWT_SECRET`            | **Yes**  | —                          | Signs JWT tokens                         |
| `WALLET_SECRET`         | **Yes**  | —                          | Derives deterministic wallets from IDs   |
| `ENCRYPTION_KEY`        | **Yes**  | —                          | 32 bytes hex — encrypts uploaded files   |
| `DEMO_AUTH`             | No       | false                      | Enable legacy name+role demo login       |
| `CORS_ORIGIN`           | No       | http://localhost:5173       | Allowed CORS origin                      |
| `PINATA_JWT`            | No       | *(local stub)*             | Pinata JWT for IPFS storage              |
| `PINATA_GATEWAY`        | No       | https://gateway.pinata.cloud | Pinata gateway URL                     |

## Auth Flow

```
POST /auth/register   { name, email, password, role }
POST /auth/login      { email, password }  → { token, user }
GET  /auth/me         Bearer <token>       → { user }
GET  /doctors         Bearer <token>       → { doctors: [...] }
```

See `backend/src/routes.js` and `docs/architecture.md` for the API summary.

