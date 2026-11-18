// Shared helpers for purpose- and time-bound consent.

export const PURPOSE_PRESETS = [
  'Second opinion',
  'Ongoing treatment',
  'Specialist referral',
  'Insurance claim',
  'Emergency care',
];

// value: hours until the grant expires; null = until the patient revokes it.
export const EXPIRY_OPTIONS = [
  { label: '24 hours', hours: 24 },
  { label: '7 days', hours: 24 * 7 },
  { label: '30 days', hours: 24 * 30 },
  { label: '90 days', hours: 24 * 90 },
  { label: 'Until I revoke', hours: null },
  { label: 'Pick a date and time...', custom: true },
];

// A custom expiry must be at least this far ahead (the chain clock can differ slightly from
// this browser's) and no further than a year, so a grant stays genuinely time-bound.
export const MIN_CUSTOM_EXPIRY_MS = 5 * 60 * 1000;
export const MAX_CUSTOM_EXPIRY_MS = 365 * 24 * 3600 * 1000;

/** "YYYY-MM-DDTHH:mm" in local time, the format <input type="datetime-local"> expects. */
export function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Validates a datetime-local value. Returns { iso } on success or { error } with a patient-friendly message.
 */
export function parseCustomExpiry(value, now = Date.now()) {
  if (!value) return { error: 'Please pick the date and time when access should end.' };
  const ms = new Date(value).getTime();
  if (Number.isNaN(ms)) return { error: 'That date and time is not valid.' };
  if (ms < now + MIN_CUSTOM_EXPIRY_MS) return { error: 'Choose a time at least 5 minutes from now.' };
  if (ms > now + MAX_CUSTOM_EXPIRY_MS) return { error: 'Access can last at most one year. Choose an earlier date.' };
  return { iso: new Date(ms).toISOString() };
}

export function expiryIsoFromHours(hours) {
  if (hours == null) return null;
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

/** "Until revoked" | "Expires 20 Nov, 14:02" | "Expired 20 Nov, 14:02" */
export function describeExpiry(expiresAt) {
  if (!expiresAt) return 'Until revoked';
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return 'Until revoked';
  const when = d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return `${d.getTime() <= Date.now() ? 'Expired' : 'Expires'} ${when}`;
}
