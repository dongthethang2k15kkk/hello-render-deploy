import {afterEach, describe, expect, it, vi} from 'vitest';
import {createHash} from 'node:crypto';
import {createOAuthState, devAdminLoginEnabled, isAllowedAdmin, parseAllowlist, pkceChallenge, redirectUri, statesMatch} from '../../src/lib/oauth-helpers';
import {decodeAdminSession as decodeSession, encodeAdminSession as encodeSession, googleAdminAccount} from '../../src/lib/admin-session';

afterEach(() => vi.unstubAllEnvs());

describe('google admin allowlist', () => {
  it('normalizes, dedupes and drops invalid emails', () => {
    expect(parseAllowlist(' A@Gmail.com, b@gmail.com,,not-an-email, a@gmail.com ')).toEqual(['a@gmail.com', 'b@gmail.com']);
  });
  it('matches case-insensitively and rejects others', () => {
    const list = parseAllowlist('a@gmail.com,b@gmail.com,c@gmail.com');
    expect(isAllowedAdmin('A@GMAIL.COM', list)).toBe(true);
    expect(isAllowedAdmin('d@gmail.com', list)).toBe(false);
    expect(isAllowedAdmin(undefined, list)).toBe(false);
    expect(isAllowedAdmin('a@gmail.com', [])).toBe(false);
  });
});

describe('oauth state and pkce', () => {
  it('creates distinct random values', () => {
    const one = createOAuthState(); const two = createOAuthState();
    expect(one.state).not.toBe(two.state);
    expect(one.verifier.length).toBeGreaterThanOrEqual(43);
  });
  it('uses the RFC 7636 S256 challenge', () => {
    // Test vector from RFC 7636 appendix B.
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(pkceChallenge('x')).toBe(createHash('sha256').update('x').digest('base64url'));
  });
  it('compares state strictly', () => {
    expect(statesMatch('abc', 'abc')).toBe(true);
    expect(statesMatch('abc', 'abd')).toBe(false);
    expect(statesMatch('abc', 'abcd')).toBe(false);
    expect(statesMatch(null, 'abc')).toBe(false);
    expect(statesMatch('', '')).toBe(false);
  });
  it('builds the redirect uri from APP_URL when set', () => {
    vi.stubEnv('APP_URL', 'https://shop.onrender.com/');
    expect(redirectUri('http://10.0.0.1:3000/api/auth/google/start')).toBe('https://shop.onrender.com/api/auth/google/callback');
    vi.stubEnv('APP_URL', '');
    expect(redirectUri('http://localhost:3000/api/auth/google/start')).toBe('http://localhost:3000/api/auth/google/callback');
  });
});

describe('google admin session', () => {
  it('round-trips while the email is allowlisted and is revoked when removed', () => {
    vi.stubEnv('ADMIN_GOOGLE_EMAILS', 'owner@gmail.com');
    const cookie = encodeSession(googleAdminAccount('Owner@Gmail.com'));
    expect(decodeSession(cookie)).toMatchObject({role: 'admin', email: 'owner@gmail.com'});
    vi.stubEnv('ADMIN_GOOGLE_EMAILS', 'someone-else@gmail.com');
    expect(decodeSession(cookie)).toBeNull();
  });
  it('rejects a tampered role', () => {
    vi.stubEnv('ADMIN_GOOGLE_EMAILS', 'owner@gmail.com');
    const [id, , signature] = encodeSession(googleAdminAccount('owner@gmail.com')).split('.');
    expect(decodeSession(`${id}.user.${signature}`)).toBeNull();
  });
  it('only honours the dev admin outside production with the flag', () => {
    const cookie = encodeSession(googleAdminAccount('dev-admin@localhost'));
    vi.stubEnv('ALLOW_DEV_ADMIN_LOGIN', '');
    expect(decodeSession(cookie)).toBeNull();
    vi.stubEnv('ALLOW_DEV_ADMIN_LOGIN', '1');
    expect(devAdminLoginEnabled()).toBe(true);
    expect(decodeSession(cookie)?.role).toBe('admin');
    vi.stubEnv('NODE_ENV', 'production');
    expect(decodeSession(cookie)).toBeNull();
  });
});
