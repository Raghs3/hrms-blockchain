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

## 4. Query Capability: The Non-Iterable Mapping Gap & Event Log Solution (`GET /records/shared-with-me`)

### Technical Boundary
In Solidity, mappings are implemented as hash tables without key tracking:
```solidity
mapping(uint256 => mapping(address => bool)) private authorizedAccess;
```
It is computationally impossible in the EVM to query: *"Find all record IDs where `authorizedAccess[id][doctorAddress] == true`"* without iterating across all record IDs in an unbounded loop (which would cause out-of-gas failures as record counts grow).

### Architectural Solution (Backend Event Log Indexing)
To resolve this gap without smart contract redeployment or gas-expensive on-chain storage, the backend implements event log querying:
1. Queries all indexed `AccessGranted` event logs for the calling doctor's address via the ethers provider:
   `recordRegistry.filters.AccessGranted(null, null, doctorAddress)`.
2. Extracts unique candidate record IDs.
3. Confirms current active access on each candidate ID in real time using `recordRegistry.checkAccess(doctorAddress, recordId)` (ensuring any revoked access is filtered out).
4. Retrieves record metadata for active records via `getRecord(recordId)` and the local store index.
5. Returns the consolidated list via `GET /records/shared-with-me`.

### Production Scale Solution
For high-volume enterprise deployments with millions of events, an off-chain blockchain event indexer (e.g., The Graph, SubQuery, or a Kafka consumer listening to `AccessGranted` and `AccessRevoked` blocks) caching into PostgreSQL provides sub-50ms query latency.

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

### Current Scope & Capabilities
- **Supported Formats:** `.pdf`, `.png`, `.jpg` / `.jpeg`, `.doc`, `.docx`, `.txt`.
- **Validation:** Enforced by file extension whitelist AND file magic byte inspection (`%PDF`, `89 50 4E 47`, `FF D8 FF`, `D0 CF 11 E0`, `PK 03 04` with `word/document.xml`, UTF-8).
- **Maximum File Size:** 10 MB per record (enforced client-side and server-side via Multer `LIMIT_FILE_SIZE`).

### Viewer Capabilities & Architectural Boundaries
- **Inline Rendering:** Images (`.png`, `.jpg`) and PDF documents (`.pdf`) render directly in the browser via ephemeral Blob URLs with instant revocation upon viewer unmount.
- **No Inline DOC / DOCX Preview:** Microsoft Word documents are presented as an authenticated document card with file metadata and a direct decrypted download action. Inline rendering for DOC/DOCX is intentionally omitted to avoid bundling heavy Office rendering runtimes (such as LibreOffice WASM) which compromise bundle size, memory footprint, and client security.
- **Large Volumetric Datasets (DICOM):** High-resolution medical imaging series (CT / 3D volumetric MRI) exceeding 10 MB are outside the scope of single-file IPFS pinning and require dedicated DICOM WADO/PACS chunked streaming gateways.

