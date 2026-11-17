#!/usr/bin/env node
// Seed: creates a small hospital's worth of demo accounts so every screen has
// something to show:
//   - 1 admin
//   - 4 patients
//   - 3 approved doctors (registered on-chain, can log in and receive records)
//   - 2 pending doctors (waiting in the admin's approval table)
//   - 1 rejected doctor (shows as "Disabled" in the admin roster, cannot log in)
// Safe to re-run: accounts that already exist are skipped. On a fresh Hardhat
// chain, move backend/data/store.json aside first, or existing accounts will be
// skipped without being registered on the new chain.
// Usage: npm run seed
"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const store = require("../src/store");
const { walletForAccount, ensureRegistered } = require("../src/chain");

const BCRYPT_ROUNDS = 12;

// Local demo passwords, one per role (also listed in backend/README.md).
const PW = { admin: "Admin1234!", doctor: "Doctor1234!", patient: "Patient1234!" };

// The first admin/doctor/patient keep their original logins: the demo script and the
// test suites rely on admin@, doctor@ and patient@demo.local.
const SEEDS = [
  { name: "Admin User", email: "admin@demo.local", role: "admin", status: "approved" },

  // Patients
  { name: "Riya Sharma", email: "patient@demo.local", role: "patient", status: "approved" },
  { name: "Arjun Mehta", email: "arjun.mehta@demo.local", role: "patient", status: "approved" },
  { name: "Neha Kulkarni", email: "neha.kulkarni@demo.local", role: "patient", status: "approved" },
  { name: "Imran Sheikh", email: "imran.sheikh@demo.local", role: "patient", status: "approved" },

  // Doctors: approved (registered on-chain)
  { name: "Dr. Kapoor", email: "doctor@demo.local", role: "doctor", status: "approved" },
  { name: "Dr. Anjali Rao", email: "anjali.rao@demo.local", role: "doctor", status: "approved" },
  { name: "Dr. Vikram Desai", email: "vikram.desai@demo.local", role: "doctor", status: "approved" },

  // Doctors: pending (appear in the admin's approval table, not on-chain yet)
  { name: "Dr. Sneha Iyer", email: "sneha.iyer@demo.local", role: "doctor", status: "pending", daysAgo: 1 },
  { name: "Dr. Rohan Gupta", email: "rohan.gupta@demo.local", role: "doctor", status: "pending", daysAgo: 2 },

  // Doctors: rejected (shown as Disabled in the admin roster, cannot log in)
  { name: "Dr. Karan Malhotra", email: "karan.malhotra@demo.local", role: "doctor", status: "rejected", daysAgo: 4 },
];

async function main() {
  const counts = { created: 0, skipped: 0 };

  for (const seed of SEEDS) {
    const existing = store.findAccountByEmail(seed.email);
    if (existing) {
      // Self-heal: a store that outlived its chain (fresh `hardhat node` + deploy) still lists
      // these accounts, but they are not registered on the new contracts. ensureRegistered is
      // idempotent and also tops up gas for doctors (every read is a transaction).
      const onChainExisting =
        existing.role === "patient" || (existing.role === "doctor" && existing.status === "approved");
      if (onChainExisting) {
        const wallet = walletForAccount(existing.id);
        await ensureRegistered(wallet, existing.role);
        store.setName(wallet.address, existing.name);
      }
      console.log(`SKIP  ${seed.email} (already exists, id: ${existing.id}${onChainExisting ? "; on-chain registration verified" : ""})`);
      counts.skipped++;
      continue;
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(PW[seed.role], BCRYPT_ROUNDS);
    const wallet = walletForAccount(id);
    const createdAt = new Date(Date.now() - (seed.daysAgo || 0) * 24 * 60 * 60 * 1000).toISOString();

    const account = store.createAccount({
      id,
      name: seed.name,
      email: seed.email,
      passwordHash,
      role: seed.role,
      status: seed.status,
      walletAddress: wallet.address,
      createdAt,
    });

    // Register on-chain: patients and approved doctors only. Admins have no on-chain
    // role here, and pending/rejected doctors must not hold the DOCTOR_ROLE.
    const onChain = seed.role === "patient" || (seed.role === "doctor" && seed.status === "approved");
    if (onChain) {
      console.log(`  Registering ${seed.role} on-chain: ${wallet.address} ...`);
      await ensureRegistered(wallet, seed.role);
      store.setName(wallet.address, account.name);
    }

    console.log(`SEED  ${seed.email.padEnd(30)} ${seed.role.padEnd(8)} ${seed.status.padEnd(9)} wallet=${wallet.address}`);
    counts.created++;
  }

  const tally = (role, status) => SEEDS.filter((s) => s.role === role && (!status || s.status === status)).length;
  console.log(`\nSeed complete: ${counts.created} created, ${counts.skipped} skipped.`);
  console.log(
    `Cast: ${tally("admin")} admin, ${tally("patient")} patients, ` +
      `${tally("doctor", "approved")} approved / ${tally("doctor", "pending")} pending / ${tally("doctor", "rejected")} rejected doctors.`
  );
  console.log("Passwords: Admin1234! (admin), Doctor1234! (doctors), Patient1234! (patients).");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed error:", err.message || err);
  process.exit(1);
});
