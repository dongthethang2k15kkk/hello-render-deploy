import 'server-only';
import {parseAllowlist} from './oauth-helpers';
import {getPaymentDb} from './payment-db';

// Owners come from ADMIN_GOOGLE_EMAILS (Render); further Admins are added in Admin → Settings → Admins.
const KEY = 'adminEmails';
const CACHE_MS = 30_000;
const store = globalThis as unknown as {extraAdminsCache?: {emails: string[]; at: number}};

export const ownerEmails = () => parseAllowlist(process.env.ADMIN_GOOGLE_EMAILS);

export async function getExtraAdmins(): Promise<string[]> {
  const hit = store.extraAdminsCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.emails;
  let emails: string[] = [];
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: KEY}});
      if (Array.isArray(row?.value)) emails = parseAllowlist((row.value as unknown[]).filter(item => typeof item === 'string').join(','));
    } catch { return hit?.emails ?? []; }
  }
  store.extraAdminsCache = {emails, at: Date.now()};
  return emails;
}

export async function setExtraAdmins(emails: string[], actorEmail: string) {
  const clean = parseAllowlist(emails.join(',')).filter(email => !ownerEmails().includes(email));
  await getPaymentDb().storeSetting.upsert({where: {key: KEY}, create: {key: KEY, value: clean, updatedBy: actorEmail}, update: {value: clean, updatedBy: actorEmail}});
  store.extraAdminsCache = {emails: clean, at: Date.now()};
  return clean;
}

/** Everyone who may sign in to Admin and receives order emails. */
export async function allAdminEmails() {
  return [...new Set([...ownerEmails(), ...await getExtraAdmins()])];
}

export async function isAdminEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  return ownerEmails().includes(normalized) || (await getExtraAdmins()).includes(normalized);
}
