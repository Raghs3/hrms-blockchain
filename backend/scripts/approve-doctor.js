#!/usr/bin/env node
// Usage: node scripts/approve-doctor.js <email>
//        npm run approve-doctor -- <email>
"use strict";
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { approveDoctor } = require("../src/auth");

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  if (!email) {
    console.error("Usage: node scripts/approve-doctor.js <email>");
    process.exit(1);
  }

  try {
    const { alreadyApproved, account } = await approveDoctor(email);
    if (alreadyApproved) {
      console.log(`Doctor ${email} is already approved (walletAddress: ${account.walletAddress})`);
      process.exit(0);
    }

    console.log(`Approving doctor: ${account.name} <${email}>`);
    console.log(`  wallet: ${account.walletAddress}`);
    console.log("✅ Doctor approved and registered on-chain.");
    process.exit(0);
  } catch (err) {
    if (err.code === "DOCTOR_NOT_FOUND") {
      console.error(`No account found for email: ${email}`);
    } else if (err.code === "NOT_A_DOCTOR") {
      console.error(`Account ${email} is not a doctor`);
    } else {
      console.error("Error:", err.message || err);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});

