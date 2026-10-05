import {describe, expect, it, vi} from 'vitest';
import type {Prisma} from '@prisma/client';
import {coinsFromOrderItems, coinsFromTitle, creditCoins} from '../../src/lib/coin-ledger';
import {formatCoins, formatCompactCoins} from '../../src/lib/coin-format';

describe('coin amounts', () => {
  it('reads K/M/B/T package names and applies quantity exactly', () => {
    expect(coinsFromTitle('100M · Skyblock coins', 3)).toBe(BigInt(300_000_000));
    expect(coinsFromTitle('1.5B coins', 2)).toBe(BigInt(3_000_000_000));
    expect(coinsFromTitle('0.5K coins', 3)).toBe(BigInt(1_500));
    expect(coinsFromTitle('2T coins', 1)).toBe(BigInt(2_000_000_000_000));
  });

  it('does not infer coins from unrelated or invalid order lines', () => {
    expect(coinsFromTitle('Package with 100M coins', 1)).toBe(BigInt(0));
    expect(coinsFromTitle('100M coins', 0)).toBe(BigInt(0));
    expect(coinsFromOrderItems([{title: '100M coins', quantity: 2}, {title: 'Bonus pack', quantity: 4}])).toBe(BigInt(200_000_000));
  });

  it('formats exact and compact balances without converting them to Number', () => {
    expect(formatCoins('1234567890')).toBe('1,234,567,890 coins');
    expect(formatCompactCoins('1234567890')).toBe('1.2B');
    expect(formatCompactCoins('5000000')).toBe('5M');
  });
});

describe('coin ledger idempotency', () => {
  it('increments the balance only when the source row was inserted', async () => {
    const createMany = vi.fn().mockResolvedValueOnce({count: 1}).mockResolvedValueOnce({count: 0});
    const update = vi.fn().mockResolvedValue({});
    const tx = {coinLedger: {createMany}, customer: {update}} as unknown as Prisma.TransactionClient;
    const input = {customerId: 'customer-1', amount: BigInt(100_000_000), kind: 'lucky_spin', sourceKey: 'lucky-spin:spin-1', spinId: 'spin-1'};

    expect(await creditCoins(tx, input)).toBe(true);
    expect(await creditCoins(tx, input)).toBe(false);
    expect(createMany).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
