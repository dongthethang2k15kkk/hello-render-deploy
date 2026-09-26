import {NextResponse} from 'next/server';
import {encodeSession, sessionCookie} from '@/lib/demo-auth';
import {findAccountByUsername, verifyPassword} from '@/lib/demo-accounts';

export async function POST(request: Request) {
  const data = await request.json().catch(() => ({}));
  const account = typeof data.username === 'string' ? findAccountByUsername(data.username.trim().toLowerCase()) : undefined;
  if (!account || typeof data.password !== 'string' || !verifyPassword(account, data.password)) return NextResponse.json({error: 'Tên đăng nhập hoặc mật khẩu không đúng.'}, {status: 401});
  const response = NextResponse.json({ok: true, role: account.role});
  response.cookies.set(sessionCookie, encodeSession(account), {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8});
  return response;
}