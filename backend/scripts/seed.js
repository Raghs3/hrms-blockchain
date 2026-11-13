#!/usr/bin/env node
// Seed: creates one admin, one approved doctor, one patient.
// Run ONCE on a fresh data/store.json.
// Usage: node scripts/seed.js
"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const store = require("../src/store");
const { walletForAccount, ensureRegistered } = require("../src/chain");

const BCRYPT_ROUNDS = 12;

const SEEDS = [
  { name: "Admin User",   email: "admin@demo.local",   password: "Admin1234!",   role: "admin",   status: "approved" },
  { name: "Dr. Kapoor",   email: "doctor@demo.local",  password: "Doctor1234!",  role: "doctor",  status: "approved" },
  { name: "Riya Sharma",  email: "patient@demo.local", password: "Patient1234!", role: "patient", status: "approved" },
];

async function main() {
  for (const seed of SEEDS) {
    const existing = store.findAccountByEmail(seed.email);
    if (existing) {
      console.log(`SKIP  ${seed.email} (already exists, id: ${existing.id})`);
      continue;
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(seed.password, BCRYPT_ROUNDS);
    const wallet = walletForAccount(id);

    const account = store.createAccount({
      id,
      name: seed.name,
      email: seed.email,
      passwordHash,
      role: seed.role,
      status: seed.status,
      walletAddress: wallet.address,
      createdAt: new Date().toISOString(),
    });

    // Register on-chain (skip admin — no on-chain role for admin)
    if (seed.role === "patient" || seed.role === "doctor") {
      console.log(`  Registering ${seed.role} on-chain: ${wallet.address} ...`);
      await ensureRegistered(wallet, seed.role);
      store.setName(wallet.address, account.name);
    }

    console.log(`SEED  ${seed.email}  role=${seed.role}  wallet=${wallet.address}`);
  }
  console.log("\nSeed complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed error:", err.message || err);
  process.exit(1);
});

