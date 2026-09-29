// Browser-safe helpers for the Admin customer pages (no Node.js imports).

export const outcomeLabels: Record<string, string> = {
  success: 'Signed in',
  wrong_password: 'Wrong password',
  unknown_email: 'Unknown email',
  no_password: 'Google-only account',
  locked: 'Account locked',
  rate_limited: 'Blocked: too many attempts'
};

export const methodLabels: Record<string, string> = {password: 'Email + password', google: 'Google', register: 'Registered'};

export function outcomeTone(outcome: string) {
  return outcome === 'success' ? 'ok' : outcome === 'rate_limited' || outcome === 'locked' ? 'danger' : 'warn';
}

/** Short "Browser on OS" text from a user-agent string. */
export function describeUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return 'Unknown device';
  const ua = userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS';
  const browser = /Zalo/i.test(ua) ? 'Zalo' : /FBAN|FBAV/.test(ua) ? 'Facebook app' : /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Firefox\/|FxiOS/.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${browser} on ${os}`;
}

/** Readable password for Admin to hand to a customer; avoids 0/O, 1/l/I. */
export function generatePassword(length = 12) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
}

export function formatDateTime(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('en-GB', {day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—';
}
