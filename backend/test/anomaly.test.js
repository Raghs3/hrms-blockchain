"use strict";
// Pure unit tests for the receipt anomaly rules: no chain needed.
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { detectAnomalies, resolveOptions, isOffHours } = require("../src/anomaly");

const DOC_A = "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa";
const DOC_B = "0xBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBbBb";
const P1 = "0x1111111111111111111111111111111111111111";
const P2 = "0x2222222222222222222222222222222222222222";
const P3 = "0x3333333333333333333333333333333333333333";
const P4 = "0x4444444444444444444444444444444444444444";

// 2026-11-18 at 10:00 IST (UTC+5:30) = 04:30Z: a normal working hour.
const T0 = Date.parse("2026-11-18T04:30:00Z");
let n = 0;
const receipt = (over = {}) => ({
  recordId: String(over.recordId ?? ++n),
  owner: P1,
  ownerName: "Patient One",
  accessor: DOC_A,
  accessorName: "Dr. Kapoor",
  selfAccess: false,
  timestamp: new Date(T0).toISOString(),
  txHash: `0x${String(++n).padStart(64, "0")}`,
  ...over,
});
const at = (minutes) => new Date(T0 + minutes * 60000).toISOString();
const rules = (res) => res.findings.map((f) => f.rule).sort();

describe("anomaly rules", () => {
  test("ordinary activity raises nothing", () => {
    const res = detectAnomalies([
      receipt({ recordId: "1", timestamp: at(0) }),
      receipt({ recordId: "2", timestamp: at(30) }),
      receipt({ recordId: "3", timestamp: at(120) }),
    ]);
    assert.deepEqual(res.findings, []);
    assert.equal(res.considered, 3);
  });

  test("empty input is fine", () => {
    assert.deepEqual(detectAnomalies([]).findings, []);
  });

  describe("OFF_HOURS", () => {
    test("flags a 03:00 IST read and one at 22:30 IST, not 10:00", () => {
      const res = detectAnomalies([
        receipt({ recordId: "1", timestamp: "2026-11-17T21:30:00Z" }), // 03:00 IST
        receipt({ recordId: "2", timestamp: "2026-11-18T17:00:00Z" }), // 22:30 IST
        receipt({ recordId: "3", timestamp: at(0) }), // 10:00 IST
      ]);
      assert.deepEqual(rules(res), ["OFF_HOURS"]);
      assert.equal(res.findings[0].count, 2);
      assert.equal(res.findings[0].severity, "medium");
      assert.deepEqual(res.findings[0].recordIds.sort(), ["1", "2"]);
    });

    test("working-window boundaries: 07:00 is fine, 06:59 is not, 21:00 is not", () => {
      const o = resolveOptions();
      assert.equal(isOffHours("2026-11-18T01:30:00Z", o), false); // 07:00 IST
      assert.equal(isOffHours("2026-11-18T01:29:00Z", o), true); // 06:59 IST
      assert.equal(isOffHours("2026-11-18T15:29:00Z", o), false); // 20:59 IST
      assert.equal(isOffHours("2026-11-18T15:30:00Z", o), true); // 21:00 IST
    });

    test("the time zone is configurable", () => {
      // 04:30Z is 10:00 IST (fine) but 04:30 UTC (off-hours)
      const r = [receipt({ timestamp: at(0) })];
      assert.equal(detectAnomalies(r).findings.length, 0);
      assert.deepEqual(rules(detectAnomalies(r, { utcOffsetMinutes: 0 })), ["OFF_HOURS"]);
    });
  });

  describe("BURST", () => {
    const burst = (count, gapMinutes) =>
      Array.from({ length: count }, (_, i) => receipt({ recordId: String(100 + i), timestamp: at(i * gapMinutes) }));

    test("5 different records in 4 minutes is a burst", () => {
      const res = detectAnomalies(burst(5, 1));
      assert.ok(rules(res).includes("BURST"));
      const f = res.findings.find((x) => x.rule === "BURST");
      assert.equal(f.severity, "high");
      assert.equal(f.recordIds.length, 5);
      assert.match(f.summary, /5 different records/);
    });

    test("4 records is below the threshold", () => {
      assert.ok(!rules(detectAnomalies(burst(4, 1))).includes("BURST"));
    });

    test("5 records spread over an hour is not a burst", () => {
      assert.ok(!rules(detectAnomalies(burst(5, 15))).includes("BURST"));
    });

    test("opening the SAME record repeatedly is not a burst of different records", () => {
      const same = Array.from({ length: 8 }, (_, i) => receipt({ recordId: "7", timestamp: at(i) }));
      assert.ok(!rules(detectAnomalies(same)).includes("BURST"));
    });

    test("one cluster is reported once, not once per extra read", () => {
      const res = detectAnomalies(burst(9, 0.5));
      const bursts = res.findings.filter((f) => f.rule === "BURST");
      assert.equal(bursts.length, 1);
    });

    test("thresholds are configurable", () => {
      assert.ok(rules(detectAnomalies(burst(3, 1), { burstRecords: 3 })).includes("BURST"));
    });
  });

  describe("WIDE_REACH", () => {
    test("records of 3 different patients within an hour is flagged", () => {
      const res = detectAnomalies([
        receipt({ recordId: "1", owner: P1, timestamp: at(0) }),
        receipt({ recordId: "2", owner: P2, timestamp: at(20) }),
        receipt({ recordId: "3", owner: P3, timestamp: at(40) }),
      ]);
      assert.deepEqual(rules(res), ["WIDE_REACH"]);
      assert.equal(res.findings[0].severity, "high");
    });

    test("3 patients over a whole day is normal", () => {
      const res = detectAnomalies([
        receipt({ recordId: "1", owner: P1, timestamp: at(0) }),
        receipt({ recordId: "2", owner: P2, timestamp: at(180) }),
        receipt({ recordId: "3", owner: P3, timestamp: at(360) }),
      ]);
      assert.deepEqual(res.findings, []);
    });

    test("many records of ONE patient is not wide reach", () => {
      const res = detectAnomalies([
        receipt({ recordId: "1", owner: P1, timestamp: at(0) }),
        receipt({ recordId: "2", owner: P1, timestamp: at(10) }),
        receipt({ recordId: "3", owner: P1, timestamp: at(20) }),
      ]);
      assert.deepEqual(res.findings, []);
    });
  });

  describe("scoping", () => {
    test("a patient opening their own records never counts", () => {
      const own = Array.from({ length: 10 }, (_, i) =>
        receipt({ recordId: String(200 + i), accessor: P1, owner: P1, selfAccess: true, timestamp: at(i) })
      );
      const res = detectAnomalies(own);
      assert.deepEqual(res.findings, []);
      assert.equal(res.considered, 0);
      assert.equal(res.scanned, 10);
    });

    test("doctors are judged separately: two doctors each below the threshold is fine", () => {
      const mixed = [
        ...Array.from({ length: 3 }, (_, i) => receipt({ recordId: `a${i}`, accessor: DOC_A, timestamp: at(i) })),
        ...Array.from({ length: 3 }, (_, i) => receipt({ recordId: `b${i}`, accessor: DOC_B, accessorName: "Dr. B", timestamp: at(i) })),
      ];
      assert.deepEqual(detectAnomalies(mixed).findings, []);
    });

    test("findings name the right doctor and high severity sorts before medium", () => {
      const res = detectAnomalies([
        receipt({ recordId: "1", accessor: DOC_B, accessorName: "Dr. B", timestamp: "2026-11-17T21:30:00Z" }), // off-hours
        ...Array.from({ length: 5 }, (_, i) => receipt({ recordId: `x${i}`, accessor: DOC_A, timestamp: at(i) })),
      ]);
      assert.equal(res.findings[0].rule, "BURST");
      assert.equal(res.findings[0].accessorName, "Dr. Kapoor");
      assert.equal(res.findings[res.findings.length - 1].rule, "OFF_HOURS");
      assert.equal(res.findings[res.findings.length - 1].accessorName, "Dr. B");
    });

    test("an unnamed doctor falls back to a shortened wallet", () => {
      const res = detectAnomalies([receipt({ accessorName: null, timestamp: "2026-11-17T21:30:00Z" })]);
      assert.match(res.findings[0].summary, /^0xAaAa\.\.\.AaAa/);
    });

    test("invalid threshold overrides are ignored", () => {
      const o = resolveOptions({ burstRecords: "abc", burstWindowMinutes: null });
      assert.equal(o.burstRecords, 5);
      assert.equal(o.burstWindowMinutes, 10);
    });
  });
});
