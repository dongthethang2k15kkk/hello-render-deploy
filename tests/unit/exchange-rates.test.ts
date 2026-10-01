import {describe, expect, it} from 'vitest';
import {formatLtcEstimate, isRateMode, parseCoingeckoVndPerLtc, parseCurrencyApiVnd, validVndPerLtc, vndPerLtcFromBinance} from '../../src/lib/exchange-rate-rules';

describe('exchange rate parsing', () => {
  it('reads VND per USD from currency-api and rejects broken values', () => {
    expect(parseCurrencyApiVnd({date: '2026-09-30', usd: {vnd: 25934.41429442}})).toBe(25934.41429442);
    expect(parseCurrencyApiVnd({usd: {vnd: 0}})).toBeNull();
    expect(parseCurrencyApiVnd({usd: {vnd: 2_593_441}})).toBeNull();
    expect(parseCurrencyApiVnd({usd: {vnd: '25934'}})).toBeNull();
    expect(parseCurrencyApiVnd(null)).toBeNull();
  });

  it('reads the Litecoin price from CoinGecko and Binance', () => {
    expect(parseCoingeckoVndPerLtc({litecoin: {vnd: 1741197, usd: 67.03}})).toBe(1741197);
    expect(parseCoingeckoVndPerLtc({litecoin: {}})).toBeNull();
    expect(parseCoingeckoVndPerLtc({error: 'rate limited'})).toBeNull();
    expect(vndPerLtcFromBinance({symbol: 'LTCUSDT', price: '66.99000000'}, 26000)).toBeCloseTo(1_741_740);
    expect(vndPerLtcFromBinance({price: 'oops'}, 26000)).toBeNull();
    expect(vndPerLtcFromBinance({price: '-1'}, 26000)).toBeNull();
  });

  it('validates modes and fixed prices', () => {
    expect(isRateMode('auto')).toBe(true);
    expect(isRateMode('fixed')).toBe(true);
    expect(isRateMode('manual')).toBe(false);
    expect(validVndPerLtc(1_745_000)).toBe(true);
    expect(validVndPerLtc(999)).toBe(false);
    expect(validVndPerLtc(1.5e6 + 0.5)).toBe(false);
  });
});

describe('LTC estimates in the store', () => {
  it('shows four significant digits', () => {
    expect(formatLtcEstimate(650_000, 2_000_000)).toBe('0.325 LTC');
    expect(formatLtcEstimate(26_000, 1_741_197)).toBe('0.01493 LTC');
    expect(formatLtcEstimate(5_000_000, 1_741_197)).toBe('2.872 LTC');
  });

  it('shows nothing without a usable price', () => {
    expect(formatLtcEstimate(650_000, 0)).toBe('');
    expect(formatLtcEstimate(0, 2_000_000)).toBe('');
  });
});
