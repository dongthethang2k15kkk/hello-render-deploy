import {describe, expect, it} from 'vitest';
import {amountSliderSchema, defaultAmountSlider, snapAmount, stockText, UNLIMITED_STOCK} from '../../src/lib/amount-slider-rules';
import {explorerTx, isCrypto, reportSchema, timingSchema} from '../../src/lib/order-rules';

const later = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

describe('choosing the time before paying', () => {
  it('requires times at checkout but lets "I\u2019ve paid" reuse them', () => {
    expect(timingSchema.safeParse({timeZone: 'Europe/Berlin', slots: []}).success).toBe(false);
    expect(timingSchema.safeParse({timeZone: 'Europe/Berlin', slots: [{start: later(2), end: later(3)}], asap: true}).success).toBe(true);
    expect(reportSchema.safeParse({}).success).toBe(true);
    expect(reportSchema.safeParse({txid: 'a'.repeat(64)}).success).toBe(true);
    expect(reportSchema.safeParse({slots: []}).success).toBe(false);
  });
});

describe('crypto methods', () => {
  it('knows Litecoin and USDT only, and links each to its explorer', () => {
    expect(isCrypto('ltc')).toBe(true);
    expect(isCrypto('usdt')).toBe(true);
    expect(isCrypto('bank')).toBe(false);
    expect(isCrypto('toString')).toBe(false);
    expect(explorerTx('usdt', 'ab')).toBe('https://tronscan.org/#/transaction/ab');
    expect(explorerTx('ltc', 'ab')).toBe('https://litecoinspace.org/tx/ab');
  });
});

describe('amount slider', () => {
  const slider = {...defaultAmountSlider, min: 10, max: 1000, step: 10};
  it('snaps to steps inside the range and the stock', () => {
    expect(snapAmount(254, slider)).toBe(250);
    expect(snapAmount(3, slider)).toBe(10);
    expect(snapAmount(5000, slider)).toBe(1000);
    expect(snapAmount(900, slider, 400)).toBe(400);
    expect(snapAmount(Number.NaN, slider)).toBe(10);
  });
  it('rejects ranges that do not make sense and needs a package when on', () => {
    expect(amountSliderSchema.safeParse({...slider, min: 500, max: 100}).success).toBe(false);
    expect(amountSliderSchema.safeParse({...slider, defaultAmount: 5}).success).toBe(false);
    expect(amountSliderSchema.safeParse({...slider, enabled: true, packageId: ''}).success).toBe(false);
    expect(amountSliderSchema.safeParse({...slider, enabled: true, packageId: 'pkg1'}).success).toBe(true);
  });
  it('counts amounts in units when one package holds many (300 M coins = 3 × 100M)', () => {
    const coins = {...slider, unitSize: 100, min: 100, max: 10000, step: 100, defaultAmount: 300};
    expect(amountSliderSchema.safeParse(coins).success).toBe(true);
    expect(amountSliderSchema.safeParse({...coins, step: 50}).success).toBe(false);
    expect(snapAmount(260, coins)).toBe(300);
    expect(snapAmount(5000, coins, 10)).toBe(1000);
    expect(amountSliderSchema.parse({...slider, unitSize: undefined}).unitSize).toBe(1);
  });
  it('reads very large stock as always available', () => {
    expect(stockText(UNLIMITED_STOCK)).toBe('Always in stock');
    expect(stockText(3)).toBe('3 currently available');
    expect(stockText(0)).toBe('Currently out of stock');
  });
});
