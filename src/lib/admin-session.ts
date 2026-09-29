// Admin sessions: stateless HMAC-signed cookie for allowlisted Google accounts (no Next.js imports so it can be unit tested).
import {createHmac, timingSafeEqual} from 'node:crypto';
import {devAdminEmail, devAdminLoginEnabled, isAllowedAdmin} from './oauth-helpers';

export type Role = 'admin' | 'user';
export type Account = {id: string; name: string; role: Role; email: string; mustChangePassword?: boolean};

export const adminCookie = 'shop_admin_session';
export const adminCookieOptions = {httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8};
const prefix = 'ga-';
const secret = () => process.env.AUTH_SECRET || 'local-demo-secret-change-before-production';
const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url');

/** Admin identity is derived from the Google email; the id contains no '.' so it fits the cookie format. */
export function googleAdminAccount(email: string): Account {
  const normalized = email.trim().toLowerCase();
  return {id: prefix + Buffer.from(normalized).toString('base64url'), name: normalized.split('@')[0], role: 'admin', email: normalized};
}

export function encodeAdminSession(account: Account) {
  const value = `${account.id}.admin`;
  return `${value}.${sign(value)}`;
}

/** Re-checks the allowlist on every request, so removing an email from ADMIN_GOOGLE_EMAILS revokes access. */
export function decodeAdminSession(value?: string | null): Account | null {
  const [id, role, signature, extra] = value?.split('.') ?? [];
  if (!id?.startsWith(prefix) || role !== 'admin' || !signature || extra !== undefined) return null;
  const expected = sign(`${id}.admin`);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const email = Buffer.from(id.slice(prefix.length), 'base64url').toString('utf8');
  const allowed = email === devAdminEmail ? devAdminLoginEnabled() : isAllowedAdmin(email);
  return allowed ? googleAdminAccount(email) : null;
}
