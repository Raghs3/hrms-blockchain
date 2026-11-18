// Generates access patterns that trip the anomaly rules, so the admin alerts can be shown live.
// Run against a local stack (Hardhat node + deployed contracts + `npm start`, seeded):
//
//   node scripts/demo-anomalies.js
//
// Creates a doctor who sweeps 5 records of 3 patients within a minute (BURST + WIDE_REACH) and,
// on a Hardhat node only, one read stamped 03:00 local time (OFF_HOURS). Then open
// Admin -> Activity History to see the alerts.
const crypto = require("crypto");
const { provider } = require("../src/chain");
const { DEFAULTS } = require("../src/anomaly");

const BASE = process.env.API_URL || "http://localhost:4000";
const PW = "DemoAnomaly1!";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

async function call(method, route, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + route, { method, headers, body: json !== undefined ? JSON.stringify(json) : form });
  return { status: res.status, body: await res.json() };
}
const must = (r, what) => {
  if (r.status !== 200 && r.status !== 201) throw new Error(`${what} failed: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};

async function main() {
  const tag = crypto.randomBytes(2).toString("hex");
  const admin = must(await call("POST", "/auth/login", { json: { email: "admin@demo.local", password: "Admin1234!" } }), "admin login");

  const patients = [];
  for (const n of ["Asha", "Bilal", "Chitra"]) {
    const r = must(
      await call("POST", "/auth/register", { json: { name: `${n} Demo ${tag}`, email: `${n.toLowerCase()}.${tag}@anomaly.demo`, password: PW, role: "patient" } }),
      "register patient"
    );
    patients.push({ token: r.token, address: r.user.walletAddress });
  }
  const docEmail = `dr.sweep.${tag}@anomaly.demo`;
  const reg = must(await call("POST", "/auth/register", { json: { name: `Dr. Sweep ${tag}`, email: docEmail, password: PW, role: "doctor" } }), "register doctor");
  must(await call("POST", `/admin/doctors/${reg.user.id}/approve`, { token: admin.token }), "approve doctor");
  const doc = must(await call("POST", "/auth/login", { json: { email: docEmail, password: PW } }), "doctor login");

  // 3 records for the first patient, 1 each for the others
  const plan = [0, 0, 0, 1, 2];
  const ids = [];
  for (const [i, pi] of plan.entries()) {
    const form = new FormData();
    form.append("file", new Blob([PDF]), "scan.pdf");
    form.append("label", `Record ${i + 1}`);
    const up = must(await call("POST", "/records/upload", { token: patients[pi].token, form }), "upload");
    must(await call("POST", `/records/${up.recordId}/grant`, { token: patients[pi].token, json: { doctorAddress: doc.user.walletAddress, purpose: "Second opinion" } }), "grant");
    ids.push(up.recordId);
  }

  console.log(`Dr. Sweep ${tag} now opens ${ids.length} records of 3 patients in quick succession...`);
  for (const id of ids) must(await call("GET", `/records/${id}/view`, { token: doc.token }), "view");

  // OFF_HOURS: needs a block stamped at 03:00 local time, which only a Hardhat node can do.
  try {
    const nowIso = (await provider.getBlock("latest")).timestamp * 1000;
    const local = new Date(nowIso + DEFAULTS.utcOffsetMinutes * 60000);
    const target = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, 3, 0, 0) - DEFAULTS.utcOffsetMinutes * 60000;
    await provider.send("evm_setNextBlockTimestamp", [Math.floor(target / 1000)]);
    must(await call("GET", `/records/${ids[0]}/view`, { token: doc.token }), "off-hours view");
    console.log("Added one read stamped 03:00 local time (OFF_HOURS). NOTE: this moved the local chain's clock to tomorrow 03:00;");
    console.log("grants made after this will see that time. Restart the Hardhat node for a clean demo afterwards.");
  } catch (e) {
    console.log("Skipped the OFF_HOURS example (not a Hardhat node):", e.shortMessage || e.message);
  }

  const res = must(await call("GET", "/admin/anomalies", { token: admin.token }), "anomalies");
  console.log(`\nAnomaly scan: ${res.scanned} receipts, ${res.findings.length} finding(s):`);
  for (const f of res.findings.slice(0, 8)) console.log(`  [${f.severity.toUpperCase()}] ${f.rule}: ${f.summary}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
