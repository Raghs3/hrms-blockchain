/**
 * rehearsal-multirole.cjs
 * Comprehensive End-to-End Multi-Role Rehearsal (Phase L)
 *
 * Verifies the full Patient - Doctor - Admin lifecycle against the running backend & blockchain:
 * 1. Admin login & session verification
 * 2. Doctor registration (status: pending, token withheld)
 * 3. Doctor approval via backend admin script (status -> approved, registered on-chain)
 * 4. Approved doctor login & token issuance
 * 5. Patient login & doctor directory lookup (verifies doctor appears with on-chain address)
 * 6. Patient uploads medical record (encrypted, IPFS pinned, on-chain hash anchored)
 * 7. Pre-grant access check by doctor (verifies authorized: false, view 403)
 * 8. Patient grants on-chain consent to approved doctor
 * 9. Doctor accesses & decrypts record (verifies plaintext integrity)
 * 10. Patient revokes doctor consent
 * 11. Doctor post-revoke access check (verifies authorized: false, view 403 ACCESS_DENIED)
 */

const { execSync } = require('child_process');
const path = require('path');

const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const APPROVE_SCRIPT = path.resolve(__dirname, '../../backend/scripts/approve-doctor.js');

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = options.headers || {};
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body,
  });

  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

let passCount = 0;
let failCount = 0;

function assert(description, condition, details = null) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    if (details) {
      console.error('     Details:', details);
    }
    failCount++;
  }
}

async function runRehearsal() {
  console.log('\n======================================================');
  console.log('  HealthChain Phase L: End-to-End Multi-Role Rehearsal');
  console.log('======================================================\n');

  const timestamp = Date.now();
  const testDoctorEmail = `dr.test.${timestamp}@hospital.local`;
  const testDoctorName = `Dr. Rehearsal ${timestamp.toString().slice(-4)}`;
  const testPassword = 'Password123!';

  // --- STAGE 1: Admin Login & Identity Verification ---
  console.log('--- Stage 1: Hospital Administrator Authentication ---');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    json: { email: 'admin@demo.local', password: 'Admin1234!' },
  });
  assert('Admin login successful (HTTP 200)', adminLogin.status === 200, adminLogin.data);
  const adminToken = adminLogin.data?.token;

  const adminMe = await request('/auth/me', { token: adminToken });
  assert('Admin role confirmed as "admin"', adminMe.data?.user?.role === 'admin', adminMe.data);
  assert('Admin status confirmed as "approved"', adminMe.data?.user?.status === 'approved', adminMe.data);

  // --- STAGE 2: New Doctor Self-Registration (Pending) ---
  console.log('\n--- Stage 2: Doctor Self-Registration (Pending State) ---');
  const docReg = await request('/auth/register', {
    method: 'POST',
    json: {
      name: testDoctorName,
      email: testDoctorEmail,
      password: testPassword,
      role: 'doctor',
    },
  });
  assert('Doctor registration accepted (HTTP 201)', docReg.status === 201, docReg.data);
  assert('Doctor initial status is "pending"', docReg.data?.user?.status === 'pending', docReg.data);
  assert('Doctor issued NO token prior to approval (security boundary)', !docReg.data?.token);
  const docWallet = docReg.data?.user?.walletAddress;
  assert('Doctor assigned deterministic wallet address', !!docWallet && docWallet.startsWith('0x'), docWallet);

  // Verify pending doctor cannot log in
  const pendingLogin = await request('/auth/login', {
    method: 'POST',
    json: { email: testDoctorEmail, password: testPassword },
  });
  assert('Pending doctor login returns 403 DOCTOR_PENDING', pendingLogin.status === 403 && pendingLogin.data?.error === 'DOCTOR_PENDING', pendingLogin.data);

  // --- STAGE 3: Doctor Approval via Administrative Pipeline ---
  console.log('\n--- Stage 3: On-Chain Doctor Approval via Admin Pipeline ---');
  try {
    const approveOutput = execSync(`node "${APPROVE_SCRIPT}" ${testDoctorEmail}`, {
      encoding: 'utf-8',
    });
    console.log('    CLI Output:', approveOutput.trim());
    assert('Doctor approval script executed successfully', approveOutput.includes('approved and registered on-chain'));
  } catch (err) {
    assert('Doctor approval script execution', false, err.message);
  }

  // Doctor logs in now that approval is complete
  const docLogin = await request('/auth/login', {
    method: 'POST',
    json: { email: testDoctorEmail, password: testPassword },
  });
  assert('Approved doctor login succeeds (HTTP 200)', docLogin.status === 200, docLogin.data);
  const doctorToken = docLogin.data?.token;
  assert('Approved doctor receives valid JWT bearer token', !!doctorToken);

  // Verify status is now approved via /auth/me
  const docMe = await request('/auth/me', { token: doctorToken });
  assert('Doctor status confirmed as "approved" via /auth/me', docMe.data?.user?.status === 'approved', docMe.data);

  // --- STAGE 4: Patient Login & Doctor Directory Verification ---
  console.log('\n--- Stage 4: Patient Login & Doctor Directory Verification ---');
  const patientLogin = await request('/auth/login', {
    method: 'POST',
    json: { email: 'patient@demo.local', password: 'Patient1234!' },
  });
  assert('Patient login successful (HTTP 200)', patientLogin.status === 200, patientLogin.data);
  const patientToken = patientLogin.data?.token;

  const directoryRes = await request('/doctors', { token: patientToken });
  assert('Doctors directory query succeeds (HTTP 200)', directoryRes.status === 200, directoryRes.data);
  const foundDoctor = directoryRes.data?.doctors?.find(
    (d) => d.walletAddress?.toLowerCase() === docWallet?.toLowerCase()
  );
  assert('Approved doctor appears in Patient Doctors Directory', !!foundDoctor, directoryRes.data);

  // --- STAGE 5: Patient Uploads Healthcare Record ---
  console.log('\n--- Stage 5: Patient Record Upload (Encryption & Anchoring) ---');
  const medicalReport = `CLINICAL LAB REPORT [Phase L Rehearsal ${timestamp}]\nPatient: Riya Sharma\nStatus: Normal\nVerified: Yes`;
  const boundary = `----WebKitFormBoundary${Math.random().toString(16).slice(2)}`;
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="label"\r\n\r\nCardio Lab Panel ${timestamp}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="lab-report.txt"\r\nContent-Type: text/plain\r\n\r\n`),
    Buffer.from(medicalReport),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await request('/records/upload', {
    method: 'POST',
    token: patientToken,
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: multipartBody,
  });
  assert('Patient record upload succeeds (HTTP 200)', uploadRes.status === 200, uploadRes.data);
  const recordId = uploadRes.data?.recordId;
  const ipfsCid = uploadRes.data?.cid;
  const uploadTxHash = uploadRes.data?.txHash;
  assert('Record ID returned as string', typeof recordId === 'string' && recordId.length > 0, recordId);
  assert('IPFS CID returned', typeof ipfsCid === 'string' && ipfsCid.length > 0, ipfsCid);
  assert('Ethereum transaction hash returned', typeof uploadTxHash === 'string' && uploadTxHash.startsWith('0x'), uploadTxHash);

  // --- STAGE 6: Pre-Grant Access Check by Doctor (Denied) ---
  console.log('\n--- Stage 6: Pre-Consent Doctor Check (Zero-Trust Denied) ---');
  const preCheck = await request(`/records/${recordId}/access-check`, { token: doctorToken });
  assert('Pre-grant access check reports authorized: false', preCheck.data?.authorized === false, preCheck.data);

  const preView = await request(`/records/${recordId}/view`, { token: doctorToken });
  assert('Pre-grant view attempt rejected with HTTP 403', preView.status === 403, preView.data);

  // --- STAGE 7: Patient Grants Consent to Doctor ---
  console.log('\n--- Stage 7: Patient Grants On-Chain Doctor Consent ---');
  const grantRes = await request(`/records/${recordId}/grant`, {
    method: 'POST',
    token: patientToken,
    json: { doctorAddress: docWallet },
  });
  assert('Patient grants access (HTTP 200, status: granted)', grantRes.status === 200 && grantRes.data?.status === 'granted', grantRes.data);
  const grantTxHash = grantRes.data?.txHash;
  assert('Grant transaction hash anchored on-chain', typeof grantTxHash === 'string' && grantTxHash.startsWith('0x'), grantTxHash);

  // --- STAGE 8: Doctor Verifies Access & Views Plaintext ---
  console.log('\n--- Stage 8: Doctor Decrypts & Views Plaintext Record ---');
  const postGrantCheck = await request(`/records/${recordId}/access-check`, { token: doctorToken });
  assert('Post-grant access check reports authorized: true', postGrantCheck.data?.authorized === true, postGrantCheck.data);

  const viewRes = await request(`/records/${recordId}/view`, { token: doctorToken });
  assert('Doctor successfully retrieves record (HTTP 200)', viewRes.status === 200, viewRes.data);
  assert('Decrypted plaintext matches uploaded record exactly', viewRes.data?.content === medicalReport, viewRes.data?.content);

  // --- STAGE 9: Patient Revokes Consent ---
  console.log('\n--- Stage 9: Patient Revokes On-Chain Doctor Consent ---');
  const revokeRes = await request(`/records/${recordId}/revoke`, {
    method: 'POST',
    token: patientToken,
    json: { doctorAddress: docWallet },
  });
  assert('Patient revokes access (HTTP 200, status: revoked)', revokeRes.status === 200 && revokeRes.data?.status === 'revoked', revokeRes.data);
  const revokeTxHash = revokeRes.data?.txHash;
  assert('Revoke transaction hash anchored on-chain', typeof revokeTxHash === 'string' && revokeTxHash.startsWith('0x'), revokeTxHash);

  // --- STAGE 10: Doctor Access Denied Post-Revocation ---
  console.log('\n--- Stage 10: Doctor Access Denied Post-Revocation ---');
  const postRevokeCheck = await request(`/records/${recordId}/access-check`, { token: doctorToken });
  assert('Post-revoke access check reports authorized: false', postRevokeCheck.data?.authorized === false, postRevokeCheck.data);

  const postRevokeView = await request(`/records/${recordId}/view`, { token: doctorToken });
  assert('Post-revoke view attempt rejected with HTTP 403', postRevokeView.status === 403 && postRevokeView.data?.error === 'ACCESS_DENIED', postRevokeView.data);

  // --- SUMMARY ---
  console.log('\n======================================================');
  console.log(`  Rehearsal Complete: ${passCount} Passed, ${failCount} Failed`);
  console.log('======================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runRehearsal().catch((err) => {
  console.error('Fatal Rehearsal Error:', err);
  process.exit(1);
});
