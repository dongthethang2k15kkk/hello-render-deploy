import {describe, expect, it} from 'vitest';
import {cleanPaypalUsername, defaultPaypalSettings, PAYPAL_USERNAME, paypalAmount, paypalBaseCents, paypalMeLink, paypalReady, paypalSettingsSchema} from '../../src/lib/paypal';
import {reportSchema, paymentKind} from '../../src/lib/order-rules';
import {formatCents, uniqueCents} from '../../src/lib/unique-cents';

const noFee = {feePercent: 0, feeFixedCents: 0};

describe('PayPal.me link', () => {
  it('puts the exact USD amount in the link', () => {
    expect(paypalMeLink('jewishhorse', '12.34')).toBe('https://paypal.me/jewishhorse/12.34USD');
  });

  it('accepts only 1–20 letters and digits as a PayPal.me name', () => {
    for (const ok of ['a', 'JewishHorse', 'abc123', 'a'.repeat(20)]) expect(PAYPAL_USERNAME.test(ok)).toBe(true);
    for (const bad of ['', 'a'.repeat(21), 'has space', 'dot.name', 'a/b', 'tên', '-dash']) expect(PAYPAL_USERNAME.test(bad)).toBe(false);
  });

  it('cleans pasted links down to the name', () => {
    expect(cleanPaypalUsername('  https://www.paypal.me/jewishhorse/5USD ')).toBe('jewishhorse');
    expect(cleanPaypalUsername('paypal.me/jewishhorse')).toBe('jewishhorse');
    expect(cleanPaypalUsername('@jewishhorse')).toBe('jewishhorse');
    expect(cleanPaypalUsername('jewishhorse')).toBe('jewishhorse');
  });

  it('is offered only when switched on with a valid name', () => {
    expect(paypalReady(defaultPaypalSettings)).toBe(false);
    expect(paypalReady({...defaultPaypalSettings, enabled: true})).toBe(false);
    expect(paypalReady({...defaultPaypalSettings, username: 'shop'})).toBe(false);
    expect(paypalReady({...defaultPaypalSettings, enabled: true, username: 'shop'})).toBe(true);
    expect(paypalReady(null)).toBe(false);
  });

  it('validates stored settings', () => {
    expect(paypalSettingsSchema.safeParse(defaultPaypalSettings).success).toBe(true);
    expect(paypalSettingsSchema.safeParse({...defaultPaypalSettings, feePercent: 16}).success).toBe(false);
    expect(paypalSettingsSchema.safeParse({...defaultPaypalSettings, feeFixedCents: 501}).success).toBe(false);
    expect(paypalSettingsSchema.safeParse({...defaultPaypalSettings, instructions: 'x'.repeat(501)}).success).toBe(false);
  });
});

describe('PayPal amount', () => {
  it('rounds the USD price up to the cent', () => {
    expect(paypalAmount(96_000, 25_934, noFee, new Set())).toBe('3.71');
    expect(paypalAmount(910_000, 25_934, noFee, new Set())).toBe('35.09');
    expect(paypalAmount(1, 25_934, noFee, new Set())).toBe('0.01');
  });

  it('adds the percentage fee rounded up, then the fixed fee', () => {
    // 100 USD base: 4.4% = 4.40, plus $0.30.
    expect(paypalBaseCents(2_600_000, 26_000, {feePercent: 4.4, feeFixedCents: 30})).toBe(10_000 + 440 + 30);
    // 3.71 USD at 3% = 11.13 cents, rounded up to 12.
    expect(paypalAmount(96_000, 25_934, {feePercent: 3, feeFixedCents: 0}, new Set())).toBe('3.83');
    expect(paypalAmount(96_000, 25_934, {feePercent: 0, feeFixedCents: 50}, new Set())).toBe('4.21');
  });

  it('keeps each open order distinct by its cents', () => {
    expect(paypalAmount(96_000, 25_934, noFee, new Set(['3.71']))).toBe('3.72');
    expect(paypalAmount(96_000, 25_934, noFee, new Set(['3.71', '3.72', '3.74']))).toBe('3.73');
  });

  it('refuses when a hundred amounts in a row are taken', () => {
    const taken = new Set(Array.from({length: 100}, (_, index) => formatCents(371 + index)));
    expect(() => paypalAmount(96_000, 25_934, noFee, taken)).toThrow();
  });
});

describe('unique cents helper', () => {
  it('returns the first free amount at or above the base, and null when none is free', () => {
    expect(uniqueCents(371, new Set())).toBe(371);
    expect(uniqueCents(371, new Set(['3.71', '3.72']))).toBe(373);
    expect(uniqueCents(371, new Set(Array.from({length: 100}, (_, index) => formatCents(371 + index))))).toBeNull();
  });
});

describe('PayPal in orders', () => {
  it('tells the payment kind by method, not by snapshot shape', () => {
    expect(paymentKind({paymentMethod: 'paypal'})).toBe('paypal');
    expect(paymentKind({paymentMethod: 'ltc'})).toBe('crypto');
    expect(paymentKind({paymentMethod: 'usdt'})).toBe('crypto');
    expect(paymentKind({paymentMethod: 'bank'})).toBe('bank');
  });

  it('accepts a 17-character PayPal transaction ID, kept in capitals', () => {
    expect(reportSchema.parse({paypalTxid: ' 5ab12cd34ef567890 '}).paypalTxid).toBe('5AB12CD34EF567890');
    expect(reportSchema.parse({paypalTxid: ''}).paypalTxid).toBeUndefined();
    expect(reportSchema.safeParse({paypalTxid: 'short'}).success).toBe(false);
    expect(reportSchema.safeParse({paypalTxid: '5AB12CD34EF56789!'}).success).toBe(false);
  });
});
