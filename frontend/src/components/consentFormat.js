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
];

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
