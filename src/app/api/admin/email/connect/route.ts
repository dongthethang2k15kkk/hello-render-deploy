import {NextResponse} from 'next/server';
import {getSession} from '@/lib/auth';
import {GMAIL_SEND_SCOPE} from '@/lib/mailer';
import {appOrigin, createOAuthState, googleConfig, oauthCookie, oauthCookiePath, pkceChallenge, redirectUri} from '@/lib/oauth-helpers';

export const runtime = 'nodejs';

/** Starts Google consent for sending mail as the shop's Gmail. Reuses the sign-in callback so no new redirect URI is needed. */
export async function GET(request: Request) {
  const origin = appOrigin(request.url);
  if ((await getSession())?.role !== 'admin') return NextResponse.redirect(`${origin}/en/login`);
  const config = googleConfig();
  if (!config) return NextResponse.redirect(`${origin}/en/admin/settings/email?error=google_not_configured`);
  const {state, verifier} = createOAuthState();
  const params = new URLSearchParams({
    client_id: config.clientId, redirect_uri: redirectUri(request.url), response_type: 'code',
    scope: `openid email ${GMAIL_SEND_SCOPE}`, state, code_challenge: pkceChallenge(verifier), code_challenge_method: 'S256',
    access_type: 'offline', prompt: 'consent select_account', include_granted_scopes: 'true'
  });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  const options = {httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: oauthCookiePath, maxAge: 600};
  response.cookies.set(oauthCookie.state, state, options);
  response.cookies.set(oauthCookie.verifier, verifier, options);
  response.cookies.set(oauthCookie.purpose, 'mail', options);
  return response;
}
