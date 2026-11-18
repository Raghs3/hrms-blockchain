"use strict";
// GET /admin/anomalies end to end: real receipts on the local chain -> rule findings.
// Needs a running Hardhat node with the contracts deployed (like the other suites).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const store = require("../src/store");
const { jwtSecret } = require("../src/config");

const PASSWORD = "AnomalyPass1!";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("GET /admin/anomalies", () => {
  let server, baseUrl, adminToken;

  async function call(method, path, { token, json, form } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(baseUrl + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : form });
    return { status: res.status, body: await res.json() };
  }
  const email = (tag) => `${tag}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}@anomaly.local`;

  async function newPatient(tag) {
    const r = await call("POST", "/auth/register", { json: { name: tag, email: email(tag), password: PASSWORD, role: "patient" } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { token: r.body.token, address: r.body.user.walletAddress };
  }
  async function newDoctor(tag) {
    const em = email(tag);
    const reg = await call("POST", "/auth/register", { json: { name: tag, email: em, password: PASSWORD, role: "doctor" } });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    assert.equal((await call("POST", `/admin/doctors/${reg.body.user.id}/approve`, { token: adminToken })).status, 200);
    const login = await call("POST", "/auth/login", { json: { email: em, password: PASSWORD } });
    return { token: login.body.token, address: login.body.user.walletAddress };
  }
  async function upload(patient, label) {
    const form = new FormData();
    form.append("file", new Blob([PDF]), "scan.pdf");
    form.append("label", label);
    const up = await call("POST", "/records/upload", { token: patient.token, form });
    assert.equal(up.status, 200, JSON.stringify(up.body));
    return up.body.recordId;
  }
  const grant = (patient, id, doctor) =>
    call("POST", `/records/${id}/grant`, { token: patient.token, json: { doctorAddress: doctor.address, purpose: "anomaly test" } });

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    let admin = store.findAccountByEmail("admin@demo.local");
    if (!admin) {
      admin = store.createAccount({
        id: crypto.randomUUID(), name: "Anomaly Admin", email: "anomaly.admin@hospital.local", passwordHash: "hash",
        role: "admin", status: "approved", walletAddress: "0xF3B90E6E1E36fD49a940e26cBc5b9adc02283090",
        createdAt: new Date().toISOString(),
      });
    }
    adminToken = jwt.sign({ sub: admin.id, name: admin.name, role: admin.role }, jwtSecret, { expiresIn: "1h" });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test("only an admin may call it", async () => {
    assert.equal((await call("GET", "/admin/anomalies")).status, 401);
    const patient = await newPatient("anom-pat-guard");
    assert.equal((await call("GET", "/admin/anomalies", { token: patient.token })).status, 403);
    const doctor = await newDoctor("anom-doc-guard");
    assert.equal((await call("GET", "/admin/anomalies", { token: doctor.token })).status, 403);
  });

  test("a doctor who sweeps 5 records of 3 patients in a minute raises BURST and WIDE_REACH", async () => {
    const p1 = await newPatient("anom-p1");
    const p2 = await newPatient("anom-p2");
    const p3 = await newPatient("anom-p3");
    const doctor = await newDoctor("anom-sweeper");
    const records = [
      [p1, await upload(p1, "a1")],
      [p1, await upload(p1, "a2")],
      [p1, await upload(p1, "a3")],
      [p2, await upload(p2, "b1")],
      [p3, await upload(p3, "c1")],
    ];
    for (const [patient, id] of records) assert.equal((await grant(patient, id, doctor)).status, 200);
    for (const [, id] of records) {
      assert.equal((await call("GET", `/records/${id}/view`, { token: doctor.token })).status, 200);
    }

    const res = await call("GET", "/admin/anomalies", { token: adminToken });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.scanned >= 5);
    assert.ok(res.body.options.burstRecords >= 1);

    const mine = res.body.findings.filter((f) => f.accessor.toLowerCase() === doctor.address.toLowerCase());
    const kinds = mine.map((f) => f.rule);
    assert.ok(kinds.includes("BURST"), JSON.stringify(kinds));
    assert.ok(kinds.includes("WIDE_REACH"), JSON.stringify(kinds));
    const burst = mine.find((f) => f.rule === "BURST");
    assert.equal(burst.severity, "high");
    assert.equal(burst.recordIds.length, 5);
    assert.match(burst.txHashes[0], /^0x[0-9a-f]{64}$/);
    assert.equal(burst.accessorName, "anom-sweeper");
  });

  test("a doctor with one ordinary read gets no BURST or WIDE_REACH", async () => {
    const patient = await newPatient("anom-calm-pat");
    const doctor = await newDoctor("anom-calm-doc");
    const id = await upload(patient, "calm");
    await grant(patient, id, doctor);
    assert.equal((await call("GET", `/records/${id}/view`, { token: doctor.token })).status, 200);

    const res = await call("GET", "/admin/anomalies", { token: adminToken });
    const mine = res.body.findings.filter((f) => f.accessor.toLowerCase() === doctor.address.toLowerCase());
    assert.ok(!mine.some((f) => f.rule === "BURST" || f.rule === "WIDE_REACH"));
  });

  test("a patient opening their own records is never flagged", async () => {
    const patient = await newPatient("anom-self");
    for (let i = 0; i < 6; i++) {
      const id = await upload(patient, `own${i}`);
      assert.equal((await call("GET", `/records/${id}/view`, { token: patient.token })).status, 200);
    }
    const res = await call("GET", "/admin/anomalies", { token: adminToken });
    assert.ok(!res.body.findings.some((f) => f.accessor.toLowerCase() === patient.address.toLowerCase()));
  });
});
