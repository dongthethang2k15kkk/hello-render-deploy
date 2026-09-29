import {createHmac, timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';
import {findAccountById, type DemoAccount} from './demo-accounts';
export type {DemoAccount, DemoRole} from './demo-accounts';

const cookieName = 'shop_demo_session';
const secret = () => process.env.AUTH_SECRET || 'local-demo-secret-change-before-production';

function sign(value: string) {
  return createHmac('sha256', secret()).update(value).digest('base64url');
}

export function encodeSession(account: DemoAccount) {
  const value = `${account.id}.${account.role}`;
  return `${value}.${sign(value)}`;
}

export function decodeSession(value?: string | null): DemoAccount | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [id, role, signature] = parts;
  const payload = `${id}.${role}`;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const account = findAccountById(id);
  return account?.role === role ? account : null;
}

export async function getSession() {
  return decodeSession((await cookies()).get(cookieName)?.value);
}

export const sessionCookie = cookieName;

export const sessionCookieOptions = {httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8};