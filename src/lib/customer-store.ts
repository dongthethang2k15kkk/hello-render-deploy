import 'server-only';
import type {Prisma} from '@prisma/client';
import {forgetCustomer, revokeCustomerSessions} from './auth';
import {
  clientIp, dateRange, FAILED_OUTCOMES, limitableIp, hashPassword, isRateLimited, MAX_REGISTRATIONS_PER_IP_HOUR,
  RATE_WINDOW_MINUTES, RETENTION_DAYS, userAgent, type customerFilterSchema, type LoginMethod,
  type LoginOutcome, type loginEventFilterSchema
} from './customer-rules';
import {getPaymentDb} from './payment-db';
import type {z} from 'zod';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

export async function recordLoginEvent(event: {customerId?: string | null; email: string; method: LoginMethod; outcome: LoginOutcome; headers: Headers}) {
  await getPaymentDb().loginEvent.create({data: {
    customerId: event.customerId ?? null, email: event.email.slice(0, 254), method: event.method, outcome: event.outcome,
    ip: clientIp(event.headers), userAgent: userAgent(event.headers)
  }});
  void purgeExpiredData();
}

export async function signInBlocked(email: string, headers: Headers) {
  const since = minutesAgo(RATE_WINDOW_MINUTES);
  const ip = limitableIp(clientIp(headers));
  const failed = {outcome: {in: [...FAILED_OUTCOMES]}, createdAt: {gte: since}};
  const db = getPaymentDb();
  const [emailFailures, ipFailures] = await Promise.all([
    db.loginEvent.count({where: {...failed, email}}),
    ip ? db.loginEvent.count({where: {...failed, ip}}) : Promise.resolve(0)
  ]);
  return isRateLimited({emailFailures, ipFailures});
}

export async function registrationBlocked(headers: Headers) {
  const ip = limitableIp(clientIp(headers));
  if (!ip) return false;
  const count = await getPaymentDb().loginEvent.count({where: {ip, method: 'register', outcome: 'success', createdAt: {gte: minutesAgo(60)}}});
  return count >= MAX_REGISTRATIONS_PER_IP_HOUR;
}

const purgeState = globalThis as unknown as {customerPurgeAt?: number};
/** Deletes sign-in history and chat images past retention, and long-dead sessions. Runs at most every 6 hours. */
export async function purgeExpiredData() {
  const now = Date.now();
  if (purgeState.customerPurgeAt && now - purgeState.customerPurgeAt < 6 * 60 * 60_000) return;
  purgeState.customerPurgeAt = now;
  const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60_000);
  const deadSessions = new Date(now - 7 * 24 * 60 * 60_000);
  const db = getPaymentDb();
  try {
    await Promise.all([
      db.loginEvent.deleteMany({where: {createdAt: {lt: cutoff}}}),
      db.chatImage.deleteMany({where: {createdAt: {lt: cutoff}}}),
      db.customerSession.deleteMany({where: {OR: [{expiresAt: {lt: deadSessions}}, {revokedAt: {lt: deadSessions}}]}})
    ]);
  } catch (error) {
    purgeState.customerPurgeAt = undefined;
    console.error('Retention purge failed', error instanceof Error ? error.message.split('\n')[0] : error);
  }
}

// ---- Admin views (curated fields only: never password hashes or session tokens) ----

export async function listCustomers(filters: z.infer<typeof customerFilterSchema>, pageSize = 50) {
  const where: Prisma.CustomerWhereInput = {
    ...(filters.q ? {OR: [{email: {contains: filters.q, mode: 'insensitive'}}, {name: {contains: filters.q, mode: 'insensitive'}}]} : {}),
    ...(filters.status !== 'all' ? {status: filters.status} : {}),
    ...(filters.method === 'google' ? {googleSub: {not: null}} : filters.method === 'password' ? {passwordHash: {not: null}} : {}),
    ...(dateRange(filters.from, filters.to) ? {createdAt: dateRange(filters.from, filters.to)} : {})
  };
  const db = getPaymentDb();
  const [total, rows] = await Promise.all([
    db.customer.count({where}),
    db.customer.findMany({
      where, orderBy: [{lastLoginAt: {sort: 'desc', nulls: 'last'}}, {createdAt: 'desc'}], skip: (filters.page - 1) * pageSize, take: pageSize,
      select: {id: true, email: true, name: true, emailVerified: true, status: true, createdAt: true, lastLoginAt: true, googleSub: true, passwordHash: true}
    })
  ]);
  return {total, page: filters.page, pageSize, customers: rows.map(({googleSub, passwordHash, ...row}) => ({...row, methods: [googleSub ? 'google' : null, passwordHash ? 'password' : null].filter(Boolean) as string[]}))};
}

export async function customerDetail(id: string) {
  const db = getPaymentDb();
  const customer = await db.customer.findUnique({where: {id}, select: {
    id: true, email: true, name: true, emailVerified: true, status: true, lockedReason: true, mustChangePassword: true,
    createdAt: true, lastLoginAt: true, googleSub: true, passwordHash: true, _count: {select: {chatMessages: true}}
  }});
  if (!customer) return null;
  const [sessions, audit] = await Promise.all([
    db.customerSession.findMany({where: {customerId: id, revokedAt: null, expiresAt: {gt: new Date()}}, orderBy: {lastSeenAt: 'desc'}, select: {id: true, ip: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true}}),
    db.auditLog.findMany({where: {customerId: id}, orderBy: {createdAt: 'desc'}, take: 50, select: {id: true, actorEmail: true, action: true, summary: true, createdAt: true}})
  ]);
  const {googleSub, passwordHash, _count, ...profile} = customer;
  return {customer: {...profile, methods: [googleSub ? 'google' : null, passwordHash ? 'password' : null].filter(Boolean) as string[], chatMessages: _count.chatMessages}, sessions, audit};
}

export async function listLoginEvents(filters: z.infer<typeof loginEventFilterSchema>, pageSize = 100) {
  const outcome = filters.outcome === 'all' ? {} : filters.outcome === 'failed' ? {outcome: {in: [...FAILED_OUTCOMES]}} : {outcome: filters.outcome};
  const where: Prisma.LoginEventWhereInput = {
    ...outcome,
    ...(filters.method !== 'all' ? {method: filters.method} : {}),
    ...(filters.customerId ? {customerId: filters.customerId} : {}),
    ...(filters.q ? {OR: [{email: {contains: filters.q.toLowerCase()}}, {ip: {startsWith: filters.q}}]} : {}),
    ...(dateRange(filters.from, filters.to) ? {createdAt: dateRange(filters.from, filters.to)} : {})
  };
  const db = getPaymentDb();
  const [total, events] = await Promise.all([
    db.loginEvent.count({where}),
    db.loginEvent.findMany({where, orderBy: {createdAt: 'desc'}, skip: (filters.page - 1) * pageSize, take: pageSize, select: {id: true, customerId: true, email: true, method: true, outcome: true, ip: true, userAgent: true, createdAt: true}})
  ]);
  return {total, page: filters.page, pageSize, events};
}

// ---- Admin actions (each one is written to the audit log) ----

async function audit(actorEmail: string, customerId: string | null, action: string, summary: string) {
  await getPaymentDb().auditLog.create({data: {actorEmail, customerId, action, summary}});
}

export async function lockCustomer(actorEmail: string, id: string, reason: string) {
  await getPaymentDb().customer.update({where: {id}, data: {status: 'locked', lockedReason: reason || null}});
  await revokeCustomerSessions(id);
  await audit(actorEmail, id, 'lock', reason ? `Locked: ${reason}` : 'Locked');
}

export async function unlockCustomer(actorEmail: string, id: string) {
  await getPaymentDb().customer.update({where: {id}, data: {status: 'active', lockedReason: null}});
  forgetCustomer(id);
  await audit(actorEmail, id, 'unlock', 'Unlocked');
}

export async function setCustomerPassword(actorEmail: string, id: string, password: string, requireChange: boolean) {
  await getPaymentDb().customer.update({where: {id}, data: {passwordHash: hashPassword(password), mustChangePassword: requireChange}});
  await revokeCustomerSessions(id);
  await audit(actorEmail, id, 'set-password', requireChange ? 'Set a new password; customer must change it at next sign-in' : 'Set a new password');
}

export async function signOutCustomerEverywhere(actorEmail: string, id: string) {
  await revokeCustomerSessions(id);
  await audit(actorEmail, id, 'sign-out-all', 'Signed out of all devices');
}

/** Removes the account with its sessions, chat (including images) and sign-in history. */
export async function deleteCustomer(actorEmail: string, id: string) {
  const db = getPaymentDb();
  await db.$transaction(async tx => {
    const images = await tx.chatMessage.findMany({where: {customerId: id, imageId: {not: null}}, select: {imageId: true}});
    await tx.chatMessage.deleteMany({where: {customerId: id}});
    await tx.chatImage.deleteMany({where: {id: {in: images.map(image => image.imageId!)}}});
    await tx.loginEvent.deleteMany({where: {customerId: id}});
    await tx.customer.delete({where: {id}});
  }, {maxWait: 10000, timeout: 20000});
  forgetCustomer(id);
  await audit(actorEmail, null, 'delete', 'Deleted a customer account and its data');
}
