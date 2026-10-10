import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {cartLineSchema} from '@/lib/cart';
import {sameOrigin} from '@/lib/customer-rules';
import {createOrder, customerOrders, OrderError} from '@/lib/order-store';
import {PAYMENT_METHODS, timingSchema} from '@/lib/order-rules';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in required.'}, 401);
  try { return json({orders: await customerOrders(account.id)}); }
  catch { return json({error: 'Orders are unavailable right now.'}, 503); }
}

// Checkout sends when the customer wants to trade (now and/or later times) together with the order.
const body = z.object({lines: z.array(cartLineSchema).min(1).max(20), method: z.enum(PAYMENT_METHODS).default('bank'), timing: timingSchema.optional(), redeemWheelCoins: z.boolean().default(false)}).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const account = await getSession();
  if (account?.role !== 'user') return json({error: 'Sign in to place an order.'}, 401);
  if (!process.env.DATABASE_URL) return json({error: 'Orders are unavailable right now.'}, 503);
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues.some(issue => issue.path[0] === 'timing') ? parsed.error.issues[0].message : 'Your cart is invalid. Please review it.'}, 400);
  try {
    const order = await createOrder(account, parsed.data.lines, parsed.data.method, parsed.data.timing, parsed.data.redeemWheelCoins);
    return json({code: order.code}, 201);
  } catch (error) {
    if (error instanceof OrderError) return json({error: error.message}, error.status);
    console.error('Order creation failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'Your order could not be placed. Please try again.'}, 503);
  }
}
