const express = require("express");
const multer = require("multer");
const { ethers } = require("ethers");
const { provider, recordRegistry, runAsWallet, ensureFunded } = require("./chain");
const {
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
} = require("./auth");
const { encrypt, decrypt, sha256Hex } = require("./crypto");
const { validateUploadedFile } = require("./fileValidator");
const ipfs = require("./ipfs");
const store = require("./store");
const { detectAnomalies } = require("./anomaly");

const router = express.Router();
// defParamCharset: multer decodes multipart filenames as latin1 by default, which turns
// "रिपोर्ट.pdf" or "café.pdf" into mojibake. Browsers send filenames as UTF-8.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  defParamCharset: "utf8",
});

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const CONTRACT_ERRORS = {
  NotAPatient: [403, "NOT_A_PATIENT"],
  NotADoctor: [400, "NOT_A_DOCTOR"],
  NotRecordOwner: [403, "NOT_RECORD_OWNER"],
  RecordDoesNotExist: [404, "RECORD_NOT_FOUND"],
  AccessDenied: [403, "ACCESS_DENIED"],
  ExpiryInPast: [400, "EXPIRY_IN_PAST"],
  PurposeRequired: [400, "PURPOSE_REQUIRED"],
  PurposeTooLong: [400, "PURPOSE_TOO_LONG"],
};

// Consent defaults used only when the client sends no purpose / expiry (older UI builds).
// The contract itself always requires a purpose.
const DEFAULT_PURPOSE = "General care";
const MAX_PURPOSE_BYTES = 128;

// ethers decodes custom errors for read calls (err.revert) but not for transactions:
// there the node's revert data only shows up as err.data, so decode it ourselves.
function revertName(err) {
  if (err?.revert?.name) return err.revert.name;
  const data = [err?.data, err?.info?.error?.data, err?.error?.data].find(
    (d) => typeof d === "string" && d.startsWith("0x") && d.length >= 10
  );
  if (!data) return null;
  try {
    return recordRegistry.interface.parseError(data)?.name ?? null;
  } catch {
    return null;
  }
}

function contractFailure(err) {
  if (err?.reason === "RecordRegistry: caller not authorized") return [403, "ACCESS_DENIED"];
  return CONTRACT_ERRORS[revertName(err)] || null;
}

function parseRecordId(req, res, next) {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: "RECORD_NOT_FOUND" });
  req.recordId = BigInt(req.params.id);
  next();
}

function requireDoctorAddress(req, res, next) {
  const { doctorAddress } = req.body || {};
  if (!ethers.isAddress(doctorAddress)) {
    return res.status(400).json({ error: "INVALID_ADDRESS", message: "doctorAddress must be a wallet address" });
  }
  req.doctorAddress = doctorAddress;
  next();
}

// Optional body fields: purpose (string) and expiresAt (ISO date string; null/omitted = until revoked).
function parseGrantTerms(req, res, next) {
  const { purpose, expiresAt } = req.body || {};
  let cleanPurpose = DEFAULT_PURPOSE;
  if (purpose !== undefined && purpose !== null && purpose !== "") {
    if (typeof purpose !== "string" || !purpose.trim()) {
      return res.status(400).json({ error: "PURPOSE_REQUIRED", message: "purpose must be a non-empty string" });
    }
    cleanPurpose = purpose.trim();
    if (Buffer.byteLength(cleanPurpose, "utf8") > MAX_PURPOSE_BYTES) {
      return res.status(400).json({ error: "PURPOSE_TOO_LONG", message: `purpose must be at most ${MAX_PURPOSE_BYTES} bytes` });
    }
  }
  let expiry = 0n;
  if (expiresAt !== undefined && expiresAt !== null && expiresAt !== "") {
    const ms = typeof expiresAt === "string" ? Date.parse(expiresAt) : NaN;
    if (Number.isNaN(ms)) {
      return res.status(400).json({ error: "INVALID_EXPIRY", message: "expiresAt must be an ISO date string or null" });
    }
    expiry = BigInt(Math.floor(ms / 1000));
  }
  req.grantPurpose = cleanPurpose;
  req.grantExpiry = expiry;
  next();
}

const expiryIso = (expiry) => (expiry > 0n ? new Date(Number(expiry) * 1000).toISOString() : null);
// The contract stores only keccak256(purpose); the readable text is in the AccessGranted event.
// Find the newest event for this record and doctor whose text hashes to the on-chain value, so a
// re-grant with a new reason shows the new reason, and a mismatching text is never shown.
function purposeFor(grantLogs, recordId, doctor, purposeHash) {
  for (let i = grantLogs.length - 1; i >= 0; i--) {
    const a = grantLogs[i].args;
    if (BigInt(a.recordId) !== BigInt(recordId)) continue;
    if (a.doctor.toLowerCase() !== doctor.toLowerCase()) continue;
    if (ethers.keccak256(ethers.toUtf8Bytes(a.purpose)) === purposeHash) return a.purpose;
  }
  return null;
}

const grantView = (g, purpose) => ({ purpose: purpose ?? null, expiresAt: expiryIso(g.expiry) });

// The contract can only answer "does X have access?", so rebuild the list of
// doctors from the AccessGranted event log and confirm each against the current state.
async function authorizedDoctors(recordId) {
  const grants = await recordRegistry.queryFilter(recordRegistry.filters.AccessGranted(recordId));
  const candidates = [...new Set(grants.map((e) => e.args.doctor))];
  const current = [];
  for (const doctor of candidates) {
    const grant = await recordRegistry.getGrant(recordId, doctor);
    if (grant.active) {
      const purpose = purposeFor(grants, recordId, doctor, grant.purposeHash);
      current.push({ walletAddress: doctor, name: store.getName(doctor), ...grantView(grant, purpose) });
    }
  }
  return current;
}

router.post("/auth/register", authLimiter, wrap(register));
router.post("/auth/login", authLimiter, wrap(login));
router.post("/auth/demo-login", authLimiter, wrap(demoLogin));
router.get("/auth/me", requireAuth(), (req, res) => me(req, res));
router.get("/doctors", requireAuth("patient", "doctor"), doctors);

// ── Admin routes ─────────────────────────────────────────────────────────────
router.get("/admin/pending-doctors", requireAuth("admin"), wrap(async (req, res) => {
  const pending = store.listPendingDoctors().map(sanitizeUser);
  res.json({ doctors: pending });
}));

// All practitioner accounts (pending, approved, rejected/disabled) for the admin roster.
router.get("/admin/doctors", requireAuth("admin"), wrap(async (req, res) => {
  res.json({ doctors: store.listDoctors().map(sanitizeUser) });
}));

// Every account for the admin "Users" pages; ?role=doctor|patient|admin narrows it.
// Patients also get recordCount (read from the chain; null if the node is unreachable).
router.get("/admin/users", requireAuth("admin"), wrap(async (req, res) => {
  const role = typeof req.query.role === "string" ? req.query.role : "";
  let accounts = store.listAccounts();
  if (role) accounts = accounts.filter((a) => a.role === role);
  const users = await Promise.all(
    accounts.map(async (account) => {
      const user = sanitizeUser(account);
      if (account.role === "patient") {
        try {
          user.recordCount = (await recordRegistry.getRecordsByOwner(account.walletAddress)).length;
        } catch {
          user.recordCount = null;
        }
      }
      return user;
    })
  );
  res.json({ users });
}));

router.post("/admin/doctors/:id/approve", requireAuth("admin"), wrap(async (req, res) => {
  try {
    const { account } = await approveDoctor(req.params.id);
    res.json({ status: "approved", doctor: sanitizeUser(account) });
  } catch (err) {
    if (err.code === "DOCTOR_NOT_FOUND") {
      return res.status(404).json({ error: "DOCTOR_NOT_FOUND", message: err.message });
    }
    if (err.code === "NOT_A_DOCTOR") {
      return res.status(400).json({ error: "NOT_A_DOCTOR", message: err.message });
    }
    throw err;
  }
}));

router.post("/admin/doctors/:id/reject", requireAuth("admin"), wrap(async (req, res) => {
  try {
    const { account } = await rejectDoctor(req.params.id);
    res.json({ status: "rejected", doctor: sanitizeUser(account) });
  } catch (err) {
    if (err.code === "DOCTOR_NOT_FOUND") {
      return res.status(404).json({ error: "DOCTOR_NOT_FOUND", message: err.message });
    }
    if (err.code === "NOT_A_DOCTOR") {
      return res.status(400).json({ error: "NOT_A_DOCTOR", message: err.message });
    }
    throw err;
  }
}));

router.post("/records/upload", requireAuth("patient"), upload.single("file"), wrap(async (req, res) => {
  const validation = validateUploadedFile(req.file);
  if (!validation.valid) {
    return res.status(validation.status || 400).json({
      error: validation.error,
      message: validation.message,
    });
  }

  const { mimeType, originalFileName, sizeBytes } = validation;
  const plaintext = req.file.buffer;
  const fileHash = sha256Hex(plaintext);
  const cid = await ipfs.pin(encrypt(plaintext), originalFileName);

  const { tx, receipt } = await runAsWallet(req.wallet, async () => {
    const sent = await recordRegistry.connect(req.wallet).addRecord(cid, fileHash);
    return { tx: sent, receipt: await sent.wait() };
  });
  const added = receipt.logs
    .map((log) => recordRegistry.interface.parseLog(log))
    .find((parsed) => parsed?.name === "RecordAdded");
  const recordId = added.args.recordId.toString();

  store.setLabel(recordId, (req.body.label || "").trim() || originalFileName);
  store.setRecordMetadata(recordId, {
    mimeType,
    originalFileName,
    sizeBytes,
  });

  res.json({
    recordId,
    cid,
    txHash: tx.hash,
    uploadedAt: new Date(Number(added.args.timestamp) * 1000).toISOString(),
    mimeType,
    originalFileName,
    sizeBytes,
  });
}));

router.get("/records/mine", requireAuth("patient"), wrap(async (req, res) => {
  const ids = await recordRegistry.getRecordsByOwner(req.wallet.address);
  const asOwner = recordRegistry.connect(req.wallet);
  const records = [];
  for (const id of ids) {
    const record = await asOwner.getRecord(id);
    const meta = store.getRecordMetadata(id.toString());
    records.push({
      recordId: id.toString(),
      label: store.getLabel(id.toString()),
      uploadedAt: new Date(Number(record.timestamp) * 1000).toISOString(),
      authorizedDoctors: await authorizedDoctors(id),
      cid: record.cid,
      fileHash: record.fileHash,
      mimeType: meta.mimeType || "text/plain",
      originalFileName: meta.originalFileName || null,
      sizeBytes: meta.sizeBytes ?? null,
    });
  }
  res.json(records);
}));

router.get("/records/shared-with-me", requireAuth("doctor"), wrap(async (req, res) => {
  try {
    const doctorAddress = req.wallet.address;
    const filter = recordRegistry.filters.AccessGranted(null, null, doctorAddress);
    const grants = await recordRegistry.queryFilter(filter);
    const candidateIds = [...new Set(grants.map((e) => e.args.recordId))];
    const records = [];
    const asDoctor = recordRegistry.connect(req.wallet);

    for (const id of candidateIds) {
      const grant = await recordRegistry.getGrant(id, doctorAddress);
      if (grant.active) {
        const record = await asDoctor.getRecord(id);
        const meta = store.getRecordMetadata(id.toString());
        records.push({
          recordId: id.toString(),
          owner: record.owner,
          ownerName: store.getName(record.owner),
          ...grantView(grant, purposeFor(grants, id, doctorAddress, grant.purposeHash)),
          label: store.getLabel(id.toString()),
          uploadedAt: new Date(Number(record.timestamp) * 1000).toISOString(),
          cid: record.cid,
          fileHash: record.fileHash,
          mimeType: meta.mimeType || "text/plain",
          originalFileName: meta.originalFileName || null,
          sizeBytes: meta.sizeBytes ?? null,
        });
      }
    }

    records.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json(records);
  } catch (err) {
    if (err?.code === "NETWORK_ERROR" || err?.code === "SERVER_ERROR") {
      return res.status(503).json({ error: "RPC_ERROR", message: "Blockchain RPC node unavailable" });
    }
    throw err;
  }
}));

router.post("/records/:id/grant", requireAuth("patient"), parseRecordId, requireDoctorAddress, parseGrantTerms, wrap(async (req, res) => {
  const tx = await runAsWallet(req.wallet, async () => {
    const sent = await recordRegistry
      .connect(req.wallet)
      .grantAccess(req.recordId, req.doctorAddress, req.grantExpiry, req.grantPurpose);
    await sent.wait();
    return sent;
  });
  res.json({ txHash: tx.hash, status: "granted", purpose: req.grantPurpose, expiresAt: expiryIso(req.grantExpiry) });
}));

router.post("/records/:id/revoke", requireAuth("patient"), parseRecordId, requireDoctorAddress, wrap(async (req, res) => {
  const tx = await runAsWallet(req.wallet, async () => {
    const sent = await recordRegistry.connect(req.wallet).revokeAccess(req.recordId, req.doctorAddress);
    await sent.wait();
    return sent;
  });
  res.json({ txHash: tx.hash, status: "revoked" });
}));

router.get("/records/:id/access-check", requireAuth(), parseRecordId, wrap(async (req, res) => {
  try {
    const authorized = await recordRegistry.checkAccess(req.wallet.address, req.recordId);
    res.json({ authorized });
  } catch (err) {
    if (revertName(err) === "RecordDoesNotExist") return res.json({ authorized: false });
    throw err;
  }
}));

// Log-before-release. Order of operations:
//   1. getRecord from the caller's own wallet: the contract refuses anyone without a live
//      grant (a free call, so a denied request costs no gas and writes nothing).
//   2. fetch + decrypt + verify the hash. Nothing has left the server yet.
//   3. recordAccess(): a transaction from the caller's wallet, awaited until mined. It reverts
//      unless the caller is the owner or holds a live grant, and emits AccessReceipt.
//   4. only now is the content returned, together with the receipt's tx hash.
// If step 3 fails, no content is released, so no read is ever unlogged.
router.get("/records/:id/view", requireAuth(), parseRecordId, wrap(async (req, res) => {
  const asCaller = recordRegistry.connect(req.wallet);
  const record = await asCaller.getRecord(req.recordId);
  const plaintext = decrypt(await ipfs.fetchByCid(record.cid));
  if (sha256Hex(plaintext) !== record.fileHash) {
    return res.status(500).json({ error: "INTEGRITY_CHECK_FAILED" });
  }

  await ensureFunded(req.wallet);
  const { sent, mined } = await runAsWallet(req.wallet, async () => {
    const tx = await asCaller.recordAccess(req.recordId);
    return { sent: tx, mined: await tx.wait() };
  });
  const receiptLog = mined.logs
    .map((log) => {
      try {
        return recordRegistry.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.name === "AccessReceipt");

  const recordIdStr = req.recordId.toString();
  const meta = store.getRecordMetadata(recordIdStr);
  const isText = !meta.mimeType || meta.mimeType === "text/plain";

  res.json({
    recordId: recordIdStr,
    owner: record.owner,
    label: store.getLabel(recordIdStr),
    fileHash: record.fileHash,
    cid: record.cid,
    content: isText ? plaintext.toString("utf8") : plaintext.toString("base64"),
    encoding: isText ? "utf8" : "base64",
    mimeType: meta.mimeType || "text/plain",
    originalFileName: meta.originalFileName || null,
    sizeBytes: meta.sizeBytes !== null ? meta.sizeBytes : plaintext.length,
    accessReceipt: {
      txHash: sent.hash,
      blockNumber: Number(mined.blockNumber),
      timestamp: receiptLog ? new Date(Number(receiptLog.args.timestamp) * 1000).toISOString() : null,
    },
  });
}));

// One on-chain AccessReceipt log -> the JSON shape shared by /access-receipts and /admin/anomalies.
function receiptView(log) {
  const recordId = log.args.recordId.toString();
  const { owner, accessor } = log.args;
  return {
    recordId,
    label: store.getLabel(recordId),
    owner,
    ownerName: store.getName(owner),
    accessor,
    accessorName: store.getName(accessor),
    selfAccess: owner.toLowerCase() === accessor.toLowerCase(),
    timestamp: new Date(Number(log.args.timestamp) * 1000).toISOString(),
    txHash: log.transactionHash,
    blockNumber: Number(log.blockNumber),
  };
}

// Who actually opened what. Patient: reads of their own records (by anyone; selfAccess marks
// their own views). Doctor: their own reads. Admin: everything. Every row is an on-chain
// AccessReceipt, so it carries a transaction hash. Optional ?recordId= filter.
router.get("/access-receipts", requireAuth(), wrap(async (req, res) => {
  const role = req.accountRecord?.role || req.user?.role;
  const address = req.wallet?.address;
  const f = recordRegistry.filters;
  const recordFilter = /^\d+$/.test(String(req.query.recordId ?? "")) ? BigInt(req.query.recordId) : null;

  let logs;
  try {
    if (role === "admin") logs = await recordRegistry.queryFilter(f.AccessReceipt(recordFilter));
    else if (role === "patient") logs = await recordRegistry.queryFilter(f.AccessReceipt(recordFilter, address));
    else if (role === "doctor") logs = await recordRegistry.queryFilter(f.AccessReceipt(recordFilter, null, address));
    else return res.status(403).json({ error: "WRONG_ROLE" });
  } catch (err) {
    if (err?.code === "NETWORK_ERROR" || err?.code === "SERVER_ERROR") {
      return res.status(503).json({ error: "RPC_ERROR", message: "Blockchain RPC node unavailable" });
    }
    throw err;
  }

  logs.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber) || Number(b.index ?? 0) - Number(a.index ?? 0));
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

  const receipts = logs.slice(offset, offset + limit).map(receiptView);
  res.json({ total: logs.length, limit, offset, receipts });
}));

// Rule-based alerts over every receipt (see anomaly.js). Thresholds default sensibly and can be
// set with ANOMALY_* env vars (e.g. ANOMALY_UTC_OFFSET_MINUTES for the hospital's time zone).
router.get("/admin/anomalies", requireAuth("admin"), wrap(async (req, res) => {
  let logs;
  try {
    logs = await recordRegistry.queryFilter(recordRegistry.filters.AccessReceipt());
  } catch (err) {
    if (err?.code === "NETWORK_ERROR" || err?.code === "SERVER_ERROR") {
      return res.status(503).json({ error: "RPC_ERROR", message: "Blockchain RPC node unavailable" });
    }
    throw err;
  }
  const env = process.env;
  res.json(
    detectAnomalies(logs.map(receiptView), {
      utcOffsetMinutes: env.ANOMALY_UTC_OFFSET_MINUTES,
      workStartHour: env.ANOMALY_WORK_START_HOUR,
      workEndHour: env.ANOMALY_WORK_END_HOUR,
      burstRecords: env.ANOMALY_BURST_RECORDS,
      burstWindowMinutes: env.ANOMALY_BURST_WINDOW_MINUTES,
      wideReachPatients: env.ANOMALY_WIDE_REACH_PATIENTS,
      wideReachWindowMinutes: env.ANOMALY_WIDE_REACH_WINDOW_MINUTES,
    })
  );
}));

async function getBlockTimestamp(blockNumber, cache) {
  if (!blockNumber) return new Date().toISOString();
  if (cache.has(blockNumber)) return cache.get(blockNumber);
  const promise = (async () => {
    try {
      const block = await provider.getBlock(blockNumber);
      if (block?.timestamp) {
        return new Date(Number(block.timestamp) * 1000).toISOString();
      }
    } catch {
      // fallback
    }
    return new Date().toISOString();
  })();
  cache.set(blockNumber, promise);
  return promise;
}

router.get("/audit-trail", requireAuth(), wrap(async (req, res) => {
  const userRole = req.accountRecord?.role || req.user?.role;
  const userAddress = req.wallet?.address;
  const blockCache = new Map();
  const rawEvents = [];

  try {
    if (userRole === "admin") {
      const [added, granted, revoked] = await Promise.all([
        recordRegistry.queryFilter(recordRegistry.filters.RecordAdded()),
        recordRegistry.queryFilter(recordRegistry.filters.AccessGranted()),
        recordRegistry.queryFilter(recordRegistry.filters.AccessRevoked()),
      ]);
      rawEvents.push(
        ...added.map((log) => ({ log, type: "RECORD_ADDED", eventName: "RecordAdded" })),
        ...granted.map((log) => ({ log, type: "ACCESS_GRANTED", eventName: "AccessGranted" })),
        ...revoked.map((log) => ({ log, type: "ACCESS_REVOKED", eventName: "AccessRevoked" }))
      );
    } else if (userRole === "patient") {
      const [added, granted, revoked] = await Promise.all([
        recordRegistry.queryFilter(recordRegistry.filters.RecordAdded(null, userAddress)),
        recordRegistry.queryFilter(recordRegistry.filters.AccessGranted(null, userAddress)),
        recordRegistry.queryFilter(recordRegistry.filters.AccessRevoked(null, userAddress)),
      ]);
      rawEvents.push(
        ...added.map((log) => ({ log, type: "RECORD_ADDED", eventName: "RecordAdded" })),
        ...granted.map((log) => ({ log, type: "ACCESS_GRANTED", eventName: "AccessGranted" })),
        ...revoked.map((log) => ({ log, type: "ACCESS_REVOKED", eventName: "AccessRevoked" }))
      );
    } else if (userRole === "doctor") {
      const [granted, revoked] = await Promise.all([
        recordRegistry.queryFilter(recordRegistry.filters.AccessGranted(null, null, userAddress)),
        recordRegistry.queryFilter(recordRegistry.filters.AccessRevoked(null, null, userAddress)),
      ]);
      rawEvents.push(
        ...granted.map((log) => ({ log, type: "ACCESS_GRANTED", eventName: "AccessGranted" })),
        ...revoked.map((log) => ({ log, type: "ACCESS_REVOKED", eventName: "AccessRevoked" }))
      );
    } else {
      return res.status(403).json({ error: "WRONG_ROLE" });
    }

    rawEvents.sort((a, b) => {
      const blockDiff = Number(b.log.blockNumber) - Number(a.log.blockNumber);
      if (blockDiff !== 0) return blockDiff;
      return Number(b.log.index ?? 0) - Number(a.log.index ?? 0);
    });

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const total = rawEvents.length;
    const pageSlice = rawEvents.slice(offset, offset + limit);

    const events = await Promise.all(
      pageSlice.map(async ({ log, type, eventName }) => {
        const args = log.args || {};
        const recordId = args.recordId ? args.recordId.toString() : null;
        let timestamp;
        if (args.timestamp) {
          timestamp = new Date(Number(args.timestamp) * 1000).toISOString();
        } else {
          timestamp = await getBlockTimestamp(log.blockNumber, blockCache);
        }

        const meta = recordId ? store.getRecordMetadata(recordId) : null;

        return {
          type,
          eventName,
          recordId,
          label: recordId ? store.getLabel(recordId) : null,
          owner: args.owner || null,
          ownerName: args.owner ? store.getName(args.owner) : null,
          doctor: args.doctor || null,
          doctorName: args.doctor ? store.getName(args.doctor) : null,
          purpose: eventName === "AccessGranted" ? args.purpose || null : null,
          expiresAt: eventName === "AccessGranted" ? expiryIso(args.expiry) : null,
          cid: args.cid || null,
          fileHash: args.fileHash || null,
          mimeType: meta ? meta.mimeType : null,
          originalFileName: meta ? meta.originalFileName : null,
          sizeBytes: meta ? meta.sizeBytes : null,
          txHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
          timestamp,
        };
      })
    );

    res.json({ total, limit, offset, events });
  } catch (err) {
    if (err?.code === "NETWORK_ERROR" || err?.code === "SERVER_ERROR") {
      return res.status(503).json({ error: "RPC_ERROR", message: "Blockchain RPC node unavailable" });
    }
    throw err;
  }
}));

router.use((err, req, res, next) => {
  const known = contractFailure(err);
  if (known) return res.status(known[0]).json({ error: known[1] });
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit" });
    }
    return res.status(400).json({ error: "UPLOAD_ERROR", message: err.message });
  }
  console.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR", message: err.shortMessage || err.message });
});

module.exports = router;
