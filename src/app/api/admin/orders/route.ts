import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {readFilters} from '@/lib/customer-rules';
import {ORDER_STATUSES} from '@/lib/order-rules';
import {listOrders} from '@/lib/order-store';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined);
const filters = z.object({
  q: z.string().trim().max(100).catch(''),
  status: z.enum(['all', 'needs-action', ...ORDER_STATUSES]).catch('all'),
  from: dateParam, to: dateParam,
  page: z.coerce.number().int().min(1).max(10000).catch(1)
});

export async function GET(request: Request) {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json(await listOrders(readFilters(filters, new URL(request.url).searchParams))); }
  catch (error) {
    console.error('Order list failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'Orders could not be loaded.'}, 503);
  }
}
