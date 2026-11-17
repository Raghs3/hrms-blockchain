"use strict";
// Consent-bound, receipted access:
//   - /view releases content only after a recordAccess() transaction is mined (log-before-release)
//   - grants carry a purpose and an optional expiry; access ends on its own at expiry
//   - GET /access-receipts exposes who actually opened what, backed by transaction hashes
// Needs a running Hardhat node with the contracts deployed (like the other suites).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const store = require("../src/store");
const { provider } = require("../src/chain");
const { jwtSecret } = require("../src/config");

const PASSWORD = "ReceiptPass1!";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

describe("Receipted access and consent terms", () => {
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

  const uniqueEmail = (tag) => `${tag}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}@receipts.local`;

  async function newPatient(tag) {
    const r = await call("POST", "/auth/register", {
      json: { name: tag, email: uniqueEmail(tag), password: PASSWORD, role: "patient" },
    });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return { token: r.body.token, address: r.body.user.walletAddress };
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
    return { token: login.body.token, address: login.body.user.walletAddress };
  }

  async function uploadRecord(patient, label = "scan") {
    const form = new FormData();
    form.append("file", new Blob([PDF]), "scan.pdf");
    form.append("label", label);
    const up = await call("POST", "/records/upload", { token: patient.token, form });
    assert.equal(up.status, 200, JSON.stringify(up.body));
    return up.body.recordId;
  }

  const grant = (patient, id, doctor, extra = {}) =>
    call("POST", `/records/${id}/grant`, { token: patient.token, json: { doctorAddress: doctor.address, ...extra } });

  const receiptsFor = async (who, recordId) =>
    (await call("GET", `/access-receipts?recordId=${recordId}`, { token: who.token })).body;

  // Hardhat only: push chain time forward and mine a block so an expiry can pass in a test.
  async function advanceChain(seconds) {
    await provider.send("evm_increaseTime", [seconds]);
    await provider.send("evm_mine", []);
  }
  const chainNow = async () => (await provider.getBlock("latest")).timestamp;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    let admin = store.findAccountByEmail("admin@demo.local");
    if (!admin) {
      admin = store.createAccount({
        id: crypto.randomUUID(),
        name: "Receipts Admin",
        email: "receipts.admin@hospital.local",
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

  describe("log-before-release", () => {
    let patient, doctor, id;

    before(async () => {
      patient = await newPatient("rcpt-pat");
      doctor = await newApprovedDoctor("rcpt-doc");
      id = await uploadRecord(patient);
      assert.equal((await grant(patient, id, doctor)).status, 200);
    });

    test("a view returns content plus an access receipt that is already mined on-chain", async () => {
      const view = await call("GET", `/records/${id}/view`, { token: doctor.token });
      assert.equal(view.status, 200, JSON.stringify(view.body));
      assert.equal(view.body.encoding, "base64");
      assert.match(view.body.accessReceipt.txHash, /^0x[0-9a-f]{64}$/);

      const mined = await provider.getTransactionReceipt(view.body.accessReceipt.txHash);
      assert.ok(mined, "the receipt transaction must exist by the time content is released");
      assert.equal(mined.status, 1);
      assert.equal(mined.blockNumber, view.body.accessReceipt.blockNumber);
      assert.equal(mined.from.toLowerCase(), doctor.address.toLowerCase());
    });

    test("the patient sees who opened the record, with the same tx hash", async () => {
      const before = (await receiptsFor(patient, id)).total;
      const view = await call("GET", `/records/${id}/view`, { token: doctor.token });
      const after = await receiptsFor(patient, id);
      assert.equal(after.total, before + 1);
      const latest = after.receipts[0];
      assert.equal(latest.txHash, view.body.accessReceipt.txHash);
      assert.equal(latest.accessor.toLowerCase(), doctor.address.toLowerCase());
      assert.equal(latest.accessorName, "rcpt-doc");
      assert.equal(latest.selfAccess, false);
      assert.equal(latest.recordId, id);
    });

    test("every view adds its own receipt (no de-duplication)", async () => {
      const before = (await receiptsFor(doctor, id)).total;
      await call("GET", `/records/${id}/view`, { token: doctor.token });
      await call("GET", `/records/${id}/view`, { token: doctor.token });
      assert.equal((await receiptsFor(doctor, id)).total, before + 2);
    });

    test("the owner's own view is receipted too, flagged selfAccess", async () => {
      const view = await call("GET", `/records/${id}/view`, { token: patient.token });
      assert.equal(view.status, 200, JSON.stringify(view.body));
      const latest = (await receiptsFor(patient, id)).receipts[0];
      assert.equal(latest.txHash, view.body.accessReceipt.txHash);
      assert.equal(latest.selfAccess, true);
    });

    test("a doctor with no grant is denied and no receipt is written", async () => {
      const stranger = await newApprovedDoctor("rcpt-stranger");
      const before = (await receiptsFor(patient, id)).total;
      const view = await call("GET", `/records/${id}/view`, { token: stranger.token });
      assert.equal(view.status, 403);
      assert.equal(view.body.error, "ACCESS_DENIED");
      assert.equal(view.body.content, undefined);
      assert.equal((await receiptsFor(patient, id)).total, before);
    });

    test("a revoked doctor is denied and no receipt is written", async () => {
      const d2 = await newApprovedDoctor("rcpt-revoked");
      assert.equal((await grant(patient, id, d2)).status, 200);
      assert.equal((await call("GET", `/records/${id}/view`, { token: d2.token })).status, 200);
      await call("POST", `/records/${id}/revoke`, { token: patient.token, json: { doctorAddress: d2.address } });

      const before = (await receiptsFor(patient, id)).total;
      const view = await call("GET", `/records/${id}/view`, { token: d2.token });
      assert.equal(view.status, 403);
      assert.equal((await receiptsFor(patient, id)).total, before);
    });

    test("a doctor with an empty wallet is topped up and can still read", async () => {
      const poor = await newApprovedDoctor("rcpt-poor");
      assert.equal((await grant(patient, id, poor)).status, 200);
      await provider.send("hardhat_setBalance", [poor.address, "0x0"]);
      const view = await call("GET", `/records/${id}/view`, { token: poor.token });
      assert.equal(view.status, 200, JSON.stringify(view.body));
    });
  });

  describe("receipt visibility", () => {
    test("receipts are scoped: a patient sees only reads of their own records, a doctor only their own reads", async () => {
      const pA = await newPatient("scope-a");
      const pB = await newPatient("scope-b");
      const d1 = await newApprovedDoctor("scope-d1");
      const d2 = await newApprovedDoctor("scope-d2");
      const idA = await uploadRecord(pA, "A");
      const idB = await uploadRecord(pB, "B");
      await grant(pA, idA, d1);
      await grant(pB, idB, d2);
      await call("GET", `/records/${idA}/view`, { token: d1.token });
      await call("GET", `/records/${idB}/view`, { token: d2.token });

      const a = (await call("GET", "/access-receipts", { token: pA.token })).body;
      assert.ok(a.receipts.length >= 1);
      assert.ok(a.receipts.every((r) => r.owner.toLowerCase() === pA.address.toLowerCase()));
      const doc1 = (await call("GET", "/access-receipts", { token: d1.token })).body;
      assert.ok(doc1.receipts.every((r) => r.accessor.toLowerCase() === d1.address.toLowerCase()));
      const admin = (await call("GET", "/access-receipts", { token: adminToken })).body;
      assert.ok(admin.total >= a.total + doc1.total - 1);
    });

    test("requires a login", async () => {
      const r = await call("GET", "/access-receipts");
      assert.equal(r.status, 401);
    });
  });

  describe("purpose- and time-bound grants", () => {
    let patient, doctor;

    before(async () => {
      patient = await newPatient("terms-pat");
      doctor = await newApprovedDoctor("terms-doc");
    });

    test("purpose and expiry are stored and shown to patient, doctor and the audit trail", async () => {
      const id = await uploadRecord(patient);
      const expiresAt = new Date((await chainNow()) * 1000 + 3600_000).toISOString();
      const g = await grant(patient, id, doctor, { purpose: "second opinion", expiresAt });
      assert.equal(g.status, 200, JSON.stringify(g.body));
      assert.equal(g.body.purpose, "second opinion");
      assert.equal(g.body.expiresAt, expiresAt);

      const mine = (await call("GET", "/records/mine", { token: patient.token })).body.find((r) => r.recordId === id);
      assert.equal(mine.authorizedDoctors[0].purpose, "second opinion");
      assert.equal(mine.authorizedDoctors[0].expiresAt, expiresAt);

      const shared = (await call("GET", "/records/shared-with-me", { token: doctor.token })).body.find(
        (r) => r.recordId === id
      );
      assert.equal(shared.purpose, "second opinion");
      assert.equal(shared.expiresAt, expiresAt);

      const trail = (await call("GET", "/audit-trail?limit=100", { token: patient.token })).body.events;
      const ev = trail.find((e) => e.eventName === "AccessGranted" && e.recordId === id);
      assert.equal(ev.purpose, "second opinion");
      assert.equal(ev.expiresAt, expiresAt);
    });

    test("omitting purpose and expiry still works: default purpose, no expiry", async () => {
      const id = await uploadRecord(patient);
      const g = await grant(patient, id, doctor);
      assert.equal(g.status, 200);
      assert.equal(g.body.purpose, "General care");
      assert.equal(g.body.expiresAt, null);
    });

    test("access ends on its own once the expiry passes", async () => {
      const id = await uploadRecord(patient);
      const expiresAt = new Date(((await chainNow()) + 60) * 1000).toISOString();
      assert.equal((await grant(patient, id, doctor, { purpose: "short review", expiresAt })).status, 200);
      assert.equal((await call("GET", `/records/${id}/view`, { token: doctor.token })).status, 200);

      await advanceChain(120);

      const view = await call("GET", `/records/${id}/view`, { token: doctor.token });
      assert.equal(view.status, 403, JSON.stringify(view.body));
      assert.equal(view.body.error, "ACCESS_DENIED");
      const check = await call("GET", `/records/${id}/access-check`, { token: doctor.token });
      assert.equal(check.body.authorized, false);
      const shared = (await call("GET", "/records/shared-with-me", { token: doctor.token })).body;
      assert.equal(shared.find((r) => r.recordId === id), undefined);
      const mine = (await call("GET", "/records/mine", { token: patient.token })).body.find((r) => r.recordId === id);
      assert.deepEqual(mine.authorizedDoctors, []);
    });

    test("an expired grant can be extended by granting again", async () => {
      const id = await uploadRecord(patient);
      const soon = new Date(((await chainNow()) + 30) * 1000).toISOString();
      await grant(patient, id, doctor, { purpose: "first", expiresAt: soon });
      await advanceChain(60);
      assert.equal((await call("GET", `/records/${id}/view`, { token: doctor.token })).status, 403);

      const later = new Date(((await chainNow()) + 3600) * 1000).toISOString();
      assert.equal((await grant(patient, id, doctor, { purpose: "follow-up", expiresAt: later })).status, 200);
      assert.equal((await call("GET", `/records/${id}/view`, { token: doctor.token })).status, 200);
    });

    test("bad terms are rejected with 4xx", async () => {
      const id = await uploadRecord(patient);
      const past = await grant(patient, id, doctor, { expiresAt: new Date((await chainNow()) * 1000 - 60_000).toISOString() });
      assert.equal(past.status, 400);
      assert.equal(past.body.error, "EXPIRY_IN_PAST");

      const junk = await grant(patient, id, doctor, { expiresAt: "next tuesday-ish" });
      assert.equal(junk.status, 400);
      assert.equal(junk.body.error, "INVALID_EXPIRY");

      const long = await grant(patient, id, doctor, { purpose: "x".repeat(129) });
      assert.equal(long.status, 400);
      assert.equal(long.body.error, "PURPOSE_TOO_LONG");

      const notString = await grant(patient, id, doctor, { purpose: 42 });
      assert.equal(notString.status, 400);
      assert.equal(notString.body.error, "PURPOSE_REQUIRED");

      // nothing above granted access
      assert.equal((await call("GET", `/records/${id}/view`, { token: doctor.token })).status, 403);
    });
  });
});
