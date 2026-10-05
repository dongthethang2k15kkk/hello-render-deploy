import {describe, expect, it} from 'vitest';
import {chooseWeightedPrize, DEFAULT_LUCKY_PRIZES} from '../../src/lib/lucky-wheel';

describe('lucky wheel weights', () => {
  it('maps every default weight boundary to the exact configured probability interval', () => {
    const cases = [
      [0, '5M coins'], [39, '5M coins'],
      [40, '10M coins'], [64, '10M coins'],
      [65, '50M coins'], [82, '50M coins'],
      [83, '100M coins'], [94, '100M coins'],
      [95, '500M coins'], [99, '500M coins']
    ] as const;
    for (const [roll, label] of cases) expect(chooseWeightedPrize(DEFAULT_LUCKY_PRIZES, roll).label).toBe(label);
  });

  it('ignores zero-weight prizes and treats weights as relative when they do not total 100', () => {
    const prizes = [{id: 'never', weight: 0}, {id: 'a', weight: 2}, {id: 'b', weight: 3}];
    expect(chooseWeightedPrize(prizes, 0).id).toBe('a');
    expect(chooseWeightedPrize(prizes, 1).id).toBe('a');
    expect(chooseWeightedPrize(prizes, 2).id).toBe('b');
    expect(chooseWeightedPrize(prizes, 4).id).toBe('b');
  });

  it('rejects an empty distribution and rolls outside its integer range', () => {
    expect(() => chooseWeightedPrize([{weight: 0}], 0)).toThrow('No active');
    expect(() => chooseWeightedPrize([{weight: 5}], 5)).toThrow(RangeError);
    expect(() => chooseWeightedPrize([{weight: 5}], 1.5)).toThrow(RangeError);
  });
});
