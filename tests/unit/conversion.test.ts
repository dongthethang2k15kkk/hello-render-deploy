import {describe, expect, it} from 'vitest';
import {amountSliderSchema, autoSlider, defaultAmountSlider, formatUnits, lineAmount, snapAmount, stockText, titleAmount} from '../../src/lib/amount-slider-rules';
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
  it('never shows the stock count to customers', () => {
    expect(stockText(100_000_000)).toBe('Available');
    expect(stockText(3)).toBe('Available');
    expect(stockText(0)).toBe('Out of stock');
  });
  it('reads amounts from package names and writes them the way players do', () => {
    expect(titleAmount('100M · COINS SKYBLOCK HYPIXEL')).toEqual({value: 100, unit: 'M'});
    expect(titleAmount('1B · COINS')).toEqual({value: 1, unit: 'B'});
    expect(titleAmount('Basic sample package')).toBeNull();
    expect(formatUnits(300, 'M coins')).toBe('300M coins');
    expect(formatUnits(1500, 'M coins')).toBe('1.5B coins');
    expect(formatUnits(3, 'packs')).toBe('3 packs');
    expect(lineAmount('100M · COINS SKYBLOCK HYPIXEL', 3)).toBe('300M');
    expect(lineAmount('Basic sample package', 2)).toBe('Basic sample package × 2');
  });
  it('sets the slider up from the catalog until an Admin saves one', () => {
    const products = [{id: 'b', title: {en: '1B · COINS SKYBLOCK HYPIXEL'}, stock: 10}, {id: 'm', title: {en: '100M · COINS SKYBLOCK HYPIXEL'}, stock: 99}];
    expect(autoSlider(products)).toMatchObject({enabled: true, packageId: 'm', unitLabel: 'M coins', unitSize: 100, min: 100, max: 10000, step: 100, defaultAmount: 300});
    expect(amountSliderSchema.safeParse(autoSlider(products)).success).toBe(true);
    expect(autoSlider([{id: 'x', title: {en: 'Basic sample package'}, stock: 5}])).toBeNull();
  });
});
