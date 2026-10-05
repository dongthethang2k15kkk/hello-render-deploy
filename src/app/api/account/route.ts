import {z} from 'zod';
import {currentCustomerSession, forgetCustomer, revokeCustomerSessions} from '@/lib/auth';
import {hashPassword, passwordSchema, sameOrigin, verifyPassword} from '@/lib/customer-rules';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  const session = await currentCustomerSession();
  if (!session) return json({error: 'Sign in required.'}, 401);
  const customer = await getPaymentDb().customer.findUnique({where: {id: session.customerId}, select: {name: true, email: true, emailVerified: true, googleSub: true, passwordHash: true, mustChangePassword: true, coinBalance: true, createdAt: true}});
  if (!customer) return json({error: 'Sign in required.'}, 401);
  const {googleSub, passwordHash, coinBalance, ...profile} = customer;
  return json({account: {...profile, coinBalance: coinBalance.toString(), google: Boolean(googleSub), hasPassword: Boolean(passwordHash)}});
}

const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('change-password'), current: z.string().max(128).optional(), password: passwordSchema}),
  z.object({action: z.literal('sign-out-everywhere')})
]);

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const session = await currentCustomerSession();
  if (!session) return json({error: 'Sign in required.'}, 401);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid request.'}, 400);
  const db = getPaymentDb();
  try {
    if (parsed.data.action === 'sign-out-everywhere') {
      await revokeCustomerSessions(session.customerId, session.sessionId);
      return json({ok: true});
    }
    const customer = await db.customer.findUnique({where: {id: session.customerId}, select: {passwordHash: true}});
    // Accounts that sign in with Google may set a first password without knowing an old one.
    if (customer?.passwordHash && !verifyPassword(customer.passwordHash, parsed.data.current ?? '')) return json({error: 'Current password is incorrect.'}, 400);
    await db.customer.update({where: {id: session.customerId}, data: {passwordHash: hashPassword(parsed.data.password), mustChangePassword: false}});
    await revokeCustomerSessions(session.customerId, session.sessionId);
    forgetCustomer(session.customerId);
    return json({ok: true});
  } catch (error) {
    console.error('Account update failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'Your account could not be updated right now.'}, 503);
  }
}
