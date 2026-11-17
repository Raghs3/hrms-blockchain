// Measures what log-before-release costs end to end, against a running local stack
// (Hardhat node + deployed contracts + `npm start`, seeded). Output feeds the paper:
// docs/paper/data/latency-measurements.json. Nothing is estimated.
//
//   PINATA_JWT= node scripts/measure-latency.js [runs=30]
//
// plain path    = what /view did before receipts: getRecord + fetch blob + decrypt + hash check
// receipted path = plain path + recordAccess() sent from the caller's wallet and mined
// http /view    = the real route over HTTP (receipted path + auth + JSON), for reference
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { recordRegistry, walletForAccount, runAsWallet } = require("../src/chain");
const ipfs = require("../src/ipfs");
const { decrypt, sha256Hex } = require("../src/crypto");

const BASE = process.env.API_URL || "http://localhost:4000";
const RUNS = Number(process.argv[2]) || 30;
const PW = "LatencyPass1!";

const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const p95 = (a) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * 0.95))];
const summary = (a) => ({ runs: a.length, medianMs: Number(median(a).toFixed(1)), p95Ms: Number(p95(a).toFixed(1)) });

async function call(method, route, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + route, { method, headers, body: json !== undefined ? JSON.stringify(json) : form });
  return { status: res.status, body: await res.json() };
}

async function timeIt(n, fn) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = process.hrtime.bigint();
    await fn();
    out.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  return out;
}

async function main() {
  const tag = crypto.randomBytes(3).toString("hex");
  const admin = (await call("POST", "/auth/login", { json: { email: "admin@demo.local", password: "Admin1234!" } })).body;
  const pat = (await call("POST", "/auth/register", { json: { name: `Lat Pat ${tag}`, email: `lat.pat.${tag}@latency.local`, password: PW, role: "patient" } })).body;
  const docReg = (await call("POST", "/auth/register", { json: { name: `Lat Doc ${tag}`, email: `lat.doc.${tag}@latency.local`, password: PW, role: "doctor" } })).body;
  await call("POST", `/admin/doctors/${docReg.user.id}/approve`, { token: admin.token });
  const doc = (await call("POST", "/auth/login", { json: { email: `lat.doc.${tag}@latency.local`, password: PW } })).body;

  const form = new FormData();
  form.append("file", new Blob([Buffer.from("%PDF-1.4\n" + "x".repeat(200_000) + "\n%%EOF\n")]), "scan.pdf");
  const up = await call("POST", "/records/upload", { token: pat.token, form });
  if (up.status !== 200) throw new Error("upload failed " + JSON.stringify(up.body));
  const id = BigInt(up.body.recordId);
  const g = await call("POST", `/records/${id}/grant`, {
    token: pat.token,
    json: { doctorAddress: doc.user.walletAddress, purpose: "latency benchmark" },
  });
  if (g.status !== 200) throw new Error("grant failed " + JSON.stringify(g.body));

  const wallet = walletForAccount(docReg.user.id);
  const asDoc = recordRegistry.connect(wallet);

  const plain = async () => {
    const rec = await asDoc.getRecord(id);
    const pt = decrypt(await ipfs.fetchByCid(rec.cid));
    if (sha256Hex(pt) !== rec.fileHash) throw new Error("hash mismatch");
    return rec;
  };
  const receipted = async () => {
    await plain();
    await runAsWallet(wallet, async () => (await (await asDoc.recordAccess(id)).wait()));
  };
  const http = async () => {
    const r = await call("GET", `/records/${id}/view`, { token: doc.token });
    if (r.status !== 200) throw new Error("view failed " + JSON.stringify(r.body));
  };

  // warm-up (JIT, connection reuse), then interleave so drift hits all three equally
  for (let i = 0; i < 3; i++) { await plain(); await receipted(); await http(); }
  const s = { plain: [], receipted: [], http: [] };
  for (let i = 0; i < RUNS; i++) {
    s.plain.push(...(await timeIt(1, plain)));
    s.receipted.push(...(await timeIt(1, receipted)));
    s.http.push(...(await timeIt(1, http)));
  }

  const result = {
    network: "local Hardhat node over JSON-RPC (automine, no block-time wait); local-file IPFS stub; 200 KB file",
    plainReadMs: summary(s.plain),
    receiptedReadMs: summary(s.receipted),
    httpViewMs: summary(s.http),
    addedByReceiptMs: Number((median(s.receipted) - median(s.plain)).toFixed(1)),
    note:
      "The added cost is one mined transaction. On a real network it is dominated by block time " +
      "(about 12 s on Ethereum L1, about 2 s on common L2s), which these local numbers do not include.",
  };
  const dest = path.join(__dirname, "..", "..", "docs", "paper", "data", "latency-measurements.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
