import type {Prisma} from '@prisma/client';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {dateRange, readFilters} from '@/lib/customer-rules';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const filters = z.object({
  q: z.string().trim().max(100).catch(''),
  type: z.enum(['all', 'order', 'customer', 'product', 'settings', 'email', 'account']).catch('all'),
  actor: z.string().trim().max(254).catch(''),
  from: dateParam, to: dateParam,
  page: z.coerce.number().int().min(1).max(10000).catch(1)
});

export async function GET(request: Request) {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const input = readFilters(filters, new URL(request.url).searchParams);
  const where: Prisma.AuditLogWhereInput = {
    ...(input.type !== 'all' ? {entityType: input.type} : {}),
    ...(input.actor ? {actorEmail: input.actor.toLowerCase()} : {}),
    ...(input.q ? {summary: {contains: input.q, mode: 'insensitive'}} : {}),
    ...(dateRange(input.from, input.to) ? {createdAt: dateRange(input.from, input.to)} : {})
  };
  const pageSize = 100;
  try {
    const db = getPaymentDb();
    const [total, entries, actors] = await Promise.all([
      db.auditLog.count({where}),
      db.auditLog.findMany({where, orderBy: {createdAt: 'desc'}, skip: (input.page - 1) * pageSize, take: pageSize, select: {id: true, actorEmail: true, action: true, summary: true, entityType: true, entityId: true, customerId: true, createdAt: true}}),
      db.auditLog.findMany({distinct: ['actorEmail'], select: {actorEmail: true}, take: 50})
    ]);
    return json({total, page: input.page, pageSize, entries, actors: actors.map(item => item.actorEmail)});
  } catch { return json({error: 'Activity could not be loaded.'}, 503); }
}
