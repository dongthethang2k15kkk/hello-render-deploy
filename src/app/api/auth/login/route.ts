import {NextResponse} from 'next/server';
import {encodeSession, sessionCookie, sessionCookieOptions} from '@/lib/demo-auth';
import {findAccountByUsername, verifyPassword} from '@/lib/demo-accounts';

// Password login is for customers only; admins must use Google sign-in.
export async function POST(request: Request) {
  const data = await request.json().catch(() => ({}));
  const account = typeof data.username === 'string' ? findAccountByUsername(data.username.trim().toLowerCase()) : undefined;
  if (!account || account.role !== 'user' || typeof data.password !== 'string' || !verifyPassword(account, data.password)) return NextResponse.json({error: 'Username or password is incorrect.'}, {status: 401});
  const response = NextResponse.json({ok: true, role: account.role});
  response.cookies.set(sessionCookie, encodeSession(account), sessionCookieOptions);
  return response;
}