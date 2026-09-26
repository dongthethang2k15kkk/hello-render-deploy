import {randomBytes, scryptSync, timingSafeEqual} from 'node:crypto';
import {demoCredentials} from './demo-credentials';

export type DemoRole = 'admin' | 'user';
export type DemoAccount = {id: string; username: string; name: string; role: DemoRole; password: string};

export const demoAccounts: DemoAccount[] = demoCredentials.map((item, index) => ({...item, id: ['demo-admin', 'demo-user', 'demo-user-2'][index]}));

const registered = new Map<string, DemoAccount>();
export function findAccountById(id: string) { return demoAccounts.find(a => a.id === id) ?? registered.get(id); }
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