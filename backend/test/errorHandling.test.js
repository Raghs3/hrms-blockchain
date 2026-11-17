"use strict";
// Regression tests for bugs found in the final test run:
//   1. contract reverts came back as 500 instead of 403/400/404
//   2. parallel transactions from one wallet failed with "nonce has already been used"
//   3. simultaneous registrations of one email all succeeded
//   4. non-ASCII filenames were corrupted (latin1 decoding)
//   5. a doctor rejected after logging in kept access until the token expired
// Needs a running Hardhat node with the contracts deployed (like the other suites).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const store = require("../src/store");
const { jwtSecret } = require("../src/config");

const PASSWORD = "RegressionPass1!";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("Error handling and concurrency regressions", () => {
  let server;
  let baseUrl;
  let adminToken;

  async function call(method, path, { token, json, form } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : form,
    });
    return { status: res.status, body: await res.json() };
  }

  const uniqueEmail = (tag) => `${tag}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}@regress.local`;

  async function newPatient(tag) {
    const r = await call("POST", "/auth/register", {
      json: { name: tag, email: uniqueEmail(tag), password: PASSWORD, role: "patient" },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { token: r.body.token, address: r.body.user.walletAddress, id: r.body.user.id };
  }

  async function newApprovedDoctor(tag) {
    const email = uniqueEmail(tag);
    const reg = await call("POST", "/auth/register", {
      json: { name: tag, email, password: PASSWORD, role: "doctor" },
    });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    const approve = await call("POST", `/admin/doctors/${reg.body.user.id}/approve`, { token: adminToken });
    assert.equal(approve.status, 200, JSON.stringify(approve.body));
    const login = await call("POST", "/auth/login", { json: { email, password: PASSWORD } });
    assert.equal(login.status, 200, JSON.stringify(login.body));
    return { token: login.body.token, address: login.body.user.walletAddress, id: reg.body.user.id, email };
  }

  function upload(token, buf, filename, label) {
    const form = new FormData();
    form.append("file", new Blob([buf]), filename);
    if (label) form.append("label", label);
    return call("POST", "/records/upload", { token, form });
  }

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    let admin = store.findAccountByEmail("admin@demo.local");
    if (!admin) {
      admin = store.createAccount({
        id: crypto.randomUUID(),
        name: "Regression Admin",
        email: "regress.admin@hospital.local",
        passwordHash: "hash",
        role: "admin",
        status: "approved",
        walletAddress: "0xF3B90E6E1E36fD49a940e26cBc5b9adc02283090",
        createdAt: new Date().toISOString(),
      });
    }
    adminToken = jwt.sign({ sub: admin.id, name: admin.name, role: admin.role }, jwtSecret, { expiresIn: "1h" });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  describe("1. contract reverts map to 4xx, not 500", () => {
    let owner, other, doctor, recordId;

    before(async () => {
      owner = await newPatient("owner");
      other = await newPatient("other");
      doctor = await newApprovedDoctor("revertdoc");
      const up = await upload(owner.token, PDF, "r.pdf", "revert test");
      assert.equal(up.status, 200, JSON.stringify(up.body));
      recordId = up.body.recordId;
    });

    test("another patient cannot grant on someone else's record -> 403 NOT_RECORD_OWNER", async () => {
      const r = await call("POST", `/records/${recordId}/grant`, { token: other.token, json: { doctorAddress: doctor.address } });
      assert.equal(r.status, 403, JSON.stringify(r.body));
      assert.equal(r.body.error, "NOT_RECORD_OWNER");
    });

    test("another patient cannot revoke on someone else's record -> 403 NOT_RECORD_OWNER", async () => {
      const r = await call("POST", `/records/${recordId}/revoke`, { token: other.token, json: { doctorAddress: doctor.address } });
      assert.equal(r.status, 403, JSON.stringify(r.body));
      assert.equal(r.body.error, "NOT_RECORD_OWNER");
    });

    test("granting to a patient wallet -> 400 NOT_A_DOCTOR", async () => {
      const r = await call("POST", `/records/${recordId}/grant`, { token: owner.token, json: { doctorAddress: other.address } });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.equal(r.body.error, "NOT_A_DOCTOR");
    });

    test("granting on a nonexistent record -> 404 RECORD_NOT_FOUND", async () => {
      const r = await call("POST", "/records/99999999/grant", { token: owner.token, json: { doctorAddress: doctor.address } });
      assert.equal(r.status, 404, JSON.stringify(r.body));
      assert.equal(r.body.error, "RECORD_NOT_FOUND");
    });

    test("the failed grants did not give the doctor access", async () => {
      const r = await call("GET", `/records/${recordId}/access-check`, { token: doctor.token });
      assert.equal(r.body.authorized, false);
    });
  });

  describe("2. parallel transactions from one wallet", () => {
    test("6 simultaneous uploads by one patient all succeed with unique ids", async () => {
      const patient = await newPatient("parallel");
      const results = await Promise.all(
        Array.from({ length: 6 }, (_, i) =>
          upload(patient.token, Buffer.from(`parallel record ${i} ${Math.random()}`), `p${i}.txt`, `p${i}`)
        )
      );
      assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200, 200], JSON.stringify(results.map((r) => r.body)));
      assert.equal(new Set(results.map((r) => r.body.recordId)).size, 6);
      const mine = await call("GET", "/records/mine", { token: patient.token });
      assert.equal(mine.body.length, 6);
    });

    test("simultaneous grants to two doctors both succeed", async () => {
      const patient = await newPatient("pgrant");
      const [d1, d2] = await Promise.all([newApprovedDoctor("pgdoc1"), newApprovedDoctor("pgdoc2")]);
      const up = await upload(patient.token, PDF, "g.pdf", "grant race");
      const rs = await Promise.all(
        [d1, d2].map((d) => call("POST", `/records/${up.body.recordId}/grant`, { token: patient.token, json: { doctorAddress: d.address } }))
      );
      assert.deepEqual(rs.map((r) => r.status), [200, 200], JSON.stringify(rs.map((r) => r.body)));
    });
  });

  describe("3. duplicate registration race", () => {
    test("5 simultaneous registrations of one email -> exactly one 201, the rest 409", async () => {
      const email = uniqueEmail("race");
      const rs = await Promise.all(
        Array.from({ length: 5 }, () =>
          call("POST", "/auth/register", { json: { name: "Racer", email, password: PASSWORD, role: "patient" } })
        )
      );
      assert.equal(rs.filter((r) => r.status === 201).length, 1, JSON.stringify(rs.map((r) => r.status)));
      assert.equal(rs.filter((r) => r.status === 409).length, 4);
    });
  });

  describe("4. non-ASCII filenames", () => {
    test("Hindi and accented filenames round-trip unchanged", async () => {
      const patient = await newPatient("unicode");
      for (const name of ["रिपोर्ट-रक्त.txt", "café-résumé.txt", "报告.txt"]) {
        const up = await upload(patient.token, Buffer.from("hello"), name, "unicode");
        assert.equal(up.status, 200, JSON.stringify(up.body));
        assert.equal(up.body.originalFileName, name);
        const view = await call("GET", `/records/${up.body.recordId}/view`, { token: patient.token });
        assert.equal(view.body.originalFileName, name);
      }
    });
  });

  describe("5. rejected doctor with an existing token", () => {
    test("loses access immediately after rejection", async () => {
      const patient = await newPatient("rejpat");
      const doctor = await newApprovedDoctor("rejdoc");
      const up = await upload(patient.token, Buffer.from("sensitive"), "s.txt", "s");
      const id = up.body.recordId;
      const grant = await call("POST", `/records/${id}/grant`, { token: patient.token, json: { doctorAddress: doctor.address } });
      assert.equal(grant.status, 200);

      const before = await call("GET", `/records/${id}/view`, { token: doctor.token });
      assert.equal(before.status, 200);

      const reject = await call("POST", `/admin/doctors/${doctor.id}/reject`, { token: adminToken });
      assert.equal(reject.status, 200);

      const view = await call("GET", `/records/${id}/view`, { token: doctor.token });
      assert.equal(view.status, 403, JSON.stringify(view.body));
      assert.equal(view.body.error, "DOCTOR_REJECTED");
      const shared = await call("GET", "/records/shared-with-me", { token: doctor.token });
      assert.equal(shared.status, 403);
      const relogin = await call("POST", "/auth/login", { json: { email: doctor.email, password: PASSWORD } });
      assert.equal(relogin.status, 403);
    });

    test("an approved doctor is unaffected", async () => {
      const doctor = await newApprovedDoctor("okdoc");
      const r = await call("GET", "/records/shared-with-me", { token: doctor.token });
      assert.equal(r.status, 200);
    });
  });
});
