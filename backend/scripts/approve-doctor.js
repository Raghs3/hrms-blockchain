#!/usr/bin/env node
// Usage: node scripts/approve-doctor.js <email>
//        npm run approve-doctor -- <email>
"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const store = require("../src/store");
const { walletForAccount, ensureRegistered } = require("../src/chain");

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/approve-doctor.js <email>");
    process.exit(1);
  }

  const account = store.findAccountByEmail(email);
  if (!account) {
    console.error(`No account found for email: ${email}`);
    process.exit(1);
  }
  if (account.role !== "doctor") {
    console.error(`Account ${email} is not a doctor (role: ${account.role})`);
    process.exit(1);
  }
  if (account.status === "approved") {
    console.log(`Doctor ${email} is already approved (walletAddress: ${account.walletAddress})`);
    process.exit(0);
  }

  console.log(`Approving doctor: ${account.name} <${email}>`);
  console.log(`  wallet: ${account.walletAddress}`);

  // Register on-chain
  const wallet = walletForAccount(account.id);
  await ensureRegistered(wallet, "doctor");

  // Update store
  store.updateAccount(account.id, { status: "approved" });
  store.setName(account.walletAddress, account.name);

  console.log("✅ Doctor approved and registered on-chain.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});

