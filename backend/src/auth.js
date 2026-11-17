"use strict";
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const { jwtSecret, demoAuth } = require("./config");
const { walletFor, walletForAccount, ensureRegistered } = require("./chain");
const store = require("./store");

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = "8h";

// ── Rate limiters ─────────────────────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 100),
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TOO_MANY_REQUESTS" },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function validateEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function sanitizeUser(account) {
  const { id, name, email, role, status, walletAddress, createdAt } = account;
  return { id, name, email, role, status, walletAddress, createdAt };
}

function signToken(account) {
  // Payload keeps every field the existing requireAuth middleware needs:
  //   claims.name  → used by walletFor() in DEMO mode; in real mode we use sub
  //   claims.role  → role check in requireAuth
  // Additionally: sub = account id (new, for real-auth wallet derivation)
  return jwt.sign(
    { sub: account.id, name: account.name, role: account.role },
    jwtSecret,
    { expiresIn: JWT_EXPIRY }
  );
}

// ── POST /auth/register ───────────────────────────────────────────────────────
async function register(req, res) {
  const { name, email, password, role } = req.body || {};

  if (
    typeof name !== "string" || !name.trim() ||
    !validateEmail(email) ||
    typeof password !== "string" || password.length < 8 ||
    !["patient", "doctor"].includes(role)
  ) {
    return res.status(400).json({ error: "VALIDATION_ERROR" });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (store.findAccountByEmail(cleanEmail)) {
    return res.status(409).json({ error: "EMAIL_EXISTS" });
  }

  const id = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const status = role === "patient" ? "approved" : "pending";
  const wallet = walletForAccount(id);

  // bcrypt is slow and async, so another request for the same email may have been
  // created while we were hashing. Check again, with no await before createAccount.
  if (store.findAccountByEmail(cleanEmail)) {
    return res.status(409).json({ error: "EMAIL_EXISTS" });
  }

  const account = store.createAccount({
    id,
    name: name.trim(),
    email: cleanEmail,
    passwordHash,
    role,
    status,
    walletAddress: wallet.address,
    createdAt: new Date().toISOString(),
  });

  // Register patient on-chain immediately; doctors wait for approval
  if (role === "patient") {
    await ensureRegistered(wallet, "patient");
    store.setName(wallet.address, account.name);
    const token = signToken(account);
    return res.status(201).json({ token, user: sanitizeUser(account) });
  }

  // Doctor: pending, no token
  return res.status(201).json({ user: sanitizeUser(account) });
}

// ── POST /auth/login ──────────────────────────────────────────────────────────
async function login(req, res) {
  const { email, password } = req.body || {};

  if (!validateEmail(email) || typeof password !== "string" || !password) {
    return res.status(400).json({ error: "VALIDATION_ERROR" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const account = store.findAccountByEmail(cleanEmail);

  if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }

  if (account.role === "doctor" && account.status === "pending") {
    return res.status(403).json({ error: "DOCTOR_PENDING" });
  }
  if (account.role === "doctor" && account.status === "rejected") {
    return res.status(403).json({ error: "DOCTOR_REJECTED" });
  }

  // Self-heal on-chain registration for approved accounts if needed (idempotent, non-demo path only)
  if (account.status === "approved" && (account.role === "patient" || account.role === "doctor")) {
    const wallet = walletForAccount(account.id);
    await ensureRegistered(wallet, account.role);
    store.setName(wallet.address, account.name);
  }

  const token = signToken(account);
  return res.json({ token, user: sanitizeUser(account) });
}

// ── POST /auth/demo-login (old name+role, only when DEMO_AUTH=true) ───────────
async function demoLogin(req, res) {
  if (!demoAuth) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }
  const { name, role } = req.body || {};
  if (typeof name !== "string" || !name.trim() || !["patient", "doctor"].includes(role)) {
    return res.status(400).json({ error: "INVALID_LOGIN" });
  }
  const cleanName = name.trim();
  const wallet = walletFor(cleanName, role);
  await ensureRegistered(wallet, role);
  store.setName(wallet.address, cleanName);

  const token = jwt.sign({ name: cleanName, role }, jwtSecret, { expiresIn: JWT_EXPIRY });
  return res.json({
    token,
    role,
    walletAddress: wallet.address,
    userId: `u_${wallet.address.slice(2, 8).toLowerCase()}`,
    name: cleanName,
  });
}

// ── GET /auth/me ──────────────────────────────────────────────────────────────
function me(req, res) {
  return res.json({ user: sanitizeUser(req.accountRecord) });
}

// ── GET /doctors ──────────────────────────────────────────────────────────────
function doctors(req, res) {
  const list = store.listApprovedDoctors().map((a) => ({
    name: a.name,
    walletAddress: a.walletAddress,
  }));
  return res.json({ doctors: list });
}

// ── Admin Doctor Approval / Rejection ─────────────────────────────────────────
async function approveDoctor(idOrEmail) {
  const clean = (idOrEmail || "").trim();
  const account = store.findAccountById(clean) || store.findAccountByEmail(clean.toLowerCase());
  if (!account) {
    const err = new Error("Doctor account not found");
    err.code = "DOCTOR_NOT_FOUND";
    err.statusCode = 404;
    throw err;
  }
  if (account.role !== "doctor") {
    const err = new Error("Account is not a doctor");
    err.code = "NOT_A_DOCTOR";
    err.statusCode = 400;
    throw err;
  }
  if (account.status === "approved") {
    return { alreadyApproved: true, account };
  }

  // Register on-chain
  const wallet = walletForAccount(account.id);
  await ensureRegistered(wallet, "doctor");

  // Update store
  const updated = store.updateAccount(account.id, { status: "approved" });
  store.setName(account.walletAddress, account.name);

  return { alreadyApproved: false, account: updated };
}

async function rejectDoctor(idOrEmail) {
  const clean = (idOrEmail || "").trim();
  const account = store.findAccountById(clean) || store.findAccountByEmail(clean.toLowerCase());
  if (!account) {
    const err = new Error("Doctor account not found");
    err.code = "DOCTOR_NOT_FOUND";
    err.statusCode = 404;
    throw err;
  }
  if (account.role !== "doctor") {
    const err = new Error("Account is not a doctor");
    err.code = "NOT_A_DOCTOR";
    err.statusCode = 400;
    throw err;
  }

  // Update store
  const updated = store.updateAccount(account.id, { status: "rejected" });
  return { account: updated };
}

// ── Middleware: requireAuth(...roles) ─────────────────────────────────────────
// Works for both real accounts (sub present) and demo tokens (name present).
function requireAuth(...allowedRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    let claims;
    try {
      claims = jwt.verify(token, jwtSecret);
    } catch (err) {
      const code = err?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
      return res.status(401).json({ error: code });
    }

    // Real-auth path: sub is the account id
    if (claims.sub) {
      const account = store.findAccountById(claims.sub);
      if (!account) return res.status(401).json({ error: "INVALID_TOKEN" });

      // A token outlives an admin's decision: a doctor who was rejected after logging in
      // must lose access immediately, not when the 8h token expires.
      if (account.role === "doctor" && account.status !== "approved") {
        const code = account.status === "rejected" ? "DOCTOR_REJECTED" : "DOCTOR_PENDING";
        return res.status(403).json({ error: code });
      }

      // Role comes from the stored account only, never from the request
      if (allowedRoles.length && !allowedRoles.includes(account.role)) {
        return res.status(403).json({ error: "WRONG_ROLE" });
      }
      req.user = { sub: account.id, name: account.name, role: account.role };
      req.accountRecord = account;
      req.wallet = walletForAccount(account.id);
      return next();
    }

    // Demo-auth path (DEMO_AUTH=true tokens): name + role in payload
    if (demoAuth && claims.name && claims.role) {
      if (allowedRoles.length && !allowedRoles.includes(claims.role)) {
        return res.status(403).json({ error: "WRONG_ROLE" });
      }
      req.user = claims;
      req.wallet = walletFor(claims.name, claims.role);
      return next();
    }

    return res.status(401).json({ error: "INVALID_TOKEN" });
  };
}

module.exports = {
  register,
  login,
  demoLogin,
  me,
  doctors,
  requireAuth,
  authLimiter,
  sanitizeUser,
  approveDoctor,
  rejectDoctor,
};
