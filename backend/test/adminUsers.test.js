"use strict";
// GET /admin/users: the data behind the admin Users / Doctors / Patients pages.
// Needs a running Hardhat node with the contracts deployed (like the other suites).
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const store = require("../src/store");
const { jwtSecret } = require("../src/config");

const PASSWORD = "AdminUsers1!";

describe("Admin users listing", () => {
  let server;
  let baseUrl;
  let adminToken;
  let patient;
  let doctorEmail;

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

  const uniqueEmail = (tag) => `${tag}.${Date.now()}.${crypto.randomBytes(3).toString("hex")}@users.local`;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    let admin = store.findAccountByEmail("admin@demo.local");
    if (!admin) {
      admin = store.createAccount({
        id: crypto.randomUUID(),
        name: "Users Admin",
        email: "users.admin@hospital.local",
        passwordHash: "hash",
        role: "admin",
        status: "approved",
        walletAddress: "0xF3B90E6E1E36fD49a940e26cBc5b9adc02283090",
        createdAt: new Date().toISOString(),
      });
    }
    adminToken = jwt.sign({ sub: admin.id, name: admin.name, role: admin.role }, jwtSecret, { expiresIn: "1h" });

    const reg = await call("POST", "/auth/register", {
      json: { name: "Users Patient", email: uniqueEmail("up"), password: PASSWORD, role: "patient" },
    });
    patient = { token: reg.body.token, id: reg.body.user.id };

    doctorEmail = uniqueEmail("ud");
    await call("POST", "/auth/register", { json: { name: "Users Doctor", email: doctorEmail, password: PASSWORD, role: "doctor" } });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  test("requires the admin role", async () => {
    assert.equal((await call("GET", "/admin/users")).status, 401);
    assert.equal((await call("GET", "/admin/users", { token: patient.token })).status, 403);
  });

  test("lists admins, doctors and patients without password hashes", async () => {
    const r = await call("GET", "/admin/users", { token: adminToken });
    assert.equal(r.status, 200);
    const roles = new Set(r.body.users.map((u) => u.role));
    assert.ok(roles.has("admin") && roles.has("doctor") && roles.has("patient"));
    assert.ok(!JSON.stringify(r.body).includes("passwordHash"));
    assert.ok(r.body.users.find((u) => u.id === patient.id));
    assert.ok(r.body.users.find((u) => u.email === doctorEmail.toLowerCase())?.status === "pending");
  });

  test("?role= narrows the list", async () => {
    const doctors = await call("GET", "/admin/users?role=doctor", { token: adminToken });
    assert.ok(doctors.body.users.length > 0 && doctors.body.users.every((u) => u.role === "doctor"));
    const patients = await call("GET", "/admin/users?role=patient", { token: adminToken });
    assert.ok(patients.body.users.length > 0 && patients.body.users.every((u) => u.role === "patient"));
    const none = await call("GET", "/admin/users?role=nobody", { token: adminToken });
    assert.deepEqual(none.body.users, []);
  });

  test("patients carry their on-chain record count; others do not", async () => {
    const before = await call("GET", "/admin/users?role=patient", { token: adminToken });
    assert.equal(before.body.users.find((u) => u.id === patient.id).recordCount, 0);

    const form = new FormData();
    form.append("file", new Blob([Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")]), "count.pdf");
    const up = await call("POST", "/records/upload", { token: patient.token, form });
    assert.equal(up.status, 200, JSON.stringify(up.body));

    const after = await call("GET", "/admin/users?role=patient", { token: adminToken });
    assert.equal(after.body.users.find((u) => u.id === patient.id).recordCount, 1);

    const doctors = await call("GET", "/admin/users?role=doctor", { token: adminToken });
    assert.ok(doctors.body.users.every((u) => !("recordCount" in u)));
  });
});
