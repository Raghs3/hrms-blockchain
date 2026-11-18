"use strict";
// Rule-based anomaly detection over the on-chain access receipts.
//
// This is deliberately NOT machine learning: three transparent rules with explicit
// thresholds, so every alert can be explained to an admin ("opened 6 different records
// in 4 minutes") and tested exactly. The receipts themselves are tamper-proof (written
// on-chain before any read is released), which is what makes the rules trustworthy.
//
// Only reads by someone other than the record owner are considered: a patient opening
// their own record is never suspicious.
//
// Rules (per accessor):
//   OFF_HOURS   opened records outside the working window (local time, see utcOffsetMinutes)
//   BURST       opened >= burstRecords DIFFERENT records within burstWindowMinutes
//   WIDE_REACH  opened records of >= wideReachPatients DIFFERENT patients within wideReachWindowMinutes

const DEFAULTS = {
  workStartHour: 7, // reads before 07:00 local are off-hours
  workEndHour: 21, // reads from 21:00 local are off-hours
  utcOffsetMinutes: 330, // local time zone of the hospital (default IST, UTC+5:30)
  burstRecords: 5,
  burstWindowMinutes: 10,
  wideReachPatients: 3,
  wideReachWindowMinutes: 60,
};

function resolveOptions(overrides = {}) {
  const o = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    const v = overrides[key];
    if (v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v))) o[key] = Number(v);
  }
  return o;
}

/** Hour of day (0-23) of an ISO timestamp in the hospital's local time. */
function localHour(iso, utcOffsetMinutes) {
  const ms = new Date(iso).getTime() + utcOffsetMinutes * 60 * 1000;
  return new Date(ms).getUTCHours();
}

function isOffHours(iso, opts) {
  const h = localHour(iso, opts.utcOffsetMinutes);
  return h < opts.workStartHour || h >= opts.workEndHour;
}

const who = (r) => r.accessorName || `${r.accessor.slice(0, 6)}...${r.accessor.slice(-4)}`;

/**
 * Finds the non-overlapping time windows in which one accessor touched at least `threshold`
 * different values of `keyOf(receipt)`. Receipts must be sorted by time ascending.
 * Returns an array of receipt arrays (one per window found).
 */
function slidingWindows(sorted, windowMs, threshold, keyOf) {
  const windows = [];
  let start = 0;
  const counts = new Map();
  const add = (r) => counts.set(keyOf(r), (counts.get(keyOf(r)) || 0) + 1);
  const remove = (r) => {
    const k = keyOf(r);
    const c = counts.get(k) - 1;
    if (c <= 0) counts.delete(k);
    else counts.set(k, c);
  };

  for (let end = 0; end < sorted.length; end++) {
    add(sorted[end]);
    const endMs = new Date(sorted[end].timestamp).getTime();
    while (endMs - new Date(sorted[start].timestamp).getTime() > windowMs) {
      remove(sorted[start]);
      start++;
    }
    if (counts.size >= threshold) {
      windows.push(sorted.slice(start, end + 1));
      // report this cluster once: restart counting after it
      counts.clear();
      start = end + 1;
    }
  }
  return windows;
}

const span = (rs) => ({ firstAt: rs[0].timestamp, lastAt: rs[rs.length - 1].timestamp });
const minutesBetween = (rs) =>
  Math.max(1, Math.round((new Date(rs[rs.length - 1].timestamp) - new Date(rs[0].timestamp)) / 60000));

/**
 * @param {Array<{recordId:string, owner:string, ownerName?:string, accessor:string, accessorName?:string,
 *                selfAccess?:boolean, timestamp:string, txHash:string}>} receipts
 * @param {object} [overrides] thresholds, see DEFAULTS
 * @returns {{ options: object, scanned: number, considered: number, findings: Array<object> }}
 */
function detectAnomalies(receipts, overrides = {}) {
  const opts = resolveOptions(overrides);
  const others = receipts.filter((r) => !r.selfAccess && r.accessor && r.timestamp);

  const byAccessor = new Map();
  for (const r of others) {
    const k = r.accessor.toLowerCase();
    if (!byAccessor.has(k)) byAccessor.set(k, []);
    byAccessor.get(k).push(r);
  }

  const findings = [];
  for (const list of byAccessor.values()) {
    const sorted = [...list].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const name = who(sorted[0]);
    const base = { accessor: sorted[0].accessor, accessorName: sorted[0].accessorName || null };

    const off = sorted.filter((r) => isOffHours(r.timestamp, opts));
    if (off.length > 0) {
      findings.push({
        ...base,
        rule: "OFF_HOURS",
        severity: "medium",
        summary: `${name} opened ${off.length} record${off.length > 1 ? "s" : ""} outside working hours (${String(opts.workStartHour).padStart(2, "0")}:00-${String(opts.workEndHour).padStart(2, "0")}:00)`,
        count: off.length,
        ...span(off),
        recordIds: [...new Set(off.map((r) => r.recordId))],
        txHashes: off.map((r) => r.txHash),
      });
    }

    for (const w of slidingWindows(sorted, opts.burstWindowMinutes * 60000, opts.burstRecords, (r) => r.recordId)) {
      const distinct = new Set(w.map((r) => r.recordId)).size;
      findings.push({
        ...base,
        rule: "BURST",
        severity: "high",
        summary: `${name} opened ${distinct} different records in ${minutesBetween(w)} minute${minutesBetween(w) > 1 ? "s" : ""}`,
        count: w.length,
        ...span(w),
        recordIds: [...new Set(w.map((r) => r.recordId))],
        txHashes: w.map((r) => r.txHash),
      });
    }

    for (const w of slidingWindows(sorted, opts.wideReachWindowMinutes * 60000, opts.wideReachPatients, (r) => r.owner.toLowerCase())) {
      const patients = new Set(w.map((r) => r.owner.toLowerCase())).size;
      findings.push({
        ...base,
        rule: "WIDE_REACH",
        severity: "high",
        summary: `${name} opened records of ${patients} different patients within ${minutesBetween(w)} minute${minutesBetween(w) > 1 ? "s" : ""}`,
        count: w.length,
        ...span(w),
        recordIds: [...new Set(w.map((r) => r.recordId))],
        txHashes: w.map((r) => r.txHash),
      });
    }
  }

  const rank = { high: 0, medium: 1 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity] || new Date(b.lastAt) - new Date(a.lastAt));
  return { options: opts, scanned: receipts.length, considered: others.length, findings };
}

module.exports = { detectAnomalies, resolveOptions, DEFAULTS, isOffHours };
