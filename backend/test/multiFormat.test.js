"use strict";
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const app = require("../src/server");
const store = require("../src/store");
const { jwtSecret } = require("../src/config");
const { validateUploadedFile, checkMagicBytes } = require("../src/fileValidator");

describe("Multi-Format Record Support Test Suite (M1-M7)", () => {
  let server;
  let baseUrl;
  let patientToken;
  let doctorToken;
  let patientAccount;
  let doctorAccount;

  let uploadedPdfRecordId;
  let uploadedTxtRecordId;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    patientAccount = store.findAccountByEmail("patient@demo.local");
    if (!patientAccount) {
      patientAccount = store.createAccount({
        id: crypto.randomUUID(),
        name: "Test Patient",
        email: "test.patient@hospital.local",
        passwordHash: "hash",
        role: "patient",
        status: "approved",
        walletAddress: "0x9b696188431dbEF07f6F922e034cbA2ce3778Cfe",
        createdAt: new Date().toISOString(),
      });
    }

    doctorAccount = store.findAccountByEmail("doctor@demo.local");
    if (!doctorAccount) {
      doctorAccount = store.createAccount({
        id: crypto.randomUUID(),
        name: "Test Doctor",
        email: "test.doctor@hospital.local",
        passwordHash: "hash",
        role: "doctor",
        status: "approved",
        walletAddress: "0x37f07dD33bC2FA0547EdF131Cb224f6F8fC670D1",
        createdAt: new Date().toISOString(),
      });
    }

    patientToken = jwt.sign(
      { sub: patientAccount.id, name: patientAccount.name, role: patientAccount.role },
      jwtSecret,
      { expiresIn: "1h" }
    );

    doctorToken = jwt.sign(
      { sub: doctorAccount.id, name: doctorAccount.name, role: doctorAccount.role },
      jwtSecret,
      { expiresIn: "1h" }
    );
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ── 1. Unit Validation Tests ──────────────────────────────────────────────
  describe("fileValidator unit tests", () => {
    test("validates PDF magic bytes (%PDF)", () => {
      assert.strictEqual(checkMagicBytes(Buffer.from("%PDF-1.7 header"), ".pdf"), true);
      assert.strictEqual(checkMagicBytes(Buffer.from("NOTPDF"), ".pdf"), false);
    });

    test("validates PNG magic bytes (89 50 4E 47)", () => {
      assert.strictEqual(checkMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00]), ".png"), true);
      assert.strictEqual(checkMagicBytes(Buffer.from([0x00, 0x00, 0x00, 0x00]), ".png"), false);
    });

    test("validates JPEG magic bytes (FF D8 FF)", () => {
      assert.strictEqual(checkMagicBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), ".jpg"), true);
      assert.strictEqual(checkMagicBytes(Buffer.from([0xff, 0xd8, 0x00]), ".jpeg"), false);
    });

    test("validates DOC magic bytes (D0 CF 11 E0)", () => {
      assert.strictEqual(checkMagicBytes(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x12]), ".doc"), true);
      assert.strictEqual(checkMagicBytes(Buffer.from([0x00, 0x00, 0x00, 0x00]), ".doc"), false);
    });

    test("validates DOCX magic bytes (PK 03 04 and word/document.xml)", () => {
      const validDocx = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from("dummy zip data word/document.xml end"),
      ]);
      assert.strictEqual(checkMagicBytes(validDocx, ".docx"), true);

      const invalidDocx = Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from("dummy zip without xml"),
      ]);
      assert.strictEqual(checkMagicBytes(invalidDocx, ".docx"), false);
    });

    test("validates TXT (valid UTF-8 and no NUL bytes)", () => {
      assert.strictEqual(checkMagicBytes(Buffer.from("Valid UTF-8 text"), ".txt"), true);
      assert.strictEqual(checkMagicBytes(Buffer.from("Text with \x00 null byte"), ".txt"), false);
    });
  });

  // ── 2. POST /records/upload Validation & Rejection ─────────────────────────
  describe("POST /records/upload Validation & Rejection", () => {
    test("rejects missing file with 400 FILE_REQUIRED", async () => {
      const form = new FormData();
      form.append("label", "No file label");
      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "FILE_REQUIRED");
    });

    test("rejects empty file with 400 FILE_EMPTY", async () => {
      const form = new FormData();
      form.append("file", new Blob([], { type: "text/plain" }), "empty.txt");
      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "FILE_EMPTY");
    });

    test("rejects unsupported file type with 400 UNSUPPORTED_FILE_TYPE", async () => {
      const form = new FormData();
      form.append("file", new Blob(["malicious bytes"], { type: "application/octet-stream" }), "virus.exe");
      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "UNSUPPORTED_FILE_TYPE");
    });

    test("rejects file content mismatch with 400 FILE_CONTENT_MISMATCH", async () => {
      const form = new FormData();
      form.append("file", new Blob(["this is plain text not a pdf"], { type: "application/pdf" }), "fake.pdf");
      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "FILE_CONTENT_MISMATCH");
    });

    test("rejects oversized file (>10MB) with 400 FILE_TOO_LARGE", async () => {
      const form = new FormData();
      const oversizeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024, 0x20);
      form.append("file", new Blob([oversizeBuffer], { type: "text/plain" }), "huge.txt");
      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error, "FILE_TOO_LARGE");
    });
  });

  // ── 3. Successful Multi-Format Uploads ─────────────────────────────────────
  describe("POST /records/upload Multi-Format Success", () => {
    test("uploads valid TXT record and returns metadata", async () => {
      const content = "Patient Blood Test: Normal vitals.";
      const form = new FormData();
      form.append("file", new Blob([content], { type: "text/plain" }), "vitals.txt");
      form.append("label", "Vitals Test M7");

      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert(body.recordId, "must return recordId");
      assert.strictEqual(body.mimeType, "text/plain");
      assert.strictEqual(body.originalFileName, "vitals.txt");
      assert.strictEqual(body.sizeBytes, Buffer.byteLength(content));
      uploadedTxtRecordId = body.recordId;
    });

    test("uploads valid PDF record with %PDF magic bytes", async () => {
      const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");
      const form = new FormData();
      form.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "scan_report.pdf");
      form.append("label", "MRI Scan M7");

      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert(body.recordId, "must return recordId");
      assert.strictEqual(body.mimeType, "application/pdf");
      assert.strictEqual(body.originalFileName, "scan_report.pdf");
      assert.strictEqual(body.sizeBytes, pdfBytes.length);
      uploadedPdfRecordId = body.recordId;
    });

    test("uploads valid PNG record with 89 50 4E 47 magic bytes", async () => {
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const form = new FormData();
      form.append("file", new Blob([pngBytes], { type: "image/png" }), "xray.png");
      form.append("label", "XRay PNG M7");

      const res = await fetch(`${baseUrl}/records/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${patientToken}` },
        body: form,
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.mimeType, "image/png");
      assert.strictEqual(body.originalFileName, "xray.png");
    });
  });

  // ── 4. View Endpoint Multi-Format Handling ─────────────────────────────────
  describe("GET /records/:id/view Multi-Format Handling", () => {
    test("returns UTF-8 string and encoding: utf8 for text records", async () => {
      assert(uploadedTxtRecordId, "uploadedTxtRecordId must exist");
      const res = await fetch(`${baseUrl}/records/${uploadedTxtRecordId}/view`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.encoding, "utf8");
      assert.strictEqual(body.mimeType, "text/plain");
      assert.strictEqual(typeof body.content, "string");
      assert.strictEqual(body.content, "Patient Blood Test: Normal vitals.");
      assert.strictEqual(body.originalFileName, "vitals.txt");
    });

    test("returns base64 string and encoding: base64 for PDF binary records", async () => {
      assert(uploadedPdfRecordId, "uploadedPdfRecordId must exist");
      const res = await fetch(`${baseUrl}/records/${uploadedPdfRecordId}/view`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.encoding, "base64");
      assert.strictEqual(body.mimeType, "application/pdf");
      assert.strictEqual(body.originalFileName, "scan_report.pdf");

      // Verify base64 decoded content starts with %PDF
      const decodedBuffer = Buffer.from(body.content, "base64");
      assert(decodedBuffer.subarray(0, 4).toString("ascii").startsWith("%PDF"));

      // Verify SHA-256 hash holds on raw bytes
      const hash = "0x" + crypto.createHash("sha256").update(decodedBuffer).digest("hex");
      assert.strictEqual(hash, body.fileHash);
    });

    test("old records default to text/plain and encoding: utf8", async () => {
      // Record 1 was uploaded in earlier test suites without metadata
      const res = await fetch(`${baseUrl}/records/1/view`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      if (res.status === 200) {
        const body = await res.json();
        assert.strictEqual(body.mimeType, "text/plain");
        assert.strictEqual(body.encoding, "utf8");
        assert.strictEqual(typeof body.content, "string");
      }
    });
  });

  // ── 5. Additive List Fields ────────────────────────────────────────────────
  describe("Additive Fields in GET /records/mine and GET /records/shared-with-me", () => {
    test("GET /records/mine includes mimeType, originalFileName, sizeBytes", async () => {
      const res = await fetch(`${baseUrl}/records/mine`, {
        headers: { Authorization: `Bearer ${patientToken}` },
      });
      assert.strictEqual(res.status, 200);
      const records = await res.json();
      assert(Array.isArray(records));
      assert(records.length > 0);

      for (const rec of records) {
        assert(typeof rec.mimeType === "string", "each item must have mimeType");
        assert("originalFileName" in rec, "each item must have originalFileName");
        assert("sizeBytes" in rec, "each item must have sizeBytes");
      }
    });

    test("Patient grants PDF access to doctor; doctor sees in shared-with-me and views with base64", async () => {
      assert(uploadedPdfRecordId, "uploadedPdfRecordId must exist");

      // Patient grants access
      const grantRes = await fetch(`${baseUrl}/records/${uploadedPdfRecordId}/grant`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${patientToken}`,
        },
        body: JSON.stringify({ doctorAddress: doctorAccount.walletAddress }),
      });
      assert.strictEqual(grantRes.status, 200);

      // Doctor lists shared records
      const sharedRes = await fetch(`${baseUrl}/records/shared-with-me`, {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert.strictEqual(sharedRes.status, 200);
      const sharedList = await sharedRes.json();
      assert(Array.isArray(sharedList));
      const sharedPdf = sharedList.find((r) => r.recordId === uploadedPdfRecordId);
      assert(sharedPdf, "shared list must contain granted PDF record");
      assert.strictEqual(sharedPdf.mimeType, "application/pdf");
      assert.strictEqual(sharedPdf.originalFileName, "scan_report.pdf");

      // Doctor views the PDF record
      const doctorViewRes = await fetch(`${baseUrl}/records/${uploadedPdfRecordId}/view`, {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert.strictEqual(doctorViewRes.status, 200);
      const viewData = await doctorViewRes.json();
      assert.strictEqual(viewData.encoding, "base64");
      assert.strictEqual(viewData.mimeType, "application/pdf");
      const decoded = Buffer.from(viewData.content, "base64");
      assert(decoded.subarray(0, 4).toString("ascii").startsWith("%PDF"));
      const hash = "0x" + crypto.createHash("sha256").update(decoded).digest("hex");
      assert.strictEqual(hash, viewData.fileHash);
    });
  });
});
