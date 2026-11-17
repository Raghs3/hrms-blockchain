# Evaluation: consent-bound, receipted access

All numbers are measured, none estimated. Raw data: `data/receipt-measurements.json` (gas and in-process latency, from `contracts/scripts/measure-receipts.js`) and `data/latency-measurements.json` (end to end, from `backend/scripts/measure-latency.js`). Environment: local Hardhat node, solc 0.8.24, optimizer 200 runs, local-file IPFS stub.

## Gas

| Operation | Before (original contract) | After |
|---|---:|---:|
| `grantAccess`, 14-byte purpose, no expiry | 59,276 | 84,622 |
| `grantAccess`, 14-byte purpose, with expiry | n/a | 84,701 |
| `grantAccess`, 128-byte purpose, with expiry | n/a | 176,045 |
| `grantAccess`, re-grant / extend | 59,276 | 59,591 |
| `revokeAccess` | 34,298 | 51,700 |
| `recordAccess` (the receipt), doctor | n/a | 31,001 |
| `recordAccess`, owner | n/a | 28,397 |
| `RecordRegistry` deployment | 835,688 | 1,124,686 |

"Before" values come from `data/measurements.json` on branch `docs/paper-figures`, measured on the original contract.

Findings:

- The receipt is cheap: about 31k gas, the same every time, so it does not grow with the number of earlier reads.
- Most of the added cost is storing the purpose string. Gas rises roughly linearly with purpose length: 1 byte 84.6k, 32 bytes 107k, 64 bytes 130k, 96 bytes 153k, 128 bytes 176k (about 718 gas per extra byte).
- `revokeAccess` costs more because it now clears a struct (`delete`) instead of flipping a boolean. The cost is higher, but the refund is not modelled here.
- Possible optimisation (not implemented): store only `keccak256(purpose)` on-chain and put the text in the event. That would make grant gas independent of purpose length at the cost of `getGrant` no longer returning the text.

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
