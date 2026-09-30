import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {listNotifications, markRead, unreadCount} from '@/lib/notifications';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in required.'}, 401);
  try {
    const [notifications, unread, appointments] = await Promise.all([
      listNotifications(account.id), unreadCount(account.id),
      getPaymentDb().order.findMany({where: {customerId: account.id, status: 'scheduled', appointmentEnd: {gte: new Date()}}, orderBy: {appointmentStart: 'asc'}, take: 10, select: {code: true, appointmentStart: true, appointmentEnd: true}})
    ]);
    return json({notifications, unread, appointments});
  } catch { return json({error: 'Your Inbox is unavailable right now.'}, 503); }
}

const body = z.object({action: z.literal('read'), ids: z.array(z.string().max(40)).max(100).optional()}).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in required.'}, 401);
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: 'Invalid request.'}, 400);
  try { await markRead(account.id, parsed.data.ids); return json({ok: true, unread: await unreadCount(account.id)}); }
  catch { return json({error: 'Your Inbox is unavailable right now.'}, 503); }
}
