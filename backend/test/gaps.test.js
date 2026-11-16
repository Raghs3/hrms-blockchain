"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const store = require("../src/store");
const { jwtSecret } = require("../src/config");

describe("Backend Gaps Test Suite", () => {
  let server;
  let baseUrl;
  let adminToken;
  let doctorToken;
  let patientToken;

  let adminAccount;
  let doctorAccount;
  let patientAccount;

  before(async () => {
    // Start test server on ephemeral port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Prepare or find test accounts
    adminAccount = store.findAccountByEmail("admin@demo.local");
    if (!adminAccount) {
      adminAccount = store.createAccount({
        id: crypto.randomUUID(),
        name: "Test Admin",
        email: "test.admin@hospital.local",
        passwordHash: "hash",
        role: "admin",
        status: "approved",
        walletAddress: "0xF3B90E6E1E36fD49a940e26cBc5b9adc02283090",
        createdAt: new Date().toISOString(),
      });
    }

    doctorAccount = store.findAccountByEmail("doctor@demo.local");
    if (!doctorAccount) {
      doctorAccount = store.createAccount({
        id: crypto.randomUUID(),
        name: "Test Doctor",
        email: "test.doctor@hospital.local",
        passwordHash: "hash",
        role: "doctor",
        status: "approved",
        walletAddress: "0x37f07dD33bC2FA0547EdF131Cb224f6F8fC670D1",
        createdAt: new Date().toISOString(),
      });
    }

    patientAccount = store.findAccountByEmail("patient@demo.local");
    if (!patientAccount) {
      patientAccount = store.createAccount({
        id: crypto.randomUUID(),
        name: "Test Patient",
        email: "test.patient@hospital.local",
        passwordHash: "hash",
        role: "patient",
        status: "approved",
        walletAddress: "0x9b696188431dbEF07f6F922e034cbA2ce3778Cfe",
        createdAt: new Date().toISOString(),
      });
    }

    adminToken = jwt.sign({ sub: adminAccount.id, name: adminAccount.name, role: adminAccount.role }, jwtSecret, { expiresIn: "1h" });
    doctorToken = jwt.sign({ sub: doctorAccount.id, name: doctorAccount.name, role: doctorAccount.role }, jwtSecret, { expiresIn: "1h" });
    patientToken = jwt.sign({ sub: patientAccount.id, name: patientAccount.name, role: patientAccount.role }, jwtSecret, { expiresIn: "1h" });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ── B4: GET /health ──────────────────────────────────────────────────────────
  describe("B4: GET /health", () => {
    test("returns ok: true and boolean demoAuth", async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.ok, true);
      assert.equal(typeof data.demoAuth, "boolean");
    });
  });

  // ── B1: Admin Routes ────────────────────────────────────────────────────────
  describe("B1: Admin Routes", () => {
    describe("GET /admin/pending-doctors", () => {
      test("unauthenticated returns 401 INVALID_TOKEN", async () => {
        const res = await fetch(`${baseUrl}/admin/pending-doctors`);
        assert.equal(res.status, 401);
        const data = await res.json();
        assert.equal(data.error, "INVALID_TOKEN");
      });

      test("patient role returns 403 WRONG_ROLE", async () => {
        const res = await fetch(`${baseUrl}/admin/pending-doctors`, {
          headers: { Authorization: `Bearer ${patientToken}` },
        });
        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.error, "WRONG_ROLE");
      });

      test("doctor role returns 403 WRONG_ROLE", async () => {
        const res = await fetch(`${baseUrl}/admin/pending-doctors`, {
          headers: { Authorization: `Bearer ${doctorToken}` },
        });
        assert.equal(res.status, 403);
        const data = await res.json();
        assert.equal(data.error, "WRONG_ROLE");
      });

      test("admin role returns 200 and list of pending doctors", async () => {
        const res = await fetch(`${baseUrl}/admin/pending-doctors`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.ok(Array.isArray(data.doctors));
        // All returned doctors must have status: 'pending'
        for (const doc of data.doctors) {
          assert.equal(doc.status, "pending");
          assert.equal(doc.role, "doctor");
          assert.equal(doc.passwordHash, undefined); // sanitized
        }
      });
    });

    describe("POST /admin/doctors/:id/approve", () => {
      test("unauthenticated returns 401 INVALID_TOKEN", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/dummy-id/approve`, {
          method: "POST",
        });
        assert.equal(res.status, 401);
      });

      test("patient role returns 403 WRONG_ROLE", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/dummy-id/approve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${patientToken}` },
        });
        assert.equal(res.status, 403);
      });

      test("non-existent doctor returns 404 DOCTOR_NOT_FOUND", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/non-existent-id/approve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.equal(data.error, "DOCTOR_NOT_FOUND");
      });

      test("attempting to approve non-doctor returns 400 NOT_A_DOCTOR", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/${patientAccount.id}/approve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, "NOT_A_DOCTOR");
      });

      test("approves a pending doctor and registers on-chain", async () => {
        const docId = crypto.randomUUID();
        store.createAccount({
          id: docId,
          name: "Dr. Approval Test",
          email: `doc.approve.${Date.now()}@hospital.local`,
          passwordHash: "hash",
          role: "doctor",
          status: "pending",
          walletAddress: "0x1111111111111111111111111111111111111111",
          createdAt: new Date().toISOString(),
        });

        const res = await fetch(`${baseUrl}/admin/doctors/${docId}/approve`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, "approved");
        assert.equal(data.doctor.id, docId);
        assert.equal(data.doctor.status, "approved");

        // Verify in store
        const updated = store.findAccountById(docId);
        assert.equal(updated.status, "approved");
      });
    });

    describe("POST /admin/doctors/:id/reject", () => {
      test("unauthenticated returns 401 INVALID_TOKEN", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/dummy-id/reject`, {
          method: "POST",
        });
        assert.equal(res.status, 401);
      });

      test("patient role returns 403 WRONG_ROLE", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/dummy-id/reject`, {
          method: "POST",
          headers: { Authorization: `Bearer ${patientToken}` },
        });
        assert.equal(res.status, 403);
      });

      test("non-existent doctor returns 404 DOCTOR_NOT_FOUND", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/non-existent-id/reject`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.equal(data.error, "DOCTOR_NOT_FOUND");
      });

      test("attempting to reject non-doctor returns 400 NOT_A_DOCTOR", async () => {
        const res = await fetch(`${baseUrl}/admin/doctors/${patientAccount.id}/reject`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.error, "NOT_A_DOCTOR");
      });

      test("rejects a pending doctor setting status to rejected", async () => {
        const docId = crypto.randomUUID();
        store.createAccount({
          id: docId,
          name: "Dr. Reject Test",
          email: `doc.reject.${Date.now()}@hospital.local`,
          passwordHash: "hash",
          role: "doctor",
          status: "pending",
          walletAddress: "0x2222222222222222222222222222222222222222",
          createdAt: new Date().toISOString(),
        });

        const res = await fetch(`${baseUrl}/admin/doctors/${docId}/reject`, {
          method: "POST",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.status, "rejected");
        assert.equal(data.doctor.id, docId);
        assert.equal(data.doctor.status, "rejected");

        // Verify in store
        const updated = store.findAccountById(docId);
        assert.equal(updated.status, "rejected");
      });
    });
  });

  // ── B2: GET /records/shared-with-me ──────────────────────────────────────────
  describe("B2: GET /records/shared-with-me", () => {
    test("unauthenticated returns 401 INVALID_TOKEN", async () => {
      const res = await fetch(`${baseUrl}/records/shared-with-me`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "INVALID_TOKEN");
    });

    test("patient role returns 403 WRONG_ROLE", async () => {
      const res = await fetch(`${baseUrl}/records/shared-with-me`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      assert.equal(res.status, 403);
      const data = await res.json();
      assert.equal(data.error, "WRONG_ROLE");
    });

    test("doctor role returns 200 array", async () => {
      const res = await fetch(`${baseUrl}/records/shared-with-me`, {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
      // If any records are shared, check schema
      for (const rec of data) {
        assert.ok(rec.recordId);
        assert.ok(rec.owner);
        assert.ok(rec.cid);
        assert.ok(rec.fileHash);
      }
    });

    test("empty result returns 200 empty array for doctor with no shares", async () => {
      const freshDoc = store.createAccount({
        id: crypto.randomUUID(),
        name: "Dr. Empty Shares",
        email: `doc.empty.${Date.now()}@hospital.local`,
        passwordHash: "hash",
        role: "doctor",
        status: "approved",
        walletAddress: "0x3333333333333333333333333333333333333333",
        createdAt: new Date().toISOString(),
      });
      const freshToken = jwt.sign({ sub: freshDoc.id, name: freshDoc.name, role: freshDoc.role }, jwtSecret, { expiresIn: "1h" });

      const res = await fetch(`${baseUrl}/records/shared-with-me`, {
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data));
      assert.equal(data.length, 0);
    });
  });

  // ── B3 & B5: Additive Fields on Records ──────────────────────────────────────
  describe("B3 & B5: Additive Record Fields", () => {
    test("GET /records/mine includes fileHash on each record item", async () => {
      const res = await fetch(`${baseUrl}/records/mine`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      assert.equal(res.status, 200);
      const records = await res.json();
      assert.ok(Array.isArray(records));
      if (records.length > 0) {
        for (const rec of records) {
          assert.ok("fileHash" in rec, "record must include fileHash field");
          assert.equal(typeof rec.fileHash, "string");
          assert.ok(rec.fileHash.startsWith("0x"));
        }
      }
    });

    test("GET /records/:id/view requires auth (401 unauthenticated)", async () => {
      const res = await fetch(`${baseUrl}/records/1/view`);
      assert.equal(res.status, 401);
    });
  });

  // ── B6: GET /audit-trail ─────────────────────────────────────────────────────
  describe("B6: GET /audit-trail", () => {
    test("unauthenticated returns 401 INVALID_TOKEN", async () => {
      const res = await fetch(`${baseUrl}/audit-trail`);
      assert.equal(res.status, 401);
      const data = await res.json();
      assert.equal(data.error, "INVALID_TOKEN");
    });

    test("patient role returns 200 and audit events for own records", async () => {
      const res = await fetch(`${baseUrl}/audit-trail`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(typeof data.total, "number");
      assert.ok(Array.isArray(data.events));
      for (const ev of data.events) {
        assert.ok(ev.type);
        assert.ok(ev.eventName);
        assert.ok(ev.txHash);
        assert.ok(ev.timestamp);
        assert.equal(ev.owner.toLowerCase(), patientAccount.walletAddress.toLowerCase());
      }
    });

    test("doctor role returns 200 and audit events where doctor is participant", async () => {
      const res = await fetch(`${baseUrl}/audit-trail`, {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(typeof data.total, "number");
      assert.ok(Array.isArray(data.events));
      for (const ev of data.events) {
        assert.ok(["ACCESS_GRANTED", "ACCESS_REVOKED"].includes(ev.type));
        assert.equal(ev.doctor.toLowerCase(), doctorAccount.walletAddress.toLowerCase());
      }
    });

    test("admin role returns 200 and all system audit events", async () => {
      const res = await fetch(`${baseUrl}/audit-trail`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(typeof data.total, "number");
      assert.ok(Array.isArray(data.events));
      for (const ev of data.events) {
        assert.ok(ev.type);
        assert.ok(ev.txHash);
        assert.ok(ev.timestamp);
      }
    });

    test("pagination limit and offset work as expected", async () => {
      const res = await fetch(`${baseUrl}/audit-trail?limit=2&offset=0`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.limit, 2);
      assert.equal(data.offset, 0);
      assert.ok(data.events.length <= 2);
    });

    test("fresh user with no events returns empty events array", async () => {
      const freshUser = store.createAccount({
        id: crypto.randomUUID(),
        name: "Fresh Patient",
        email: `fresh.patient.${Date.now()}@example.local`,
        passwordHash: "hash",
        role: "patient",
        status: "approved",
        walletAddress: "0x4444444444444444444444444444444444444444",
        createdAt: new Date().toISOString(),
      });
      const freshToken = jwt.sign({ sub: freshUser.id, name: freshUser.name, role: freshUser.role }, jwtSecret, { expiresIn: "1h" });

      const res = await fetch(`${baseUrl}/audit-trail`, {
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.total, 0);
      assert.equal(data.events.length, 0);
    });
  });
});
