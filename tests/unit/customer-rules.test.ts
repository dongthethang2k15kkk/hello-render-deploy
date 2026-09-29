import {describe, expect, it} from 'vitest';
import {
  clientIp, customerFilterSchema, dateRange, decideGoogleLink, hashPassword, hashToken, isRateLimited, loginEventFilterSchema,
  newSessionToken, readFilters, registerSchema, safeNext, sameOrigin, verifyPassword
} from '../../src/lib/customer-rules';
import {describeUserAgent, generatePassword} from '../../src/lib/customer-labels';

const account = (patch: Partial<{id: string; googleSub: string | null; passwordHash: string | null; emailVerified: boolean; status: string}> = {}) =>
  ({id: 'c1', googleSub: null, passwordHash: null, emailVerified: false, status: 'active', ...patch});

describe('passwords and tokens', () => {
  it('hashes with a salt and verifies only the right password', () => {
    const one = hashPassword('correct horse'); const two = hashPassword('correct horse');
    expect(one).not.toBe(two);
    expect(verifyPassword(one, 'correct horse')).toBe(true);
    expect(verifyPassword(one, 'wrong horse')).toBe(false);
    expect(verifyPassword(null, 'anything')).toBe(false);
    expect(verifyPassword('garbage', 'anything')).toBe(false);
  });
  it('stores only a hash of the random session token', () => {
    const token = newSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).not.toContain(token);
  });
  it('generates readable passwords without ambiguous characters', () => {
    const password = generatePassword();
    expect(password).toHaveLength(12);
    expect(password).not.toMatch(/[0O1lI]/);
  });
});

describe('registration input', () => {
  it('normalizes email and rejects short passwords', () => {
    expect(registerSchema.parse({email: '  Khach@Gmail.COM ', name: ' Vy ', password: '12345678'})).toEqual({email: 'khach@gmail.com', name: 'Vy', password: '12345678'});
    expect(registerSchema.safeParse({email: 'khach@gmail.com', name: 'Vy', password: 'short'}).success).toBe(false);
    expect(registerSchema.safeParse({email: 'not-an-email', name: 'Vy', password: '12345678'}).success).toBe(false);
  });
});

describe('rate limiting', () => {
  it('blocks after 5 failures for an email or 20 for an IP', () => {
    expect(isRateLimited({emailFailures: 4, ipFailures: 19})).toBe(false);
    expect(isRateLimited({emailFailures: 5, ipFailures: 0})).toBe(true);
    expect(isRateLimited({emailFailures: 0, ipFailures: 20})).toBe(true);
  });
});

describe('client IP', () => {
  it('prefers the Cloudflare header, then the first forwarded address', () => {
    expect(clientIp(new Headers({'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.1'}))).toBe('203.0.113.9');
    expect(clientIp(new Headers({'x-forwarded-for': '198.51.100.1, 10.0.0.2'}))).toBe('198.51.100.1');
    expect(clientIp(new Headers({'x-forwarded-for': '2001:db8::1'}))).toBe('2001:db8::1');
    expect(clientIp(new Headers({'x-forwarded-for': '<script>'}))).toBeNull();
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe('google account linking', () => {
  it('creates a new customer when nothing matches', () => expect(decideGoogleLink(null, null)).toEqual({action: 'create'}));
  it('signs in the account already linked to this Google subject', () => expect(decideGoogleLink(account({googleSub: 'g1'}), null)).toEqual({action: 'sign-in', customerId: 'c1'}));
  it('drops an unverified password when linking an email account', () => {
    expect(decideGoogleLink(null, account({passwordHash: 'x:y'}))).toEqual({action: 'link', customerId: 'c1', dropPassword: true});
    expect(decideGoogleLink(null, account({passwordHash: 'x:y', emailVerified: true}))).toEqual({action: 'link', customerId: 'c1', dropPassword: false});
  });
  it('refuses an email already linked to another Google account', () => expect(decideGoogleLink(null, account({googleSub: 'other'}))).toEqual({action: 'conflict'}));
  it('keeps locked accounts out', () => expect(decideGoogleLink(account({googleSub: 'g1', status: 'locked'}), null)).toEqual({action: 'locked', customerId: 'c1'}));
});

describe('redirects, filters and origin', () => {
  it('only allows known next targets', () => {
    expect(safeNext('checkout')).toBe('checkout');
    expect(safeNext('https://evil.example')).toBeNull();
    expect(safeNext('__proto__')).toBeNull();
  });
  it('falls back to safe defaults for bad filter values', () => {
    expect(readFilters(customerFilterSchema, new URLSearchParams('status=hacked&page=-3&from=yesterday&q=vy'))).toEqual({q: 'vy', status: 'all', method: 'all', from: undefined, to: undefined, page: 1});
    expect(readFilters(loginEventFilterSchema, new URLSearchParams('outcome=failed&page=2')).outcome).toBe('failed');
  });
  it('makes the end date inclusive', () => {
    const range = dateRange('2026-09-01', '2026-09-01');
    expect(range?.lt?.getTime()! - range?.gte?.getTime()!).toBe(24 * 60 * 60 * 1000);
    expect(dateRange()).toBeUndefined();
  });
  it('rejects cross-site browser requests', () => {
    expect(sameOrigin(new Headers({host: 'shop.example', origin: 'https://shop.example'}))).toBe(true);
    expect(sameOrigin(new Headers({host: 'shop.example', origin: 'https://evil.example'}))).toBe(false);
    expect(sameOrigin(new Headers({host: 'shop.example'}))).toBe(true);
  });
  it('describes devices briefly', () => {
    expect(describeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Zalo iOS')).toBe('Zalo on iOS');
    expect(describeUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 Edg/140.0')).toBe('Edge on Windows');
    expect(describeUserAgent(null)).toBe('Unknown device');
  });
});

describe('IP rate limits', () => {
  it('ignore loopback addresses that only occur locally', async () => {
    const {limitableIp} = await import('../../src/lib/customer-rules');
    expect(limitableIp('127.0.0.1')).toBeNull();
    expect(limitableIp('::1')).toBeNull();
    expect(limitableIp('::ffff:127.0.0.1')).toBeNull();
    expect(limitableIp('203.0.113.9')).toBe('203.0.113.9');
    expect(limitableIp(null)).toBeNull();
  });
});

describe('admin deep links', () => {
  it('accepts only same-site Admin paths', async () => {
    const {safeAdminPath} = await import('../../src/lib/customer-rules');
    expect(safeAdminPath('/en/admin/orders/cmabc123def')).toBe('/en/admin/orders/cmabc123def');
    expect(safeAdminPath('/en/admin')).toBe('/en/admin');
    expect(safeAdminPath('//evil.example/en/admin')).toBeNull();
    expect(safeAdminPath('/en/admin/../../x')).toBeNull();
    expect(safeAdminPath('https://evil.example')).toBeNull();
  });
});

describe('admin deep links', () => {
  it('accepts only same-site Admin paths', async () => {
    const {safeAdminPath} = await import('../../src/lib/customer-rules');
    expect(safeAdminPath('/en/admin/orders/cmabc123def')).toBe('/en/admin/orders/cmabc123def');
    expect(safeAdminPath('/en/admin')).toBe('/en/admin');
    expect(safeAdminPath('//evil.example/en/admin')).toBeNull();
    expect(safeAdminPath('/en/admin/../../x')).toBeNull();
    expect(safeAdminPath('https://evil.example')).toBeNull();
  });
});
