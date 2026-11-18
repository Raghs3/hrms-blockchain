# Evaluation: consent-bound, receipted access

All numbers are measured, none estimated. Raw data: `data/receipt-measurements.json` (gas and in-process latency, from `contracts/scripts/measure-receipts.js`) and `data/latency-measurements.json` (end to end, from `backend/scripts/measure-latency.js`). Environment: local Hardhat node, solc 0.8.24, optimizer 200 runs, local-file IPFS stub.

## Gas

Three designs were measured. "Original" is the contract before this work (`data/measurements.json` on branch `docs/paper-figures`). "String storage" stored the purpose text in contract storage (`data/receipt-measurements-string-storage.json`). "Hash storage" is the final design: only `keccak256(purpose)` is stored and the text is emitted in the `AccessGranted` event (`data/receipt-measurements.json`).

| Operation | Original | String storage | Hash storage (final) |
|---|---:|---:|---:|
| `grantAccess`, 14-byte purpose, no expiry | 59,276 | 84,622 | 84,187 |
| `grantAccess`, 14-byte purpose, with expiry | n/a | 84,701 | 84,266 |
| `grantAccess`, 128-byte purpose, with expiry | n/a | 176,045 | 86,831 |
| `grantAccess`, re-grant / extend | 59,276 | 59,591 | 49,831 |
| `revokeAccess` | 34,298 | 51,700 | 35,276 |
| `recordAccess` (the receipt), doctor | n/a | 31,001 | 31,001 |
| `recordAccess`, owner | n/a | 28,397 | 28,397 |
| `RecordRegistry` deployment | 835,688 | 1,124,686 | 1,053,042 |

Grant gas against purpose length (first grant to a doctor):

| Purpose length | String storage | Hash storage |
|---:|---:|---:|
| 1 byte | 84,557 | 84,122 |
| 32 bytes | 107,162 | 84,494 |
| 64 bytes | 130,127 | 85,277 |
| 96 bytes | 153,092 | 86,060 |
| 128 bytes | 176,057 | 86,843 |

Findings:

- The receipt is cheap: about 31k gas, the same every time, so it does not grow with the number of earlier reads.
- Storing the purpose text made grants cost about 718 gas per extra byte (176k at the 128-byte cap). Storing only its hash removes that: a 128-byte reason now costs 86.8k, 51% less, and the cost grows only about 6 gas per byte (event data).
- For short purposes the two designs cost the same, because one extra storage slot is written either way. The saving is for longer reasons.
- Hash storage also makes `revokeAccess` and re-grants cheaper (35k and 50k), since clearing or overwriting a fixed 32-byte slot is cheaper than a dynamic string.
- Cost of the hash design: the contract can no longer return the reason text. `getGrant` returns the hash and the backend recovers the text from the newest `AccessGranted` event that hashes to it. The text remains on-chain and permanent, and the hash proves it was not altered. Another contract cannot read it, but nothing in this system needs that. The lookup is an event-log query, slower than a storage read; an indexer would be used at scale.

## Latency

| Path | Median | p95 |
|---|---:|---:|
| Plain read (`getRecord` + fetch + decrypt + hash check), over JSON-RPC | 26.4 ms | 30.6 ms |
| Receipted read (plain read + `recordAccess` mined) | 138.4 ms | 160.3 ms |
| Real `/view` route over HTTP (receipted) | 165.5 ms | 189.2 ms |
| Added by the receipt | about 112 ms | |
| In-process: `getRecord` view vs `recordAccess` tx | 0.76 ms vs 1.11 ms | |

Receipt log query (all receipts of one owner): 37 ms at 10 receipts, 36 ms at 100, 81 ms at 500 (in-process, median of 20).

Caveats to state in the paper:

- These are local numbers with automine, so no block-time wait is included. On a real network the added latency is roughly one block time (about 12 s on Ethereum L1, about 2 s on common L2s). That figure is not measured here.
- Every read is now a transaction, so doctor wallets need funding and receipts expose access patterns on a public chain.
- Release is gated by the backend, not by the contract: `getRecord` is still a free view call returning only the encrypted CID and hash. The guarantee is that the backend (which holds the decryption key) releases nothing until the receipt is mined.
- The prior-art search for novelty is still to be done by the teammates.
