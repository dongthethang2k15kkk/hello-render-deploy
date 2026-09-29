import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {demoCredentials} from './demo-credentials';
import {devAdminEmail, devAdminLoginEnabled, isAllowedAdmin} from './oauth-helpers';

export type DemoRole = 'admin' | 'user';
export type DemoAccount = {id: string; username: string; name: string; role: DemoRole; password: string; email?: string};

export const demoAccounts: DemoAccount[] = demoCredentials.map(item => ({...item}));

const googleAdminPrefix = 'ga-';

/** Admin accounts are derived from the Google email; the id contains no '.' so it fits the session format. */
export function googleAdminAccount(email: string): DemoAccount {
  const normalized = email.trim().toLowerCase();
  return {id: googleAdminPrefix + Buffer.from(normalized).toString('base64url'), username: normalized, name: normalized.split('@')[0], role: 'admin', password: '', email: normalized};
}

/** Re-checks the allowlist on every request, so removing an email from ADMIN_GOOGLE_EMAILS revokes access. */
function findGoogleAdmin(id: string) {
  const email = Buffer.from(id.slice(googleAdminPrefix.length), 'base64url').toString('utf8');
  if (email === devAdminEmail) return devAdminLoginEnabled() ? googleAdminAccount(email) : undefined;
  return isAllowedAdmin(email) ? googleAdminAccount(email) : undefined;
}

const registered = new Map<string, DemoAccount>();
export function findAccountById(id: string) { return id.startsWith(googleAdminPrefix) ? findGoogleAdmin(id) : demoAccounts.find(a => a.id === id) ?? registered.get(id); }
export function findAccountByUsername(username: string) { return demoAccounts.find(a => a.username === username) ?? [...registered.values()].find(a => a.username === username); }
export function customerAccounts() { return [...demoAccounts, ...registered.values()].filter(a => a.role === 'user'); }
export function verifyPassword(account: DemoAccount, password: string) {
  if (account.id.startsWith('demo-')) return account.password === password;
  const [salt, hash] = account.password.split(':');
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(Buffer.from(hash, 'hex'), actual);
}
export function registerAccount(username: string, name: string, password: string) {
  const salt = randomBytes(16).toString('hex');
  const account: DemoAccount = {id: randomBytes(16).toString('hex'), username, name, role: 'user', password: `${salt}:${scryptSync(password, salt, 64).toString('hex')}`};
  registered.set(account.id, account);
  return account;
}