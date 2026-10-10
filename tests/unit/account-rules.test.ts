import {describe, expect, it} from 'vitest';
import {accountCodePattern, deleteProblem, effectivePrice, generateAccountCode, needsAppointment, releasedStatus, statusProblem} from '../../src/lib/account-rules';
import {open, seal} from '../../src/lib/secret-box';

const ready = {status: 'draft', priceVnd: 5_000_000, salePriceVnd: null, hasLogin: true};

describe('account status rules', () => {
  it('lets an Admin move freely between draft, available and hidden', () => {
    for (const from of ['draft', 'available', 'hidden']) for (const to of ['draft', 'available', 'hidden']) expect(statusProblem({...ready, status: from}, to)).toBeNull();
  });

  it('never lets an Admin touch a reserved or sold account', () => {
    expect(statusProblem({...ready, status: 'reserved'}, 'hidden')).toContain('unpaid order');
    expect(statusProblem({...ready, status: 'sold'}, 'available')).toBe('This account is sold.');
  });

  it('only goes on sale with login details, a price and a sensible sale price', () => {
    expect(statusProblem({...ready, hasLogin: false}, 'available')).toContain('login details');
    expect(statusProblem({...ready, priceVnd: 0}, 'available')).toContain('price');
    expect(statusProblem({...ready, salePriceVnd: 5_000_000}, 'available')).toContain('sale price');
    expect(statusProblem({...ready, salePriceVnd: 4_000_000}, 'available')).toBeNull();
    // Drafts may be incomplete.
    expect(statusProblem({...ready, hasLogin: false, priceVnd: 0}, 'draft')).toBeNull();
  });

  it('refuses statuses that only orders may set', () => {
    expect(statusProblem(ready, 'sold')).toContain('Draft, Available or Hidden');
    expect(statusProblem(ready, 'reserved')).toContain('Draft, Available or Hidden');
  });

  it('never puts an account whose login was handed over back on sale', () => {
    expect(releasedStatus(false)).toBe('available');
    expect(releasedStatus(true)).toBe('hidden');
  });

  it('keeps accounts that were ever in an order', () => {
    expect(deleteProblem({status: 'draft', orderId: null}, false)).toBeNull();
    expect(deleteProblem({status: 'available', orderId: null}, false)).toBeNull();
    expect(deleteProblem({status: 'reserved', orderId: 'o1'}, true)).toContain('Hide it');
    expect(deleteProblem({status: 'sold', orderId: 'o1'}, true)).toContain('Hide it');
    expect(deleteProblem({status: 'hidden', orderId: null}, true)).toContain('Hide it');
  });
});

describe('account prices and codes', () => {
  it('charges the sale price only when it is lower', () => {
    expect(effectivePrice({priceVnd: 100, salePriceVnd: null})).toBe(100);
    expect(effectivePrice({priceVnd: 100, salePriceVnd: 80})).toBe(80);
    expect(effectivePrice({priceVnd: 100, salePriceVnd: 120})).toBe(100);
  });

  it('makes SB codes without look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(generateAccountCode()).toMatch(accountCodePattern);
    expect(accountCodePattern.test('SB0O1I2')).toBe(false);
    expect(accountCodePattern.test('JH234567')).toBe(false);
  });

  it('skips the appointment only when every line is an account', () => {
    expect(needsAppointment([{kind: 'account'}])).toBe(false);
    expect(needsAppointment([{kind: 'account'}, {kind: 'account'}])).toBe(false);
    expect(needsAppointment([{kind: 'package'}])).toBe(true);
    expect(needsAppointment([{kind: 'account'}, {kind: 'package'}])).toBe(true);
  });
});

describe('sealed login details', () => {
  const text = 'Email: me@example.test\nPassword: s3cret ✓';

  it('round-trips and never stores the plain text', () => {
    const sealed = seal(text, 'auth-secret', 'game-account-login');
    expect(sealed).not.toContain('s3cret');
    expect(open(sealed, 'auth-secret', 'game-account-login')).toBe(text);
    expect(seal(text, 'auth-secret', 'game-account-login')).not.toBe(sealed);
  });

  it('cannot be opened with another AUTH_SECRET, another purpose, or when damaged', () => {
    const sealed = seal(text, 'auth-secret', 'game-account-login');
    expect(open(sealed, 'other-secret', 'game-account-login')).toBeNull();
    expect(open(sealed, 'auth-secret', 'hypixel-api-key')).toBeNull();
    expect(open(sealed.slice(0, -2), 'auth-secret', 'game-account-login')).toBeNull();
    expect(open('', 'auth-secret', 'game-account-login')).toBeNull();
    expect(open('not.sealed', 'auth-secret', 'game-account-login')).toBeNull();
  });
});
