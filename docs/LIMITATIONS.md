# HealthChain Technical Limitations & Architectural Trade-offs

This document outlines the architectural boundaries, security considerations, and technical trade-offs inherent in the current implementation of the HealthChain decentralized healthcare records system.

---

## 1. Blockchain Confirmation Latency vs. Web Application Responsiveness

### Technical Boundary
In traditional web applications, database transactions complete in 5–50 milliseconds. In an EVM-based blockchain environment:
- Every state-modifying action (`uploadRecord`, `grantAccess`, `revokeAccess`) requires broadcasting a signed transaction to the peer-to-peer network.
- Transactions are batched into blocks by validators/miners according to network block times (12–15 seconds on Ethereum mainnet, 2 seconds on Polygon/Arbitrum, or on-demand on local Hardhat).
- A transaction is not immutable until it receives sufficient block confirmations.

### Practical Impact & UI Mitigation
- **UI Latency**: Patient operations that write to the smart contract require the UI to display non-blocking loading spinners with clear transactional status feedback (`"Confirming transaction on blockchain..."`).
- **Optimistic State Trade-off**: If the UI were to optimistically reflect granted permissions before block inclusion, a dropped or reverted transaction would cause inconsistent client state. Therefore, HealthChain waits for the transaction receipt before updating status badges.

---

## 2. On-Chain Metadata vs. Off-Chain IPFS Storage & Gas Economics

### Technical Boundary
Storing arbitrary data in Ethereum contract storage (`SSTORE`) costs approximately 20,000 gas per 32-byte slot (~625,000 gas per kilobyte). Storing a single 5 MB MRI scan directly in smart contract state would cost thousands of dollars and exceed block gas limits.

### Architectural Solution & Inherent Trade-offs
HealthChain separates **access governance** from **data storage**:
1. **On-Chain**: `HealthcareRegistry.sol` stores only metadata:
   - Record identifier (`uint256 recordId`)
   - IPFS Content Identifier (`string cid`)
   - Cryptographic SHA-256 integrity checksum (`bytes32 dataHash`)
   - Patient owner wallet address (`address patient`)
   - Authorization lookup mapping (`mapping(address => bool) authorizedDoctors`)
2. **Off-Chain**: The actual medical payload is encrypted with AES-256-GCM and pinned to IPFS nodes (or Pinata).

### Inherent Limitations
- **Data Availability**: The blockchain guarantees the immutability of the *proof of record*, but does not store the physical bytes. If IPFS pinning nodes are terminated and no replicas exist in the swarm, the record payload becomes inaccessible even though the on-chain pointer is valid.
- **Storage Redundancy**: Production deployments require distributed pinning clusters (e.g., Filecoin, Crust, or private hospital IPFS clusters) with persistent pinning service level agreements (SLAs).

---

## 3. Cryptographic Key Management & Server-Mediated Decryption

### Current Implementation
- Records are encrypted at rest using AES-256-GCM with a symmetric secret key managed by the backend gateway.
- When an authorized doctor requests a record view, the backend queries the blockchain (`hasAccess(recordId, doctorWallet)`). If verified, the backend retrieves the encrypted blob from IPFS, decrypts the plaintext in memory, and streams it to the doctor's authenticated browser session.

### Technical Limitation & Future Roadmap
- **Server Trust Vector**: Because the backend holds decryption capability, a compromised backend server could theoretically access plaintext records.
- **Production Standard (Proxy Re-Encryption)**: A fully trustless architecture requires asymmetric **Proxy Re-Encryption (PRE)** or **Decentralized Key Management (e.g., Lit Protocol / threshold secret sharing)**:
  - The patient encrypts the record with their public key.
  - When granting access, the patient signs a re-encryption key for Doctor B.
  - The storage proxy transforms the ciphertext into a form decryptable *only* by Doctor B's private key, without the backend ever seeing plaintext.

---

## 4. Query Capability: The Non-Iterable Mapping Gap (`GET /records/shared-with-me`)

### Technical Boundary
In Solidity, mappings are implemented as hash tables without key tracking:
```solidity
mapping(uint256 => mapping(address => bool)) private recordAccess;
```
It is computationally impossible in the EVM to query: *"Find all record IDs where `recordAccess[id][doctorAddress] == true`"* without iterating across all record IDs in an unbounded loop (which would cause out-of-gas failures as record counts grow).

### Architectural Consequences
- The backend API does not currently expose a native `GET /records/shared-with-me` endpoint.
- Doctors look up records by specific numeric Record ID.
- **Frontend Mitigation**: To provide an enterprise-grade clinician experience, the frontend implements `useSessionHistory.js` and `DoctorSessionContext.jsx`, which maintains and preserves doctor lookup history across page navigations in memory, tracking recently viewed and verified records.
- **Production Solution**: A production system would implement an off-chain blockchain event indexer (e.g., The Graph, SubQuery, or a Kafka event consumer listening for `AccessGranted` / `AccessRevoked` events) that writes to a read-optimized PostgreSQL query table.

---

## 5. Revocation Semantics & Client-Side Memory Boundaries

### Technical Boundary
When a patient revokes a doctor's access on-chain:
- The `HealthcareRegistry.sol` contract immediately sets `recordAccess[recordId][doctorAddress] = false`.
- Any subsequent call to `GET /records/:id/access-check` or `POST /records/:id/view` returns `403 Forbidden` / `Access Denied`.

### Physical Reality of Digital Data
- **Forward Revocation**: Revocation strictly prevents *future* downloads or decryptions of updated medical records.
- **Client Cache Boundary**: If a doctor viewed and printed/cached a diagnostic report at 10:00 AM, and the patient revokes access at 10:30 AM, blockchain cryptography cannot physically delete pixels already rendered on a screen, cached in local hardware memory, or saved to a local hard drive.
- **Regulatory Alignment**: In HIPAA and GDPR frameworks, this is acknowledged as standard: access revocation cuts off continued digital access; physical and clinical retention requirements are governed by hospital audit logs and compliance agreements.

---

## 6. Emergency & Break-Glass Access Trade-offs

### Clinical Reality
In emergency medicine (e.g., an unconscious trauma patient arriving in an emergency department), waiting for patient wallet authentication or biometric key signing is medically impossible and life-threatening.

### Decentralized Dilemma
- A strict pure-decentralized model without backdoors risks patient mortality when patients cannot authorize access.
- A naive backdoor destroys patient sovereignty.

### Production Architecture Solution (Future Scope)
To satisfy clinical ethics while maintaining decentralization:
- Implement a **Break-Glass Smart Contract Mechanism**:
  - Licensed emergency physicians can invoke `emergencyAccess(recordId)` with an on-chain penalty bond.
  - The invocation immediately emits an immutable on-chain audit alert (`EmergencyAccessTriggered`).
  - An emergency time-window (e.g., 24 hours) is granted.
  - An automated hospital compliance inquest is triggered requiring multi-signature sign-off and clinical justification, slashing the doctor's staked bond if abused.

---

## 7. Supported File Types & Payload Dimensions

### Current Scope
- Supported Formats: `.txt`, `.md`, `.csv`, `.json`
- Maximum File Size: 10 MB per record

### Reason for Constraint
- Medical imaging data (e.g., DICOM series, CT scans, 3D volumetric MRI) frequently ranges from 200 MB to 2 GB per patient session.
- Streaming multi-gigabyte binary files through client-side Web Crypto APIs causes browser memory thrashing and thread blocking.
- The current implementation intentionally limits uploads to text and structured health summaries to guarantee instant decryption, zero-lag rendering in the `<pre>` viewer, and reliable demonstration of the on-chain access control lifecycle.

