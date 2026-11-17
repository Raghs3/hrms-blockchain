// Measures real gas usage and read latency of the deployed contracts on the
// in-process Hardhat network. Output feeds the paper's results figures/tables
// (docs/paper/data/measurements.json) — nothing here is estimated.
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const gas = async (txPromise) => (await (await txPromise).wait()).gasUsed;
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];

async function main() {
  const signers = await ethers.getSigners();
  const [admin, patient] = signers;
  const doctors = signers.slice(2, 12); // 10 doctors
  const out = { deploy: {}, tx: {}, scaling: [], readLatencyMs: {}, network: "hardhat (in-process), solc 0.8.24, optimizer 200 runs" };

  const UR = await ethers.getContractFactory("UserRegistry");
  const ur = await UR.deploy(admin.address);
  out.deploy.UserRegistry = Number((await ur.deploymentTransaction().wait()).gasUsed);
  const RR = await ethers.getContractFactory("RecordRegistry");
  const rr = await RR.deploy(await ur.getAddress());
  out.deploy.RecordRegistry = Number((await rr.deploymentTransaction().wait()).gasUsed);

  out.tx.registerAsPatient = Number(await gas(ur.connect(patient).registerAsPatient()));
  out.tx.registerDoctor = Number(await gas(ur.registerDoctor(doctors[0].address)));
  for (const d of doctors.slice(1)) await ur.registerDoctor(d.address);

  const cid = "bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku";
  const hash = ethers.sha256(ethers.toUtf8Bytes("sample record"));
  out.tx.addRecord = Number(await gas(rr.connect(patient).addRecord(cid, hash)));

  out.tx.grantAccess_first = Number(await gas(rr.connect(patient).grantAccess(1, doctors[0].address, 0, "Second opinion")));
  out.tx.revokeAccess = Number(await gas(rr.connect(patient).revokeAccess(1, doctors[0].address)));
  out.tx.grantAccess_regrant = Number(await gas(rr.connect(patient).grantAccess(1, doctors[0].address, 0, "Second opinion")));

  // Receipt (log-before-release) cost: patient is owner; a doctor with a live grant.
  out.tx.recordAccess_doctor = Number(await gas(rr.connect(doctors[0]).recordAccess(1)));
  // Scaling: gas of the k-th grant on one record (shows O(1) per grant).
  for (let k = 1; k < doctors.length; k++) {
    out.scaling.push({ authorizedDoctors: k + 1, grantGas: Number(await gas(rr.connect(patient).grantAccess(1, doctors[k].address, 0, "Second opinion"))) });
  }
  // Scaling: addRecord gas as the patient's record list grows.
  out.recordGrowth = [];
  for (let n = 2; n <= 20; n++) {
    const g = Number(await gas(rr.connect(patient).addRecord(cid, hash)));
    if (n % 2 === 0 || n === 2) out.recordGrowth.push({ recordsOwned: n, addRecordGas: g });
  }

  // Read latency (view calls, in-process): median of 200 runs.
  const time = async (fn) => { const t = []; for (let i = 0; i < 200; i++) { const s = process.hrtime.bigint(); await fn(); t.push(Number(process.hrtime.bigint() - s) / 1e6); } return Number(median(t).toFixed(3)); };
  out.readLatencyMs.checkAccess = await time(() => rr.checkAccess(doctors[0].address, 1));
  out.readLatencyMs.getRecord_authorized = await time(() => rr.connect(doctors[0]).getRecord(1));
  out.readLatencyMs.getRecordsByOwner = await time(() => rr.getRecordsByOwner(patient.address));
  out.readLatencyMs.getGrant = await time(() => rr.getGrant(1, doctors[0].address));
  // Denied path
  await rr.connect(patient).revokeAccess(1, doctors[0].address);
  out.readLatencyMs.getRecord_denied = await time(async () => { try { await rr.connect(doctors[0]).getRecord(1); } catch (_) {} });

  const dest = path.join(__dirname, "..", "..", "docs", "paper", "data", "measurements.json");
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
