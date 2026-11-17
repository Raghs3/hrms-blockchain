import { useState, useEffect } from 'react';

/**
 * Checks whether content is printable plain text.
 * Returns false if it contains non-printable binary characters or binary headers.
 */
export function isPrintableText(content) {
  if (typeof content !== 'string') return false;
  if (content.startsWith('%PDF-')) return false;
  // Non-printable control characters excluding standard whitespace (\t, \n, \r)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(content)) {
    return false;
  }
  return true;
}

/**
 * Formats byte size into human readable string.
 */
export function formatBytes(bytes) {
  if (typeof bytes !== 'number' || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Converts base64 string to Uint8Array.
 */
export function base64ToBytes(base64) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Computes browser-side SHA-256 hash over raw bytes and compares to on-chain hash.
 * Handles both base64-encoded binary content and UTF-8 text content.
 */
export async function verifyRecordIntegrity(content, encoding, onChainHash) {
  if (!content || !onChainHash) return { verified: false, computedHash: null };
  try {
    let bytes;
    if (encoding === 'base64') {
      bytes = base64ToBytes(content);
    } else {
      bytes = new TextEncoder().encode(content);
    }
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', bytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const computedHash = '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    const verified = computedHash.toLowerCase() === onChainHash.toLowerCase();
    return { verified, computedHash };
  } catch (err) {
    console.error('Integrity check error:', err);
    return { verified: false, computedHash: null };
  }
}

/**
 * Initiates browser download of decrypted record content with proper MIME type and filename.
 */
export function downloadRecordContent(
  content,
  filename = 'medical-record.txt',
  mimeType = 'text/plain',
  encoding = 'utf8'
) {
  if (!content) return;
  let blob;
  if (encoding === 'base64') {
    const bytes = base64ToBytes(content);
    blob = new Blob([bytes], { type: mimeType });
  } else {
    blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * RecordContentViewer - Shared presentation component for decrypted medical record content.
 * Reused by Patient ViewRecordModal and Doctor RecordLookup.
 *
 * Supports:
 * - Text (.txt): inline <pre>
 * - Images (.png, .jpg): <img> with object URL
 * - PDF (.pdf): <iframe> with object URL and fallback download
 * - DOC / DOCX (.doc, .docx): clean download card with file metadata
 */
export default function RecordContentViewer({
  content,
  encoding = 'utf8',
  mimeType = 'text/plain',
  originalFileName,
  sizeBytes,
  label,
  onDownload,
}) {
  const [blobUrl, setBlobUrl] = useState(null);

  // Manage Blob URL creation and cleanup
  useEffect(() => {
    if (!content) {
      setBlobUrl(null);
      return;
    }

    const isImage = mimeType?.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    if (encoding === 'base64' && (isImage || isPdf)) {
      try {
        const bytes = base64ToBytes(content);
        const blob = new Blob([bytes], { type: mimeType });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } catch (err) {
        console.error('Error generating preview URL:', err);
        setBlobUrl(null);
      }
    } else {
      setBlobUrl(null);
    }
  }, [content, encoding, mimeType]);

  if (!content && content !== '') {
    return null;
  }

  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  const isDoc =
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  // 1. Image preview
  if (isImage && blobUrl) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-light)',
        }}
      >
        <img
          src={blobUrl}
          alt={label || originalFileName || 'Medical Record Image'}
          style={{
            maxWidth: '100%',
            maxHeight: '460px',
            borderRadius: 'var(--radius-sm)',
            objectFit: 'contain',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        />
        {originalFileName && (
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {originalFileName} {sizeBytes ? `(${formatBytes(sizeBytes)})` : ''}
          </div>
        )}
      </div>
    );
  }

  // 2. PDF preview
  if (isPdf && blobUrl) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-light)',
          overflow: 'hidden',
        }}
      >
        <iframe
          src={blobUrl}
          title={label || originalFileName || 'PDF Document Viewer'}
          style={{
            width: '100%',
            height: '460px',
            border: 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 14px',
            backgroundColor: '#f1f5f9',
            borderTop: '1px solid var(--color-border-light)',
            fontSize: '0.8125rem',
          }}
        >
          <span style={{ color: 'var(--color-text-muted)' }}>
            {originalFileName || 'Medical Document.pdf'} {sizeBytes ? `(${formatBytes(sizeBytes)})` : ''}
          </span>
          {onDownload && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onDownload}
              style={{ fontSize: '0.75rem', padding: '3px 10px' }}
            >
              Download PDF
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. Word Document (DOC/DOCX) - Download-only card
  if (isDoc) {
    return (
      <div
        style={{
          padding: '28px 20px',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            color: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 6px', fontSize: '1rem', fontWeight: 600 }}>
          {originalFileName || label || 'Word Document'}
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
          {mimeType === 'application/msword' ? 'Microsoft Word (.doc)' : 'Microsoft Word (.docx)'}
          {sizeBytes ? ` • ${formatBytes(sizeBytes)}` : ''}
        </p>
        {onDownload && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onDownload}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download Decrypted Document
          </button>
        )}
      </div>
    );
  }

  // 4. Plain Text preview
  if (encoding !== 'base64' && isPrintableText(content)) {
    return (
      <pre
        className="record-content-text"
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.875rem',
          lineHeight: '1.6',
          padding: '14px 16px',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-md)',
          maxHeight: '380px',
          overflowY: 'auto',
          margin: 0,
        }}
      >
        {content}
      </pre>
    );
  }

  // 5. Fallback for binary / unsupported preview
  return (
    <div
      className="preview-not-supported"
      style={{
        padding: '24px 20px',
        backgroundColor: '#f8fafc',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-light)',
        fontSize: '0.9375rem',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>Inline preview not supported for this file format.</p>
      <p style={{ margin: '6px 0 14px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        {originalFileName || 'Medical Record'} ({mimeType})
      </p>
      {onDownload && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onDownload}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Download File
        </button>
      )}
    </div>
  );
}
