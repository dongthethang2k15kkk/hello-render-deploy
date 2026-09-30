import {NextResponse} from 'next/server';
import {createCustomerSession, customerCookie, customerCookieOptions} from '@/lib/auth';
import {loginSchema, sameOrigin, verifyPassword} from '@/lib/customer-rules';
import {recordLoginEvent, signInBlocked} from '@/lib/customer-store';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';
const wrong = () => NextResponse.json({error: 'Email or password is incorrect.'}, {status: 401});

// Password sign-in is for customers only; Admin uses Google.
export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  if (!process.env.DATABASE_URL) return NextResponse.json({error: 'Accounts are unavailable right now.'}, {status: 503});
  const parsed = loginSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return wrong();
  const {email, password} = parsed.data;
  const headers = request.headers;
  try {
    const db = getPaymentDb();
    const [blocked, customer] = await Promise.all([signInBlocked(email, headers), db.customer.findUnique({where: {email}})]);
    if (blocked) {
      await recordLoginEvent({customerId: customer?.id, email, method: 'password', outcome: 'rate_limited', headers});
      return NextResponse.json({error: 'Too many failed attempts. Wait 15 minutes and try again.'}, {status: 429});
    }
    if (!customer) { await recordLoginEvent({email, method: 'password', outcome: 'unknown_email', headers}); return wrong(); }
    if (!customer.passwordHash) {
      await recordLoginEvent({customerId: customer.id, email, method: 'password', outcome: 'no_password', headers});
      return NextResponse.json({error: 'This account signs in with Google. Use “Continue with Google”.'}, {status: 401});
    }
    if (!verifyPassword(customer.passwordHash, password)) { await recordLoginEvent({customerId: customer.id, email, method: 'password', outcome: 'wrong_password', headers}); return wrong(); }
    if (customer.status !== 'active') {
      await recordLoginEvent({customerId: customer.id, email, method: 'password', outcome: 'locked', headers});
      return NextResponse.json({error: 'This account is locked. Contact the shop on Discord.'}, {status: 403});
    }
    const [token] = await Promise.all([
      createCustomerSession(customer.id, headers),
      db.customer.update({where: {id: customer.id}, data: {lastLoginAt: new Date()}}),
      recordLoginEvent({customerId: customer.id, email, method: 'password', outcome: 'success', headers})
    ]);
    const response = NextResponse.json({ok: true, role: 'user', mustChangePassword: customer.mustChangePassword});
    response.cookies.set(customerCookie, token, customerCookieOptions());
    return response;
  } catch (error) {
    console.error('Sign-in failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return NextResponse.json({error: 'Sign-in is unavailable right now.'}, {status: 503});
  }
}
