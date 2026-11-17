"use strict";
// Admin doctor roster + disable / re-enable (an approved doctor can be disabled later).
// Needs a running Hardhat node with the contracts deployed (like the other suites).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const store = require("../src/store");
const { jwtSecret } = require("../src/config");

const PASSWORD = "AdminRoster1!";

describe("Admin doctor roster, disable and re-enable", () => {
  let server;
  let baseUrl;
  let adminToken;
  let patientToken;

  async function call(method, path, { token, json } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(baseUrl + path, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined });
    return { status: res.status, body: await res.json() };
  }

  const uniqueEmail = (tag) => `${tag}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}@roster.local`;

  async function newDoctor(tag, { approve }) {
    const email = uniqueEmail(tag);
    const reg = await call("POST", "/auth/register", { json: { name: tag, email, password: PASSWORD, role: "doctor" } });
    assert.equal(reg.status, 201, JSON.stringify(reg.body));
    if (approve) {
      const a = await call("POST", `/admin/doctors/${reg.body.user.id}/approve`, { token: adminToken });
      assert.equal(a.status, 200, JSON.stringify(a.body));
    }
    return { id: reg.body.user.id, email };
  }

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    let admin = store.findAccountByEmail("admin@demo.local");
    if (!admin) {
      admin = store.createAccount({
        id: crypto.randomUUID(),
        name: "Roster Admin",
        email: "roster.admin@hospital.local",
        passwordHash: "hash",
        role: "admin",
        status: "approved",
        walletAddress: "0xF3B90E6E1E36fD49a940e26cBc5b9adc02283090",
        createdAt: new Date().toISOString(),
      });
    }
    adminToken = jwt.sign({ sub: admin.id, name: admin.name, role: admin.role }, jwtSecret, { expiresIn: "1h" });

    const p = await call("POST", "/auth/register", {
      json: { name: "Roster Patient", email: uniqueEmail("rp"), password: PASSWORD, role: "patient" },
    });
    patientToken = p.body.token;
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test("GET /admin/doctors requires the admin role", async () => {
    assert.equal((await call("GET", "/admin/doctors")).status, 401);
    assert.equal((await call("GET", "/admin/doctors", { token: patientToken })).status, 403);
  });

  test("GET /admin/doctors lists doctors of every status and leaks no password hashes", async () => {
    const approved = await newDoctor("rosterOk", { approve: true });
    const pending = await newDoctor("rosterPending", { approve: false });
    const rejected = await newDoctor("rosterRejected", { approve: false });
    await call("POST", `/admin/doctors/${rejected.id}/reject`, { token: adminToken });

    const r = await call("GET", "/admin/doctors", { token: adminToken });
    assert.equal(r.status, 200);
    const statusOf = (id) => r.body.doctors.find((d) => d.id === id)?.status;
    assert.equal(statusOf(approved.id), "approved");
    assert.equal(statusOf(pending.id), "pending");
    assert.equal(statusOf(rejected.id), "rejected");
    assert.ok(r.body.doctors.every((d) => d.role === "doctor"));
    assert.ok(!JSON.stringify(r.body).includes("passwordHash"));
  });

  test("an approved doctor can be disabled, loses access, and can be re-enabled", async () => {
    const doc = await newDoctor("rosterToggle", { approve: true });

    const before = await call("POST", "/auth/login", { json: { email: doc.email, password: PASSWORD } });
    assert.equal(before.status, 200);
    const token = before.body.token;
    assert.equal((await call("GET", "/records/shared-with-me", { token })).status, 200);

    const disable = await call("POST", `/admin/doctors/${doc.id}/reject`, { token: adminToken });
    assert.equal(disable.status, 200);
    assert.equal(disable.body.doctor.status, "rejected");

    // existing session and new logins are both blocked
    const blocked = await call("GET", "/records/shared-with-me", { token });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error, "DOCTOR_REJECTED");
    assert.equal((await call("POST", "/auth/login", { json: { email: doc.email, password: PASSWORD } })).status, 403);

    // a disabled doctor disappears from the patient's grant dropdown
    const dir = await call("GET", "/doctors", { token: patientToken });
    assert.ok(!dir.body.doctors.some((d) => d.name === "rosterToggle"));

    // re-enable restores everything
    const enable = await call("POST", `/admin/doctors/${doc.id}/approve`, { token: adminToken });
    assert.equal(enable.status, 200);
    assert.equal(enable.body.doctor.status, "approved");
    assert.equal((await call("GET", "/records/shared-with-me", { token })).status, 200);
    assert.equal((await call("POST", "/auth/login", { json: { email: doc.email, password: PASSWORD } })).status, 200);
    const dir2 = await call("GET", "/doctors", { token: patientToken });
    assert.ok(dir2.body.doctors.some((d) => d.name === "rosterToggle"));
  });
});
