// End-to-end rehearsal of the demo: upload -> grant -> view -> revoke -> deny.
// Needs a running Hardhat node with contracts deployed, the backend running, and
// the demo accounts seeded (`npm run seed` -- the admin account approves the doctor).
// Registers a fresh patient + doctor each run, so it can be re-run without cleanup.
const BASE = process.env.API_URL || "http://localhost:4000";

async function call(method, path, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: json ? JSON.stringify(json) : form });
  return { status: res.status, body: await res.json() };
}

function check(label, condition, detail) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${label}`, detail ? `-> ${JSON.stringify(detail)}` : "");
  if (!condition) process.exitCode = 1;
}

async function main() {
  const suffix = Date.now();
  const password = "DemoFlow1234!";

  // Patient registers and gets a token straight away.
  const patientReg = (await call("POST", "/auth/register", {
    json: { name: `Riya ${suffix}`, email: `riya.${suffix}@demoflow.local`, password, role: "patient" },
  })).body;
  const patient = { token: patientReg.token, walletAddress: patientReg.user?.walletAddress };

  // Doctor registers as "pending"; the seeded admin approves them, then they log in.
  const doctorReg = (await call("POST", "/auth/register", {
    json: { name: `Dr Kapoor ${suffix}`, email: `kapoor.${suffix}@demoflow.local`, password, role: "doctor" },
  })).body;
  const admin = (await call("POST", "/auth/login", { json: { email: "admin@demo.local", password: "Admin1234!" } })).body;
  check("admin logged in (run `npm run seed` first if this fails)", Boolean(admin.token), admin.token ? undefined : admin);
  const approval = await call("POST", `/admin/doctors/${doctorReg.user?.id}/approve`, { token: admin.token });
  check("admin approves the doctor", approval.status === 200, approval.body);
  const doctorLogin = (await call("POST", "/auth/login", {
    json: { email: `kapoor.${suffix}@demoflow.local`, password },
  })).body;
  const doctor = { token: doctorLogin.token, walletAddress: doctorLogin.user?.walletAddress };
  check("patient and doctor logged in", patient.token && doctor.token);

  const secret = "Hemoglobin: 13.8 g/dL, WBC: 6.2k/uL. Confidential.";
  const form = new FormData();
  form.append("file", new Blob([secret]), "blood-test.txt");
  form.append("label", "Blood Test Report");
  const uploaded = await call("POST", "/records/upload", { token: patient.token, form });
  check("1. patient uploads record (encrypted, pinned, logged on-chain)", uploaded.status === 200, uploaded.body);
  const id = uploaded.body.recordId;

  let r = await call("GET", `/records/${id}/access-check`, { token: doctor.token });
  check("2. doctor has no access before grant", r.body.authorized === false);
  r = await call("GET", `/records/${id}/view`, { token: doctor.token });
  check("   doctor view denied before grant", r.status === 403, r.body);

  r = await call("POST", `/records/${id}/grant`, { token: patient.token, json: { doctorAddress: doctor.walletAddress, purpose: "second opinion", expiresAt: new Date(Date.now() + 3600_000).toISOString() } });
  check("3. patient grants doctor access (purpose + 1h expiry)", r.body.status === "granted" && r.body.purpose === "second opinion", r.body);

  r = await call("GET", `/records/${id}/view`, { token: doctor.token });
  check("4. doctor views record, content decrypted intact", r.status === 200 && r.body.content === secret, r.body);
  check("   the read came with a mined on-chain receipt", /^0x[0-9a-f]{64}$/.test(r.body.accessReceipt?.txHash || ""), r.body.accessReceipt);
  const receiptTx = r.body.accessReceipt?.txHash;

  r = await call("GET", `/access-receipts?recordId=${id}`, { token: patient.token });
  check("   patient sees the doctor's read, same tx hash", r.body.receipts?.[0]?.txHash === receiptTx && r.body.receipts[0].accessor === doctor.walletAddress, r.body);

  r = await call("GET", "/records/mine", { token: patient.token });
  check("   patient's list shows the doctor as authorized", r.body.find((rec) => rec.recordId === id)?.authorizedDoctors?.[0]?.walletAddress === doctor.walletAddress, r.body);

  r = await call("POST", `/records/${id}/revoke`, { token: patient.token, json: { doctorAddress: doctor.walletAddress } });
  check("5. patient revokes access", r.body.status === "revoked", r.body);

  r = await call("GET", `/records/${id}/access-check`, { token: doctor.token });
  check("6. doctor access-check now false", r.body.authorized === false);
  r = await call("GET", `/records/${id}/view`, { token: doctor.token });
  check("   doctor view denied after revoke", r.status === 403 && r.body.error === "ACCESS_DENIED", r.body);

  r = await call("GET", "/records/mine");
  check("no token -> 401", r.status === 401);
  r = await call("GET", "/records/mine", { token: doctor.token });
  check("doctor cannot list patient-only endpoint -> 403", r.status === 403);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
