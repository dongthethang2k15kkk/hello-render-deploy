import {NextResponse, type NextRequest} from 'next/server';
import {adminCookie, adminCookieOptions, encodeAdminSession, googleAdminAccount} from '@/lib/admin-session';
import {recordAudit} from '@/lib/audit';
import {createCustomerSession, customerCookie, customerCookieOptions, getSession, revokeCustomerSessions} from '@/lib/auth';
import {decideGoogleLink, safeAdminPath, safeNext} from '@/lib/customer-rules';
import {recordLoginEvent} from '@/lib/customer-store';
import {GMAIL_SEND_SCOPE, saveMailConnection} from '@/lib/mailer';
import {appOrigin, googleConfig, isAllowedAdmin, oauthCookie, oauthCookiePath, redirectUri, statesMatch} from '@/lib/oauth-helpers';
import {getPaymentDb} from '@/lib/payment-db';

export const runtime = 'nodejs';

type UserInfo = {sub?: string; email?: string; email_verified?: boolean; name?: string};

export async function GET(request: NextRequest) {
  const origin = appOrigin(request.url);
  const clearOAuth = (response: NextResponse) => {
    for (const name of Object.values(oauthCookie)) response.cookies.set(name, '', {path: oauthCookiePath, maxAge: 0});
    return response;
  };
  const fail = (reason: string) => clearOAuth(NextResponse.redirect(`${origin}/en/login?error=${reason}`));
  const config = googleConfig();
  if (!config) return fail('google_not_configured');
  const url = request.nextUrl;
  if (url.searchParams.get('error')) return fail('google_cancelled');
  const code = url.searchParams.get('code');
  const verifier = request.cookies.get(oauthCookie.verifier)?.value;
  if (!code || !verifier || !statesMatch(url.searchParams.get('state'), request.cookies.get(oauthCookie.state)?.value)) return fail('google_invalid_state');

  const mailFlow = request.cookies.get(oauthCookie.purpose)?.value === 'mail';
  let user: UserInfo;
  let refreshToken: string | undefined;
  let grantedScope = '';
  try {
    const token = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: redirectUri(request.url), grant_type: 'authorization_code', code_verifier: verifier}),
      cache: 'no-store'
    });
    if (!token.ok) throw new Error(`token ${token.status}`);
    const {access_token: accessToken, refresh_token: refresh, scope} = await token.json() as {access_token?: string; refresh_token?: string; scope?: string};
    refreshToken = refresh; grantedScope = scope ?? '';
    if (!accessToken) throw new Error('missing access token');
    // Userinfo is fetched directly from Google over TLS, so its claims are trusted without local JWT verification.
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {headers: {Authorization: `Bearer ${accessToken}`}, cache: 'no-store'});
    if (!info.ok) throw new Error(`userinfo ${info.status}`);
    user = await info.json() as UserInfo;
  } catch (error) {
    console.error('Google sign-in failed', error instanceof Error ? error.message : error);
    return fail('google_failed');
  }

  if (!user.email || !user.sub || user.email_verified !== true) return fail('google_unverified');
  const email = user.email.trim().toLowerCase();

  if (mailFlow) {
    // Connecting the shop's Gmail sender: only a signed-in Admin may do this.
    const mailDone = (query: string) => clearOAuth(NextResponse.redirect(`${origin}/en/admin/settings/email?${query}`));
    const admin = await getSession();
    if (admin?.role !== 'admin') return fail('not_admin');
    if (!grantedScope.split(' ').includes(GMAIL_SEND_SCOPE)) return mailDone('error=scope_missing');
    if (!refreshToken) return mailDone('error=no_refresh_token');
    await saveMailConnection(email, refreshToken, admin.email);
    await recordAudit({actorEmail: admin.email, action: 'email.connected', summary: `Connected Gmail sender ${email}`, entityType: 'email'});
    return mailDone('connected=1');
  }

  if (isAllowedAdmin(email)) {
    const response = clearOAuth(NextResponse.redirect(`${origin}${safeAdminPath(request.cookies.get(oauthCookie.next)?.value) ?? '/en/admin'}`));
    response.cookies.set(adminCookie, encodeAdminSession(googleAdminAccount(email)), adminCookieOptions);
    response.cookies.set(customerCookie, '', {path: '/', maxAge: 0});
    return response;
  }

  if (!process.env.DATABASE_URL) return fail('accounts_unavailable');
  const headers = request.headers;
  try {
    const db = getPaymentDb();
    const fields = {id: true, googleSub: true, passwordHash: true, emailVerified: true, status: true} as const;
    const [bySub, byEmail] = await Promise.all([
      db.customer.findUnique({where: {googleSub: user.sub}, select: fields}),
      db.customer.findUnique({where: {email}, select: fields})
    ]);
    const decision = decideGoogleLink(bySub, byEmail);
    if (decision.action === 'conflict') return fail('google_conflict');
    if (decision.action === 'locked') {
      await recordLoginEvent({customerId: decision.customerId, email, method: 'google', outcome: 'locked', headers});
      return fail('account_locked');
    }
    const name = (user.name?.trim() || email.split('@')[0]).slice(0, 80);
    let customerId: string;
    if (decision.action === 'create') {
      customerId = (await db.customer.create({data: {email, name, googleSub: user.sub, emailVerified: true, lastLoginAt: new Date()}})).id;
    } else if (decision.action === 'link') {
      customerId = decision.customerId;
      // Google proves ownership of the email, so an unverified password set by someone else is discarded.
      await db.customer.update({where: {id: customerId}, data: {googleSub: user.sub, emailVerified: true, lastLoginAt: new Date(), ...(decision.dropPassword ? {passwordHash: null, mustChangePassword: false} : {})}});
      if (decision.dropPassword) await revokeCustomerSessions(customerId);
    } else {
      customerId = decision.customerId;
      await db.customer.update({where: {id: customerId}, data: {lastLoginAt: new Date()}});
    }
    await recordLoginEvent({customerId, email, method: 'google', outcome: 'success', headers});
    const next = safeNext(request.cookies.get(oauthCookie.next)?.value) ?? 'workspace';
    const response = clearOAuth(NextResponse.redirect(`${origin}/en/${next}`));
    response.cookies.set(customerCookie, await createCustomerSession(customerId, headers), customerCookieOptions());
    response.cookies.set(adminCookie, '', {path: '/', maxAge: 0});
    return response;
  } catch (error) {
    console.error('Google customer sign-in failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return fail('accounts_unavailable');
  }
}
