import {describe, expect, it} from 'vitest';
import {findUsdtPayment, USDT_TRC20_CONTRACT, usdtAmount, usdtToMicro, validTronAddress} from '../../src/lib/usdt';

describe('USDT on TRON', () => {
  it('accepts real TRON addresses and rejects typos and other networks', () => {
    expect(validTronAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(true);
    expect(validTronAddress('TNXoiAJ3dct8Fjg4M9fkLFh9S2v9TXc32G')).toBe(true);
    expect(validTronAddress('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toBe(false);
    expect(validTronAddress('LTC1qxyz')).toBe(false);
    expect(validTronAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(false);
  });

  it('rounds up to the cent and keeps each open order distinct', () => {
    expect(usdtAmount(96_000, 25_934, new Set())).toBe('3.71');
    expect(usdtAmount(96_000, 25_934, new Set(['3.71']))).toBe('3.72');
    expect(usdtAmount(96_000, 25_934, new Set(['3.71', '3.72', '3.74']))).toBe('3.73');
    expect(usdtAmount(910_000, 25_934, new Set())).toBe('35.09');
  });

  it('converts amounts to micro-USDT exactly', () => {
    expect(usdtToMicro('3.71')).toBe(BigInt(3_710_000));
    expect(usdtToMicro('35')).toBe(BigInt(35_000_000));
    expect(usdtToMicro('1.2345678')).toBeNull();
  });

  it('finds only the exact USDT transfer to the address after the order', () => {
    const order = new Date('2026-10-03T10:00:00Z');
    const base = {to: 'TAddr', token_info: {address: USDT_TRC20_CONTRACT}, block_timestamp: order.getTime() + 60_000};
    const transfers = [
      {...base, transaction_id: 'old', value: '3710000', block_timestamp: order.getTime() - 10 * 60_000},
      {...base, transaction_id: 'other-token', value: '3710000', token_info: {address: 'TOtherToken'}},
      {...base, transaction_id: 'wrong-amount', value: '3700000'},
      {...base, transaction_id: 'match', value: '3710000'}
    ];
    expect(findUsdtPayment(transfers, 'TAddr', '3.71', order)).toEqual({txid: 'match'});
    expect(findUsdtPayment(transfers, 'TOther', '3.71', order)).toBeNull();
  });
});
