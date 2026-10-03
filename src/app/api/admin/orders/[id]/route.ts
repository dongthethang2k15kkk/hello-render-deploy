import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {appOrigin} from '@/lib/oauth-helpers';
import {isCrypto, vietnamLocalToDate} from '@/lib/order-rules';
import {addInternalNote, adminOrder, assertHandles, cancelByAdmin, claimOrder, completeOrder, confirmPayment, OrderError, resendEmail, scheduleAppointment} from '@/lib/order-store';
import {checkCryptoOrder} from '@/lib/payment-detection';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const validId = (id: string) => /^[a-z0-9]{10,40}$/.test(id);

export async function GET(request: Request, {params}: {params: Promise<{id: string}>}) {
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const {id} = await params;
  if (!validId(id)) return json({error: 'Order not found'}, 404);
  try {
    let order = await adminOrder(id);
    if (order && isCrypto(order.paymentMethod) && ['awaiting_payment', 'payment_reported'].includes(order.status) && (await checkCryptoOrder(id, appOrigin(request.url)))?.seen) order = await adminOrder(id);
    return order ? json({order, me: admin.email}) : json({error: 'Order not found'}, 404);
  } catch { return json({error: 'Order could not be loaded.'}, 503); }
}

// Appointment times are entered in Vietnam time as "YYYY-MM-DDTHH:mm".
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const appointment = z.object({start: localTime, end: localTime}).strict();
const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('confirm-payment'), amountVnd: z.number().int().positive().max(10_000_000_000), reference: z.string().trim().max(120).default(''), appointment: appointment.optional()}).strict(),
  z.object({action: z.literal('schedule'), appointment}).strict(),
  z.object({action: z.literal('complete'), deliveryNote: z.string().max(5000)}).strict(),
  z.object({action: z.literal('cancel'), reason: z.string().max(500).default('')}).strict(),
  z.object({action: z.literal('note'), note: z.string().max(2000)}).strict(),
  z.object({action: z.literal('resend'), kind: z.enum(['admin.payment_reported', 'customer.appointment', 'customer.completed'])}).strict(),
  z.object({action: z.literal('start-now'), minutes: z.number().int().min(15).max(240).default(60)}).strict(),
  z.object({action: z.literal('check-payment')}).strict(),
  z.object({action: z.enum(['claim', 'release', 'take-over'])}).strict()
]);
// Changing the order is for the Admin handling it (notes, resends and payment checks stay open to every Admin).
const HANDLER_ACTIONS = new Set(['confirm-payment', 'schedule', 'complete', 'cancel', 'start-now']);
const toDates = (value: {start: string; end: string}) => ({start: vietnamLocalToDate(value.start), end: vietnamLocalToDate(value.end)});

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const {id} = await params;
  if (!validId(id)) return json({error: 'Order not found'}, 404);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid action.'}, 400);
  const origin = appOrigin(request.url);
  try {
    const input = parsed.data;
    if (HANDLER_ACTIONS.has(input.action)) await assertHandles(admin.email, id);
    if (input.action === 'claim' || input.action === 'release' || input.action === 'take-over') await claimOrder(admin.email, id, input.action);
    else if (input.action === 'confirm-payment') await confirmPayment(admin.email, id, {amountVnd: input.amountVnd, reference: input.reference, appointment: input.appointment ? toDates(input.appointment) : undefined}, origin);
    else if (input.action === 'schedule') await scheduleAppointment(admin.email, id, toDates(input.appointment), origin);
    else if (input.action === 'complete') await completeOrder(admin.email, id, input.deliveryNote, origin);
    else if (input.action === 'cancel') await cancelByAdmin(admin.email, id, input.reason, origin);
    else if (input.action === 'note') await addInternalNote(admin.email, id, input.note);
    else if (input.action === 'resend') await resendEmail(admin.email, id, input.kind, origin);
    else if (input.action === 'start-now') await scheduleAppointment(admin.email, id, {start: new Date(), end: new Date(Date.now() + input.minutes * 60_000)}, origin);
    else await checkCryptoOrder(id, origin, {force: true});
    return json({ok: true, order: await adminOrder(id), me: admin.email});
  } catch (error) {
    if (error instanceof OrderError) return json({error: error.message}, error.status);
    console.error('Order action failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The action could not be completed.'}, 503);
  }
}
