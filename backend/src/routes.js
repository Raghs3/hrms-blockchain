const express = require("express");
const multer = require("multer");
const { ethers } = require("ethers");
const { provider, recordRegistry } = require("./chain");
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

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

const CONTRACT_ERRORS = {
  NotAPatient: [403, "NOT_A_PATIENT"],
  NotADoctor: [400, "NOT_A_DOCTOR"],
  NotRecordOwner: [403, "NOT_RECORD_OWNER"],
  RecordDoesNotExist: [404, "RECORD_NOT_FOUND"],
};

function contractFailure(err) {
  if (err?.reason === "RecordRegistry: caller not authorized") return [403, "ACCESS_DENIED"];
  return CONTRACT_ERRORS[err?.revert?.name] || null;
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

// The contract can only answer "does X have access?", so rebuild the list of
// doctors from the AccessGranted event log and confirm each against the current state.
async function authorizedDoctors(recordId) {
  const grants = await recordRegistry.queryFilter(recordRegistry.filters.AccessGranted(recordId));
  const candidates = [...new Set(grants.map((e) => e.args.doctor))];
  const current = [];
  for (const doctor of candidates) {
    if (await recordRegistry.checkAccess(doctor, recordId)) {
      current.push({ walletAddress: doctor, name: store.getName(doctor) });
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

  const tx = await recordRegistry.connect(req.wallet).addRecord(cid, fileHash);
  const receipt = await tx.wait();
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
    records.push({
      recordId: id.toString(),
      label: store.getLabel(id.toString()),
      uploadedAt: new Date(Number(record.timestamp) * 1000).toISOString(),
      authorizedDoctors: await authorizedDoctors(id),
      cid: record.cid,
      fileHash: record.fileHash,
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
      const hasAccess = await recordRegistry.checkAccess(doctorAddress, id);
      if (hasAccess) {
        const record = await asDoctor.getRecord(id);
        records.push({
          recordId: id.toString(),
          owner: record.owner,
          ownerName: store.getName(record.owner),
          label: store.getLabel(id.toString()),
          uploadedAt: new Date(Number(record.timestamp) * 1000).toISOString(),
          cid: record.cid,
          fileHash: record.fileHash,
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

router.post("/records/:id/grant", requireAuth("patient"), parseRecordId, requireDoctorAddress, wrap(async (req, res) => {
  const tx = await recordRegistry.connect(req.wallet).grantAccess(req.recordId, req.doctorAddress);
  await tx.wait();
  res.json({ txHash: tx.hash, status: "granted" });
}));

router.post("/records/:id/revoke", requireAuth("patient"), parseRecordId, requireDoctorAddress, wrap(async (req, res) => {
  const tx = await recordRegistry.connect(req.wallet).revokeAccess(req.recordId, req.doctorAddress);
  await tx.wait();
  res.json({ txHash: tx.hash, status: "revoked" });
}));

router.get("/records/:id/access-check", requireAuth(), parseRecordId, wrap(async (req, res) => {
  try {
    const authorized = await recordRegistry.checkAccess(req.wallet.address, req.recordId);
    res.json({ authorized });
  } catch (err) {
    if (err?.revert?.name === "RecordDoesNotExist") return res.json({ authorized: false });
    throw err;
  }
}));

// The contract itself gates this call (getRecord reverts for anyone not authorized),
// so the backend cannot hand out a file the chain has not approved.
router.get("/records/:id/view", requireAuth(), parseRecordId, wrap(async (req, res) => {
  const record = await recordRegistry.connect(req.wallet).getRecord(req.recordId);
  const plaintext = decrypt(await ipfs.fetchByCid(record.cid));
  if (sha256Hex(plaintext) !== record.fileHash) {
    return res.status(500).json({ error: "INTEGRITY_CHECK_FAILED" });
  }
  res.json({
    recordId: req.recordId.toString(),
    owner: record.owner,
    label: store.getLabel(req.recordId.toString()),
    content: plaintext.toString("utf8"),
  });
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

        return {
          type,
          eventName,
          recordId,
          label: recordId ? store.getLabel(recordId) : null,
          owner: args.owner || null,
          ownerName: args.owner ? store.getName(args.owner) : null,
          doctor: args.doctor || null,
          doctorName: args.doctor ? store.getName(args.doctor) : null,
          cid: args.cid || null,
          fileHash: args.fileHash || null,
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
