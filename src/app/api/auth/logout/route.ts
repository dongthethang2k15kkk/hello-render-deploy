import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {adminCookie} from '@/lib/admin-session';
import {customerCookie, revokeCustomerToken} from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST() {
  const token = (await cookies()).get(customerCookie)?.value;
  if (token && process.env.DATABASE_URL) await revokeCustomerToken(token).catch(() => undefined);
  const response = NextResponse.json({ok: true});
  for (const name of [customerCookie, adminCookie]) response.cookies.set(name, '', {httpOnly: true, expires: new Date(0), path: '/'});
  return response;
}
