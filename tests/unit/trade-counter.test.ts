import {describe, expect, it} from 'vitest';
import {completedTradeTotal, parseTradeCounterSettings, tradeCounterSchema} from '../../src/lib/trade-counter-rules';

describe('completed trade counter', () => {
  it('adds the Admin-entered historical count to completed shop orders', () => {
    expect(completedTradeTotal(1250, 37)).toBe(1287);
  });

  it('defaults invalid saved settings safely to zero', () => {
    expect(parseTradeCounterSettings(undefined)).toEqual({historicalCompleted: 0});
    expect(parseTradeCounterSettings({historicalCompleted: -1})).toEqual({historicalCompleted: 0});
  });

  it('accepts only a non-negative whole-number historical count', () => {
    expect(tradeCounterSchema.safeParse({historicalCompleted: 5000}).success).toBe(true);
    expect(tradeCounterSchema.safeParse({historicalCompleted: 1.5}).success).toBe(false);
    expect(tradeCounterSchema.safeParse({historicalCompleted: 100_000_001}).success).toBe(false);
  });
});
