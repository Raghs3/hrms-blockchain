const path = require("path");

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = {
  ".txt": "text/plain",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Strips path traversal and control characters from client-provided filename.
 */
function sanitizeFileName(name) {
  if (!name || typeof name !== "string") return "file";
  const base = path.basename(name).replace(/[\x00-\x1f\x7f/\\]/g, "").trim();
  return base.slice(0, 255) || "file";
}

/**
 * Extracts lowercase extension from filename.
 */
function getFileExtension(filename) {
  if (!filename || typeof filename !== "string") return "";
  return path.extname(filename).toLowerCase();
}

/**
 * Checks magic byte signatures for supported file types.
 */
function checkMagicBytes(buffer, ext) {
  if (!Buffer.isBuffer(buffer)) return false;

  switch (ext) {
    case ".pdf":
      // %PDF (0x25, 0x50, 0x44, 0x46)
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x25 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x44 &&
        buffer[3] === 0x46
      );

    case ".png":
      // 89 50 4E 47 (0x89, 0x50, 0x4E, 0x47)
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47
      );

    case ".jpg":
    case ".jpeg":
      // FF D8 FF (0xFF, 0xD8, 0xFF)
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );

    case ".doc":
      // D0 CF 11 E0 (0xD0, 0xCF, 0x11, 0xE0)
      return (
        buffer.length >= 4 &&
        buffer[0] === 0xd0 &&
        buffer[1] === 0xcf &&
        buffer[2] === 0x11 &&
        buffer[3] === 0xe0
      );

    case ".docx": {
      // ZIP (PK 03 04 -> 0x50, 0x4B, 0x03, 0x04) and must contain word/document.xml
      const isZip =
        buffer.length >= 4 &&
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04;
      if (!isZip) return false;
      return buffer.includes(Buffer.from("word/document.xml"));
    }

    case ".txt": {
      // Valid UTF-8 with no NUL bytes
      if (buffer.includes(0x00)) return false;
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(buffer);
        return true;
      } catch {
        return false;
      }
    }

    default:
      return false;
  }
}

/**
 * Validates uploaded file against size, extension whitelist, and magic bytes.
 * Returns { valid: true, mimeType, ext, originalFileName } or { valid: false, error, message, status }.
 */
function validateUploadedFile(file) {
  if (!file) {
    return { valid: false, error: "FILE_REQUIRED", message: "Please select a file to upload", status: 400 };
  }

  const buffer = file.buffer;
  if (!buffer || buffer.length === 0 || file.size === 0) {
    return { valid: false, error: "FILE_EMPTY", message: "File is empty. Please select a valid file.", status: 400 };
  }

  if (buffer.length > MAX_FILE_SIZE || file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "FILE_TOO_LARGE", message: "File exceeds 10 MB limit", status: 400 };
  }

  const originalFileName = sanitizeFileName(file.originalname);
  const ext = getFileExtension(originalFileName);

  if (!ALLOWED_EXTENSIONS[ext]) {
    return {
      valid: false,
      error: "UNSUPPORTED_FILE_TYPE",
      message: "Unsupported file type. Supported extensions: .txt, .pdf, .png, .jpg, .jpeg, .doc, .docx",
      status: 400,
    };
  }

  if (!checkMagicBytes(buffer, ext)) {
    return {
      valid: false,
      error: "FILE_CONTENT_MISMATCH",
      message: `File content does not match expected format for extension '${ext}'`,
      status: 400,
    };
  }

  return {
    valid: true,
    mimeType: ALLOWED_EXTENSIONS[ext],
    ext,
    originalFileName,
    sizeBytes: buffer.length,
  };
}

module.exports = {
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  sanitizeFileName,
  getFileExtension,
  checkMagicBytes,
  validateUploadedFile,
};
