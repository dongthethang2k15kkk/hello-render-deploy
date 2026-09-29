import {NextResponse} from 'next/server';
import {safeAdminPath, safeNext} from '@/lib/customer-rules';
import {appOrigin, createOAuthState, googleConfig, oauthCookie, oauthCookiePath, pkceChallenge, redirectUri} from '@/lib/oauth-helpers';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const config = googleConfig();
  if (!config) return NextResponse.redirect(`${appOrigin(request.url)}/en/login?error=google_not_configured`);
  const {state, verifier} = createOAuthState();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(request.url),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account'
  });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  // Short-lived, path-scoped cookies; SameSite=Lax still sends them on Google's top-level redirect back.
  const options = {httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: oauthCookiePath, maxAge: 600};
  response.cookies.set(oauthCookie.state, state, options);
  response.cookies.set(oauthCookie.verifier, verifier, options);
  // A normal sign-in must never inherit an abandoned "connect Gmail" attempt.
  response.cookies.set(oauthCookie.purpose, '', {...options, maxAge: 0});
  const requested = new URL(request.url).searchParams.get('next');
  const next = safeNext(requested) ?? safeAdminPath(requested);
  if (next) response.cookies.set(oauthCookie.next, next, options);
  return response;
}
