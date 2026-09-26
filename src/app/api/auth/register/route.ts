import {NextResponse} from 'next/server';
import {encodeSession, sessionCookie} from '@/lib/demo-auth';
import {findAccountByUsername, registerAccount} from '@/lib/demo-accounts';

export async function POST(request: Request) {
  const data = await request.json().catch(() => ({}));
  const username = typeof data.username === 'string' ? data.username.trim().toLowerCase() : '';
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const password = data.password;
  if (!/^[a-z0-9._@-]{3,64}$/.test(username) || !name || name.length > 80 || typeof password !== 'string' || password.length < 8 || password.length > 128)
    return NextResponse.json({error: 'Tên đăng nhập (3–64 ký tự), tên và mật khẩu (8–128 ký tự) không hợp lệ.'}, {status: 400});
  if (findAccountByUsername(username)) return NextResponse.json({error: 'Tên đăng nhập đã tồn tại.'}, {status: 409});
  const account = registerAccount(username, name, password);
  const response = NextResponse.json({ok: true});
  response.cookies.set(sessionCookie, encodeSession(account), {httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 8});
  return response;
}