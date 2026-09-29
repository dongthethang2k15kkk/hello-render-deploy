import QRCode from 'qrcode';
import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {appOrigin} from '@/lib/oauth-helpers';
import {orderCodePattern, reportSchema} from '@/lib/order-rules';
import {cancelByCustomer, customerOrder, OrderError, reportTransfer, updateTimes} from '@/lib/order-store';
import {vietQrPayload} from '@/lib/vietqr';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET(_request: Request, {params}: {params: Promise<{code: string}>}) {
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in required.'}, 401);
  const {code} = await params;
  if (!orderCodePattern.test(code)) return json({error: 'Order not found.'}, 404);
  try {
    const order = await customerOrder(account.id, code);
    if (!order) return json({error: 'Order not found.'}, 404);
    let qrSvg: string | null = null;
    if (order.status === 'awaiting_payment') {
      const payload = vietQrPayload({bankBin: order.bankSnapshot.bankBin, accountNumber: order.bankSnapshot.accountNumber, amountVnd: order.totalVnd, note: order.code});
      qrSvg = await QRCode.toString(payload, {type: 'svg', margin: 1, errorCorrectionLevel: 'M'});
    }
    return json({order, qrSvg, serverTime: new Date().toISOString()});
  } catch (error) {
    console.error('Order load failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'This order is unavailable right now.'}, 503);
  }
}

const action = z.discriminatedUnion('action', [
  reportSchema.extend({action: z.literal('report')}),
  reportSchema.extend({action: z.literal('update-times')}),
  z.object({action: z.literal('cancel')})
]);

export async function POST(request: Request, {params}: {params: Promise<{code: string}>}) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in required.'}, 401);
  const {code} = await params;
  if (!orderCodePattern.test(code)) return json({error: 'Order not found.'}, 404);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid request.'}, 400);
  try {
    const input = parsed.data;
    if (input.action === 'report') await reportTransfer(account, code, input, appOrigin(request.url));
    else if (input.action === 'update-times') await updateTimes(account.id, code, input);
    else await cancelByCustomer(account.id, code);
    return json({ok: true});
  } catch (error) {
    if (error instanceof OrderError) return json({error: error.message}, error.status);
    console.error('Order action failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The action could not be completed. Please try again.'}, 503);
  }
}
