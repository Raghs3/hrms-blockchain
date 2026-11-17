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
 * Initiates browser download of decrypted record content.
 */
export function downloadRecordContent(content, filename = 'medical-record.txt') {
  if (!content) return;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * RecordContentViewer - Reusable presentation component for decrypted medical record content.
 * Reused by both Doctor RecordLookup and Patient ViewRecordModal.
 */
export default function RecordContentViewer({ content, label }) {
  if (!content && content !== '') {
    return null;
  }

  // Handle data URL / base64 images
  if (typeof content === 'string' && (content.startsWith('data:image/') || content.startsWith('http://') || content.startsWith('https://'))) {
    return (
      <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
        <img
          src={content}
          alt={label || 'Medical Record'}
          style={{ maxWidth: '100%', maxHeight: '420px', borderRadius: 'var(--radius-sm)', objectFit: 'contain' }}
        />
      </div>
    );
  }

  if (isPrintableText(content)) {
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

  return (
    <div
      className="preview-not-supported"
      style={{
        padding: '20px',
        backgroundColor: '#f8fafc',
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-secondary)',
        border: '1px solid var(--color-border-light)',
        fontSize: '0.9375rem',
        textAlign: 'center',
      }}
    >
      <p style={{ margin: 0, fontWeight: 500 }}>Binary preview not supported in this viewer.</p>
      <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
        You can download the decrypted file to view it on your device.
      </p>
    </div>
  );
}
