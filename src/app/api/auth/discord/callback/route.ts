import {NextResponse, type NextRequest} from 'next/server';
import {adminCookie} from '@/lib/admin-session';
import {isAdminEmail} from '@/lib/admin-team';
import {createCustomerSession, customerCookie, customerCookieOptions, revokeCustomerSessions} from '@/lib/auth';
import {decideDiscordLink, safeNext} from '@/lib/customer-rules';
import {recordLoginEvent} from '@/lib/customer-store';
import {appOrigin, discordConfig, discordCookie, discordCookiePath, discordRedirectUri, isAllowedAdmin, statesMatch} from '@/lib/oauth-helpers';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';

type DiscordUser = {id?: string; username?: string; global_name?: string | null; email?: string | null; verified?: boolean};

export async function GET(request: NextRequest) {
  const origin = appOrigin(request.url);
  const clear = (response: NextResponse) => {
    for (const name of Object.values(discordCookie)) response.cookies.set(name, '', {path: discordCookiePath, maxAge: 0});
    return response;
  };
  const fail = (reason: string) => clear(NextResponse.redirect(`${origin}/en/login?error=${reason}`));
  const config = discordConfig();
  if (!config) return fail('discord_not_configured');
  const url = request.nextUrl;
  if (url.searchParams.get('error')) return fail('discord_cancelled');
  const code = url.searchParams.get('code');
  if (!code || !statesMatch(url.searchParams.get('state'), request.cookies.get(discordCookie.state)?.value)) return fail('discord_invalid_state');

  let user: DiscordUser;
  try {
    const token = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, cache: 'no-store',
      body: new URLSearchParams({grant_type: 'authorization_code', code, redirect_uri: discordRedirectUri(request.url), client_id: config.clientId, client_secret: config.clientSecret})
    });
    if (!token.ok) throw new Error(`token ${token.status}`);
    const {access_token: accessToken} = await token.json() as {access_token?: string};
    if (!accessToken) throw new Error('missing access token');
    const me = await fetch('https://discord.com/api/users/@me', {headers: {Authorization: `Bearer ${accessToken}`}, cache: 'no-store'});
    if (!me.ok) throw new Error(`users/@me ${me.status}`);
    user = await me.json() as DiscordUser;
  } catch (error) {
    console.error('Discord sign-in failed', error instanceof Error ? error.message : error);
    return fail('discord_failed');
  }

  // Order emails need a real address, so only a Discord account with a verified email can sign in.
  if (!user.id || !user.email || user.verified !== true) return fail('discord_unverified');
  const email = user.email.trim().toLowerCase();
  if (isAllowedAdmin(email) || await isAdminEmail(email)) return fail('discord_admin');
  if (!process.env.DATABASE_URL) return fail('accounts_unavailable');
  const headers = request.headers;
  const username = (user.username ?? '').slice(0, 40) || null;
  try {
    const db = getPaymentDb();
    const fields = {id: true, discordId: true, passwordHash: true, emailVerified: true, status: true} as const;
    const [byId, byEmail] = await Promise.all([
      db.customer.findUnique({where: {discordId: user.id}, select: fields}),
      db.customer.findUnique({where: {email}, select: fields})
    ]);
    const decision = decideDiscordLink(byId, byEmail);
    if (decision.action === 'conflict') return fail('discord_conflict');
    if (decision.action === 'locked') {
      await recordLoginEvent({customerId: decision.customerId, email, method: 'discord', outcome: 'locked', headers});
      return fail('account_locked');
    }
    const name = (user.global_name?.trim() || user.username?.trim() || email.split('@')[0]).slice(0, 80);
    let customerId: string;
    if (decision.action === 'create') {
      customerId = (await db.customer.create({data: {email, name, discordId: user.id, discordUsername: username, emailVerified: true, lastLoginAt: new Date()}})).id;
    } else if (decision.action === 'link') {
      customerId = decision.customerId;
      // Discord verified the email, so an unverified password set by someone else is discarded (as with Google).
      await db.customer.update({where: {id: customerId}, data: {discordId: user.id, discordUsername: username, emailVerified: true, lastLoginAt: new Date(), ...(decision.dropPassword ? {passwordHash: null, mustChangePassword: false} : {})}});
      if (decision.dropPassword) await revokeCustomerSessions(customerId);
    } else {
      customerId = decision.customerId;
      await db.customer.update({where: {id: customerId}, data: {discordUsername: username, lastLoginAt: new Date()}});
    }
    await recordLoginEvent({customerId, email, method: 'discord', outcome: 'success', headers});
    const next = safeNext(request.cookies.get(discordCookie.next)?.value) ?? 'workspace';
    const response = clear(NextResponse.redirect(`${origin}/en/${next}`));
    response.cookies.set(customerCookie, await createCustomerSession(customerId, headers), customerCookieOptions());
    response.cookies.set(adminCookie, '', {path: '/', maxAge: 0});
    return response;
  } catch (error) {
    console.error('Discord customer sign-in failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return fail('accounts_unavailable');
  }
}
