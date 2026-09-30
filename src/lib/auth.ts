import 'server-only';
import {cookies} from 'next/headers';
import {adminCookie, decodeAdminSession, type Account} from './admin-session';
import {getExtraAdmins} from './admin-team';
import {clientIp, hashToken, newSessionToken, SESSION_DAYS, userAgent} from './customer-rules';
import {getPaymentDb} from './payment-db';

export type {Account, Role} from './admin-session';

export const customerCookie = 'shop_session';
const CACHE_MS = 60_000;
const TOUCH_MS = 10 * 60_000;

type CachedSession = {account: Account; sessionId: string; customerId: string; cachedAt: number; lastSeenAt: number};
// One Render instance serves all traffic, so an in-process cache can be invalidated directly.
const store = globalThis as unknown as {customerSessionCache?: Map<string, CachedSession>};
const cache = store.customerSessionCache ??= new Map();

export function customerCookieOptions(maxAge = SESSION_DAYS * 24 * 60 * 60) {
  return {httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge};
}

export function customerAccount(customer: {id: string; name: string; email: string; mustChangePassword: boolean}): Account {
  return {id: customer.id, name: customer.name, role: 'user', email: customer.email, mustChangePassword: customer.mustChangePassword};
}

/** Returns the signed-in Admin or customer, or null. Customer sessions need the database. */
export async function getSession(): Promise<Account | null> {
  const jar = await cookies();
  const adminValue = jar.get(adminCookie)?.value;
  if (adminValue) {
    // Owners are checked without a database call; Admins added in Settings need the cached list.
    const admin = decodeAdminSession(adminValue) ?? decodeAdminSession(adminValue, await getExtraAdmins());
    if (admin) return admin;
  }
  const token = jar.get(customerCookie)?.value;
  return token ? (await readCustomerSession(token))?.account ?? null : null;
}

export async function currentCustomerSession() {
  const token = (await cookies()).get(customerCookie)?.value;
  return token ? readCustomerSession(token) : null;
}

async function readCustomerSession(token: string) {
  if (!process.env.DATABASE_URL || token.length > 100) return null;
  const tokenHash = hashToken(token);
  const now = Date.now();
  const hit = cache.get(tokenHash);
  if (hit && now - hit.cachedAt < CACHE_MS) return hit;
  try {
    const db = getPaymentDb();
    const session = await db.customerSession.findUnique({where: {tokenHash}, include: {customer: true}});
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now || session.customer.status !== 'active') {
      cache.delete(tokenHash);
      return null;
    }
    const entry: CachedSession = {account: customerAccount(session.customer), sessionId: session.id, customerId: session.customerId, cachedAt: now, lastSeenAt: session.lastSeenAt.getTime()};
    if (now - entry.lastSeenAt > TOUCH_MS) {
      entry.lastSeenAt = now;
      void db.customerSession.update({where: {id: session.id}, data: {lastSeenAt: new Date(now)}}).catch(() => undefined);
    }
    cache.set(tokenHash, entry);
    return entry;
  } catch (error) {
    console.error('Session lookup failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return null;
  }
}

/** Creates a database session and returns the raw token for the cookie; only its hash is stored. */
export async function createCustomerSession(customerId: string, headers: Headers) {
  const token = newSessionToken();
  await getPaymentDb().customerSession.create({data: {
    customerId, tokenHash: hashToken(token), ip: clientIp(headers), userAgent: userAgent(headers),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  }});
  return token;
}

export function forgetCustomer(customerId: string) {
  for (const [key, entry] of cache) if (entry.customerId === customerId) cache.delete(key);
}

export async function revokeCustomerSessions(customerId: string, keepSessionId?: string) {
  await getPaymentDb().customerSession.updateMany({where: {customerId, revokedAt: null, ...(keepSessionId ? {id: {not: keepSessionId}} : {})}, data: {revokedAt: new Date()}});
  forgetCustomer(customerId);
}

export async function revokeCustomerToken(token: string) {
  const tokenHash = hashToken(token);
  cache.delete(tokenHash);
  await getPaymentDb().customerSession.updateMany({where: {tokenHash, revokedAt: null}, data: {revokedAt: new Date()}});
}
