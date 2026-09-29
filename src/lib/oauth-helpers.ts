// Pure helpers for Google admin sign-in (no Next.js imports so they can be unit tested).
import {createHash, randomBytes, timingSafeEqual} from 'node:crypto';

export const oauthCookie = {state: 'oauth_state', verifier: 'oauth_verifier', next: 'oauth_next'} as const;
export const oauthCookiePath = '/api/auth/google';
export const devAdminEmail = 'dev-admin@localhost';

export function createOAuthState() {
  return {state: randomBytes(24).toString('base64url'), verifier: randomBytes(32).toString('base64url')};
}

/** RFC 7636 S256 code challenge. */
export function pkceChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Constant-time comparison of the returned state with the value stored in the cookie. */
export function statesMatch(received: string | null | undefined, stored: string | null | undefined) {
  if (!received || !stored || received.length !== stored.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(stored));
}

export function parseAllowlist(value: string | undefined) {
  return [...new Set((value ?? '').split(',').map(email => email.trim().toLowerCase()).filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))];
}

export function isAllowedAdmin(email: string | null | undefined, allowlist = parseAllowlist(process.env.ADMIN_GOOGLE_EMAILS)) {
  return typeof email === 'string' && allowlist.includes(email.trim().toLowerCase());
}

/** Local-only admin shortcut for development and E2E; never available in production. */
export function devAdminLoginEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_ADMIN_LOGIN === '1';
}

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
  return clientId && clientSecret ? {clientId, clientSecret} : null;
}

/** APP_URL keeps the redirect URI identical to the one registered in Google behind Render's proxy. */
export function appOrigin(requestUrl: string) {
  return (process.env.APP_URL || new URL(requestUrl).origin).replace(/\/$/, '');
}

export function redirectUri(requestUrl: string) {
  return `${appOrigin(requestUrl)}/api/auth/google/callback`;
}
