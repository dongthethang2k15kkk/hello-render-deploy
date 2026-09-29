import {NextResponse} from 'next/server';
import {encodeSession, sessionCookie, sessionCookieOptions} from '@/lib/demo-auth';
import {googleAdminAccount} from '@/lib/demo-accounts';
import {devAdminEmail, devAdminLoginEnabled} from '@/lib/oauth-helpers';

// Local development / E2E only: disabled unless NODE_ENV !== 'production' and ALLOW_DEV_ADMIN_LOGIN=1.
export async function POST() {
  if (!devAdminLoginEnabled()) return NextResponse.json({error: 'Not found'}, {status: 404});
  const response = NextResponse.json({ok: true, role: 'admin'});
  response.cookies.set(sessionCookie, encodeSession(googleAdminAccount(devAdminEmail)), sessionCookieOptions);
  return response;
}
