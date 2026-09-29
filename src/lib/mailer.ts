import 'server-only';
import {createCipheriv, createDecipheriv, hkdfSync, randomBytes} from 'node:crypto';
import {buildMime, toBase64Url, type MailAttachment} from './mail-mime';
import {googleConfig} from './oauth-helpers';
import {getPaymentDb} from './payment-db';

const CONNECTION_ID = 'gmail';
export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';

// The refresh token is encrypted at rest with a key derived from AUTH_SECRET (changing AUTH_SECRET requires reconnecting).
function key() {
  const secret = process.env.AUTH_SECRET || 'local-demo-secret-change-before-production';
  return Buffer.from(hkdfSync('sha256', secret, 'jewish-horse', 'gmail-refresh-token', 32));
}
function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(part => part.toString('base64url')).join('.');
}
function decrypt(value: string) {
  const [iv, tag, data] = value.split('.').map(part => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export async function mailStatus() {
  if (!process.env.DATABASE_URL) return null;
  const connection = await getPaymentDb().mailConnection.findUnique({where: {id: CONNECTION_ID}, select: {email: true, connectedAt: true, connectedBy: true}});
  return connection;
}

export async function saveMailConnection(email: string, refreshToken: string, connectedBy: string) {
  const data = {email, refreshTokenEnc: encrypt(refreshToken), connectedBy, connectedAt: new Date()};
  await getPaymentDb().mailConnection.upsert({where: {id: CONNECTION_ID}, create: {id: CONNECTION_ID, ...data}, update: data});
  tokenStore.gmailAccessToken = undefined;
}

export async function disconnectMail() {
  await getPaymentDb().mailConnection.deleteMany({where: {id: CONNECTION_ID}});
  tokenStore.gmailAccessToken = undefined;
}

const tokenStore = globalThis as unknown as {gmailAccessToken?: {token: string; expiresAt: number; email: string}};

async function accessToken() {
  const cached = tokenStore.gmailAccessToken;
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
  const connection = await getPaymentDb().mailConnection.findUnique({where: {id: CONNECTION_ID}});
  const config = googleConfig();
  if (!connection || !config) return null;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, cache: 'no-store',
    body: new URLSearchParams({client_id: config.clientId, client_secret: config.clientSecret, refresh_token: decrypt(connection.refreshTokenEnc), grant_type: 'refresh_token'})
  });
  const body = await response.json().catch(() => ({})) as {access_token?: string; expires_in?: number; error?: string};
  if (!response.ok || !body.access_token) throw new Error(`Gmail token refresh failed (${body.error ?? response.status}). Reconnect Gmail in Admin → Settings → Email.`);
  tokenStore.gmailAccessToken = {token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000, email: connection.email};
  return tokenStore.gmailAccessToken;
}

export type SendResult = {status: 'sent' | 'failed' | 'skipped'; error?: string};

/** Sends through the connected Gmail and records the outcome in EmailLog. Never throws. */
export async function sendMail(input: {to: string[]; subject: string; text: string; html: string; attachments?: MailAttachment[]; kind: string; orderId?: string}): Promise<SendResult> {
  const recipients = [...new Set(input.to.map(email => email.trim().toLowerCase()).filter(Boolean))];
  let result: SendResult;
  try {
    const token = recipients.length ? await accessToken() : null;
    if (!recipients.length) result = {status: 'skipped', error: 'No recipients'};
    else if (!token) result = {status: 'skipped', error: 'Gmail is not connected'};
    else {
      const raw = toBase64Url(buildMime({from: `Jewish Horse <${token.email}>`, to: recipients, subject: input.subject, text: input.text, html: input.html, attachments: input.attachments}));
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {method: 'POST', headers: {Authorization: `Bearer ${token.token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({raw}), cache: 'no-store'});
      if (response.ok) result = {status: 'sent'};
      else {
        const body = await response.json().catch(() => ({})) as {error?: {message?: string}};
        if (response.status === 401) tokenStore.gmailAccessToken = undefined;
        result = {status: 'failed', error: `Gmail API ${response.status}: ${body.error?.message ?? 'send failed'}`.slice(0, 300)};
      }
    }
  } catch (error) {
    result = {status: 'failed', error: (error instanceof Error ? error.message : 'Send failed').slice(0, 300)};
  }
  try {
    await getPaymentDb().emailLog.create({data: {recipient: recipients.join(', ').slice(0, 500) || '—', subject: input.subject.slice(0, 200), kind: input.kind, orderId: input.orderId ?? null, status: result.status, error: result.error ?? null}});
  } catch { /* logging must not break the caller */ }
  return result;
}
