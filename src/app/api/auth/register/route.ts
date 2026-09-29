import {NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {createCustomerSession, customerCookie, customerCookieOptions} from '@/lib/auth';
import {hashPassword, registerSchema, sameOrigin} from '@/lib/customer-rules';
import {recordLoginEvent, registrationBlocked} from '@/lib/customer-store';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  if (!process.env.DATABASE_URL) return NextResponse.json({error: 'Accounts are unavailable right now.'}, {status: 503});
  const parsed = registerSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({error: parsed.error.issues[0]?.message ?? 'Check your details.'}, {status: 400});
  const {email, name, password} = parsed.data;
  try {
    if (await registrationBlocked(request.headers)) return NextResponse.json({error: 'Too many new accounts from this network. Try again later.'}, {status: 429});
    const customer = await getPaymentDb().customer.create({data: {email, name, passwordHash: hashPassword(password), lastLoginAt: new Date()}});
    const [token] = await Promise.all([
      createCustomerSession(customer.id, request.headers),
      recordLoginEvent({customerId: customer.id, email, method: 'register', outcome: 'success', headers: request.headers})
    ]);
    const response = NextResponse.json({ok: true, role: 'user'});
    response.cookies.set(customerCookie, token, customerCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({error: 'An account with this email already exists. Sign in instead.'}, {status: 409});
    console.error('Registration failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return NextResponse.json({error: 'Accounts are unavailable right now.'}, {status: 503});
  }
}
