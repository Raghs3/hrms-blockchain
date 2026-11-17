// Measures the cost of the consent-lifecycle additions (purpose/expiry grants and
// receipted reads) on the in-process Hardhat network. Output feeds the paper
// (docs/paper/data/receipt-measurements.json). Nothing here is estimated.
//
//   npx hardhat run scripts/measure-receipts.js
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const fs = require("fs");
const path = require("path");

const gas = async (txPromise) => Number((await (await txPromise).wait()).gasUsed);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))];

async function timed(n, fn) {
  const samples = [];
  for (let i = 0; i < n; i++) {
    const s = process.hrtime.bigint();
    await fn();
    samples.push(Number(process.hrtime.bigint() - s) / 1e6);
  }
  return {
    runs: n,
    medianMs: Number(median(samples).toFixed(3)),
    p95Ms: Number(pct(samples, 0.95).toFixed(3)),
  };
}

async function main() {
  const [admin, patient, doctor, doctor2] = await ethers.getSigners();
  const out = { network: "hardhat (in-process, automine), solc 0.8.24, optimizer 200 runs", gas: {}, latency: {} };

  const ur = await (await ethers.getContractFactory("UserRegistry")).deploy(admin.address);
  const rr = await (await ethers.getContractFactory("RecordRegistry")).deploy(await ur.getAddress());
  out.gas.deployRecordRegistry = Number((await rr.deploymentTransaction().wait()).gasUsed);

  await ur.connect(patient).registerAsPatient();
  await ur.registerDoctor(doctor.address);
  await ur.registerDoctor(doctor2.address);

  const cid = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
  const hash = ethers.sha256(ethers.toUtf8Bytes("sample record"));
  await rr.connect(patient).addRecord(cid, hash);
  out.gas.addRecord = await gas(rr.connect(patient).addRecord(cid, hash));

  // ---- grantAccess variants ---------------------------------------------------
  const later = BigInt((await time.latest()) + 30 * 24 * 3600);
  out.gas.grantAccess_shortPurpose_noExpiry = await gas(rr.connect(patient).grantAccess(1, doctor.address, 0, "second opinion"));
  await rr.connect(patient).revokeAccess(1, doctor.address);
  out.gas.grantAccess_shortPurpose_withExpiry = await gas(rr.connect(patient).grantAccess(1, doctor.address, later, "second opinion"));
  await rr.connect(patient).revokeAccess(1, doctor.address);
  out.gas.grantAccess_128BytePurpose_withExpiry = await gas(rr.connect(patient).grantAccess(1, doctor.address, later, "x".repeat(128)));
  out.gas.grantAccess_regrant_extend = await gas(rr.connect(patient).grantAccess(1, doctor.address, later + 100n, "x".repeat(128)));
  out.gas.revokeAccess = await gas(rr.connect(patient).revokeAccess(1, doctor.address));

  // Purpose length scaling (storage cost of the purpose string), fresh grant each time.
  out.gas.purposeLengthScaling = [];
  for (const len of [1, 16, 32, 64, 96, 128]) {
    out.gas.purposeLengthScaling.push({
      purposeBytes: len,
      grantGas: await gas(rr.connect(patient).grantAccess(1, doctor2.address, later, "x".repeat(len))),
    });
    await rr.connect(patient).revokeAccess(1, doctor2.address);
  }

  // ---- recordAccess (the receipt) ---------------------------------------------
  await rr.connect(patient).grantAccess(1, doctor.address, later, "second opinion");
  out.gas.recordAccess_first = await gas(rr.connect(doctor).recordAccess(1));
  out.gas.recordAccess_repeat = await gas(rr.connect(doctor).recordAccess(1));
  out.gas.recordAccess_owner = await gas(rr.connect(patient).recordAccess(1));
  // A denied receipt attempt fails in estimateGas, so it never costs gas on the real path.
  const reps = [];
  for (let i = 0; i < 20; i++) reps.push(await gas(rr.connect(doctor).recordAccess(1)));
  out.gas.recordAccess_repeat_median_of_20 = median(reps);

  // ---- latency: plain read (view) vs receipted read (transaction mined) ---------
  out.latency.plainRead_getRecord = await timed(200, () => rr.connect(doctor).getRecord(1));
  out.latency.receiptedRead_recordAccess = await timed(200, async () => (await rr.connect(doctor).recordAccess(1)).wait());
  out.latency.getGrant_view = await timed(200, () => rr.getGrant(1, doctor.address));
  out.latency.checkAccess_view = await timed(200, () => rr.checkAccess(doctor.address, 1));
  out.latency.note =
    "In-process automine: the receipted read adds one transaction round-trip with no block-time wait. On a real network the added latency is dominated by block time (confirmation), not by these numbers.";

  // Receipt log scaling: querying receipts for one owner as the log grows.
  out.latency.receiptQuery = [];
  for (const target of [10, 100, 500]) {
    const have = (await rr.queryFilter(rr.filters.AccessReceipt(null, patient.address))).length;
    for (let i = have; i < target; i++) await (await rr.connect(doctor).recordAccess(1)).wait();
    const t = await timed(20, () => rr.queryFilter(rr.filters.AccessReceipt(null, patient.address)));
    out.latency.receiptQuery.push({ receiptsInLog: target, ...t });
  }

  const dest = path.join(__dirname, "..", "..", "docs", "paper", "data", "receipt-measurements.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
