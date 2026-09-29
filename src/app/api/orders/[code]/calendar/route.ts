import {getSession} from '@/lib/auth';
import {icsEvent} from '@/lib/calendar';
import {appOrigin} from '@/lib/oauth-helpers';
import {orderCodePattern} from '@/lib/order-rules';
import {customerOrder} from '@/lib/order-store';

export const runtime = 'nodejs';

/** Downloadable .ics for a booked appointment. */
export async function GET(request: Request, {params}: {params: Promise<{code: string}>}) {
  const account = await getSession();
  const {code} = await params;
  if (account?.role !== 'user' || !orderCodePattern.test(code)) return new Response('Not found', {status: 404});
  const order = await customerOrder(account.id, code).catch(() => null);
  if (!order?.appointmentStart || !order.appointmentEnd || order.status !== 'scheduled') return new Response('Not found', {status: 404});
  const ics = icsEvent({uid: `${order.id}@jewish-horse`, start: order.appointmentStart, end: order.appointmentEnd, title: `Jewish Horse · order ${order.code}`, description: 'Open the Jewish Horse website and go to Chat at this time.', url: `${appOrigin(request.url)}/en/orders/${order.code}`});
  return new Response(ics, {headers: {'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `attachment; filename="jewish-horse-${order.code}.ics"`, 'Cache-Control': 'no-store'}});
}
