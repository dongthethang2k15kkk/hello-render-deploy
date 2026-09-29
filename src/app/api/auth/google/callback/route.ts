import {NextResponse, type NextRequest} from 'next/server';
import {encodeSession, sessionCookie, sessionCookieOptions} from '@/lib/demo-auth';
import {googleAdminAccount} from '@/lib/demo-accounts';
import {appOrigin, googleConfig, isAllowedAdmin, oauthCookie, oauthCookiePath, redirectUri, statesMatch} from '@/lib/oauth-helpers';

export const runtime = 'nodejs';

type UserInfo = {email?: string; email_verified?: boolean};

export async function GET(request: NextRequest) {
  const origin = appOrigin(request.url);
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${origin}/en/login?error=${reason}`);
    response.cookies.set(oauthCookie.state, '', {path: oauthCookiePath, maxAge: 0});
    response.cookies.set(oauthCookie.verifier, '', {path: oauthCookiePath, maxAge: 0});
    return response;
  };
  const config = googleConfig();
  if (!config) return fail('google_not_configured');
  const url = request.nextUrl;
  if (url.searchParams.get('error')) return fail('google_cancelled');
  const code = url.searchParams.get('code');
  const verifier = request.cookies.get(oauthCookie.verifier)?.value;
  if (!code || !verifier || !statesMatch(url.searchParams.get('state'), request.cookies.get(oauthCookie.state)?.value)) return fail('google_invalid_state');

  let user: UserInfo;
  try {
    const token = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri(request.url), grant_type: 'authorization_code', code_verifier: verifier}),
      cache: 'no-store'
    });
    if (!token.ok) throw new Error(`token ${token.status}`);
    const {access_token: accessToken} = await token.json() as {access_token?: string};
    if (!accessToken) throw new Error('missing access token');
    // Userinfo is fetched directly from Google over TLS, so its claims are trusted without local JWT verification.
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers: {Authorization: `Bearer ${accessToken}`}, cache: 'no-store'});
    if (!info.ok) throw new Error(`userinfo ${info.status}`);
    user = await info.json() as UserInfo;
  } catch (error) {
    console.error('Google sign-in failed', error instanceof Error ? error.message : error);
    return fail('google_failed');
  }

  if (!user.email || user.email_verified !== true) return fail('google_unverified');
  if (!isAllowedAdmin(user.email)) return fail('not_admin');
  const response = NextResponse.redirect(`${origin}/en/admin/chat`);
  response.cookies.set(oauthCookie.state, '', {path: oauthCookiePath, maxAge: 0});
  response.cookies.set(oauthCookie.verifier, '', {path: oauthCookiePath, maxAge: 0});
  response.cookies.set(sessionCookie, encodeSession(googleAdminAccount(user.email)), sessionCookieOptions);
  return response;
}
