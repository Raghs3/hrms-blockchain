const fs = require("fs");
const path = require("path");

// Off-chain index for non-sensitive convenience data the contract does not hold:
// record labels, wallet-address -> display-name lookups, and accounts.
const file = path.join(__dirname, "..", "data", "store.json");

let data = { labels: {}, names: {}, accounts: [], metadata: {} };

function load() {
  try {
    const loaded = JSON.parse(fs.readFileSync(file, "utf8"));
    data = Object.assign({ labels: {}, names: {}, accounts: [], metadata: {} }, loaded);
    if (!data.metadata) data.metadata = {};
  } catch {
    // first run: start empty
  }
  return data;
}

load();

function save() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  setLabel(recordId, label) {
    load();
    data.labels[recordId] = label;
    save();
  },
  getLabel(recordId) {
    load();
    return data.labels[recordId] || `Record ${recordId}`;
  },
  setName(address, name) {
    load();
    data.names[address.toLowerCase()] = name;
    save();
  },
  getName(address) {
    load();
    return data.names[address.toLowerCase()] || "Unknown";
  },

  // ── Record Metadata ───────────────────────────────────────────────────────
  // shape: { mimeType, originalFileName, sizeBytes }
  setRecordMetadata(recordId, meta) {
    load();
    if (!data.metadata) data.metadata = {};
    data.metadata[recordId] = {
      mimeType: meta?.mimeType || "text/plain",
      originalFileName: meta?.originalFileName || null,
      sizeBytes: typeof meta?.sizeBytes === "number" ? meta.sizeBytes : null,
    };
    save();
  },
  getRecordMetadata(recordId) {
    load();
    const meta = data.metadata?.[recordId];
    if (meta) {
      return {
        mimeType: meta.mimeType || "text/plain",
        originalFileName: meta.originalFileName || null,
        sizeBytes: typeof meta.sizeBytes === "number" ? meta.sizeBytes : null,
      };
    }
    return {
      mimeType: "text/plain",
      originalFileName: null,
      sizeBytes: null,
    };
  },

  // ── Account CRUD ──────────────────────────────────────────────────────────
  // account shape: { id, name, email, passwordHash, role, status, createdAt }
  createAccount(account) {
    load();
    data.accounts.push(account);
    save();
    return account;
  },
  findAccountByEmail(email) {
    load();
    return data.accounts.find((a) => a.email === email.toLowerCase()) || null;
  },
  findAccountById(id) {
    load();
    return data.accounts.find((a) => a.id === id) || null;
  },
  updateAccount(id, patch) {
    load();
    const idx = data.accounts.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    data.accounts[idx] = Object.assign({}, data.accounts[idx], patch);
    save();
    return data.accounts[idx];
  },
  listApprovedDoctors() {
    load();
    return data.accounts.filter((a) => a.role === "doctor" && a.status === "approved");
  },
  // Every account (admin, doctors, patients), for the admin users pages.
  listAccounts() {
    load();
    return data.accounts.slice();
  },
  // Every doctor account whatever its status, for the admin roster.
  listDoctors() {
    load();
    return data.accounts.filter((a) => a.role === "doctor");
  },
  listPendingDoctors() {
    load();
    return data.accounts.filter((a) => a.role === "doctor" && a.status === "pending");
  },
};
