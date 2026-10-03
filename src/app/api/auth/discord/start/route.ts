import {NextResponse} from 'next/server';
import {safeNext} from '@/lib/customer-rules';
import {appOrigin, createOAuthState, discordConfig, discordCookie, discordCookiePath, discordRedirectUri} from '@/lib/oauth-helpers';

export const runtime = 'nodejs';

/** Customer sign-in with Discord (identify + email). Admins keep signing in with Google. */
export async function GET(request: Request) {
  const config = discordConfig();
  if (!config) return NextResponse.redirect(`${appOrigin(request.url)}/en/login?error=discord_not_configured`);
  const {state} = createOAuthState();
  const params = new URLSearchParams({client_id: config.clientId, redirect_uri: discordRedirectUri(request.url), response_type: 'code', scope: 'identify email', state, prompt: 'none'});
  const response = NextResponse.redirect(`https://discord.com/oauth2/authorize?${params}`);
  const options = {httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: discordCookiePath, maxAge: 600};
  response.cookies.set(discordCookie.state, state, options);
  const next = safeNext(new URL(request.url).searchParams.get('next'));
  if (next) response.cookies.set(discordCookie.next, next, options);
  return response;
}
