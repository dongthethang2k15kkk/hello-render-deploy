// Pure customer-account rules (no Next.js or Prisma imports) so they can be unit tested.
import {createHash, randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {z} from 'zod';

export const SESSION_DAYS = 30;
export const RETENTION_DAYS = 90;
export const RATE_WINDOW_MINUTES = 15;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;
export const MAX_REGISTRATIONS_PER_IP_HOUR = 5;
export const FAILED_OUTCOMES = ['wrong_password', 'unknown_email', 'no_password'] as const;

export type LoginMethod = 'password' | 'google' | 'register';
export type LoginOutcome = 'success' | 'wrong_password' | 'unknown_email' | 'no_password' | 'locked' | 'rate_limited';

export const emailSchema = z.string().trim().toLowerCase().max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Enter a valid email address.');
export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters.').max(128, 'Password must be at most 128 characters.');
export const nameSchema = z.string().trim().min(1, 'Enter your name.').max(80, 'Name must be at most 80 characters.');
export const registerSchema = z.object({email: emailSchema, name: nameSchema, password: passwordSchema});
export const loginSchema = z.object({email: emailSchema, password: z.string().min(1).max(128)});

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(stored: string | null | undefined, password: string) {
  const [salt, hash] = stored?.split(':') ?? [];
  if (!salt || !hash || hash.length !== 128) return false;
  return timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64));
}

export function newSessionToken() {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Cloudflare sets cf-connecting-ip in front of Render; otherwise Render puts the client first in x-forwarded-for. */
export function clientIp(headers: Headers) {
  const candidate = headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0] ?? '';
  const ip = candidate.trim();
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/** Loopback only appears locally (dev server, tests); behind Render every client has a public address. */
export function limitableIp(ip: string | null) {
  return ip && !/^(127\.|::1$|::ffff:127\.)/.test(ip) ? ip : null;
}

export function userAgent(headers: Headers) {
  return headers.get('user-agent')?.slice(0, 300) || null;
}

export type RateCounts = {emailFailures: number; ipFailures: number};
export function isRateLimited({emailFailures, ipFailures}: RateCounts) {
  return emailFailures >= MAX_FAILURES_PER_EMAIL || ipFailures >= MAX_FAILURES_PER_IP;
}

const nextTargets = ['checkout', 'workspace', 'account'] as const;
export type NextTarget = typeof nextTargets[number];
export function safeNext(value: string | null | undefined): NextTarget | null {
  return nextTargets.find(target => target === value) ?? null;
}

type ExistingCustomer = {id: string; googleSub: string | null; passwordHash: string | null; emailVerified: boolean; status: string};
export type GoogleLinkDecision =
  | {action: 'create'}
  | {action: 'sign-in'; customerId: string}
  | {action: 'link'; customerId: string; dropPassword: boolean}
  | {action: 'locked'; customerId: string}
  | {action: 'conflict'};

/**
 * Decides how a verified Google identity maps to a customer. `bySub` is the account already
 * linked to this Google subject; `byEmail` is the account using the same email address.
 */
export function decideGoogleLink(bySub: ExistingCustomer | null, byEmail: ExistingCustomer | null): GoogleLinkDecision {
  const account = bySub ?? byEmail;
  if (!account) return {action: 'create'};
  if (account.status === 'locked') return {action: 'locked', customerId: account.id};
  if (bySub) return {action: 'sign-in', customerId: bySub.id};
  if (account.googleSub) return {action: 'conflict'};
  // An unverified password account with this email may have been created by someone else.
  return {action: 'link', customerId: account.id, dropPassword: Boolean(account.passwordHash) && !account.emailVerified};
}

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const pageParam = z.coerce.number().int().min(1).max(10000).catch(1);
export const customerFilterSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  status: z.enum(['all', 'active', 'locked']).catch('all'),
  method: z.enum(['all', 'google', 'password']).catch('all'),
  from: dateParam,
  to: dateParam,
  page: pageParam
});
export const loginEventFilterSchema = z.object({
  q: z.string().trim().max(100).catch(''),
  outcome: z.enum(['all', 'success', 'failed', 'rate_limited', 'locked']).catch('all'),
  method: z.enum(['all', 'password', 'google', 'register']).catch('all'),
  from: dateParam,
  to: dateParam,
  customerId: z.string().max(40).optional().catch(undefined),
  page: pageParam
});

export function readFilters<T extends z.ZodTypeAny>(schema: T, params: URLSearchParams): z.infer<T> {
  return schema.parse(Object.fromEntries([...params.entries()].filter(([, value]) => value !== '')));
}

/** Inclusive date range in UTC from yyyy-mm-dd inputs. */
export function dateRange(from?: string, to?: string) {
  const range: {gte?: Date; lt?: Date} = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.lt = new Date(new Date(`${to}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000);
  return range.gte || range.lt ? range : undefined;
}

/** Rejects cross-site browser requests; non-browser clients send no Origin header. */
export function sameOrigin(headers: Headers) {
  const origin = headers.get('origin');
  if (!origin) return true;
  const host = headers.get('x-forwarded-host') ?? headers.get('host');
  try { return Boolean(host) && new URL(origin).host === host; } catch { return false; }
}
