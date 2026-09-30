import {describe, expect, it} from 'vitest';
import {findLtcPayment} from '../../src/lib/payment-match';

describe('Litecoin payment matching', () => {
  const address = 'ltc1qshop';
  const orderTime = new Date('2026-09-30T02:00:00Z');
  const tx = (txid: string, value: number, status: {confirmed: boolean; block_height?: number; block_time?: number}, to = address) => ({txid, status, vout: [{scriptpubkey_address: to, value}]});
  it('matches the exact unique amount and counts confirmations', () => {
    const txs = [tx('other', 32500002, {confirmed: false}), tx('mine', 32500001, {confirmed: true, block_height: 100, block_time: orderTime.getTime() / 1000 + 60})];
    expect(findLtcPayment(txs, address, BigInt(32500001), orderTime, 101)).toEqual({txid: 'mine', confirmations: 2});
  });
  it('sees unconfirmed payments with zero confirmations', () => {
    expect(findLtcPayment([tx('pending', 32500001, {confirmed: false})], address, BigInt(32500001), orderTime, 101)).toEqual({txid: 'pending', confirmations: 0});
  });
  it('ignores other addresses, other amounts and payments from before the order', () => {
    expect(findLtcPayment([tx('elsewhere', 32500001, {confirmed: false}, 'ltc1qother')], address, BigInt(32500001), orderTime, 101)).toBeNull();
    expect(findLtcPayment([tx('rounded', 32500000, {confirmed: false})], address, BigInt(32500001), orderTime, 101)).toBeNull();
    expect(findLtcPayment([tx('old', 32500001, {confirmed: true, block_height: 50, block_time: orderTime.getTime() / 1000 - 3600})], address, BigInt(32500001), orderTime, 101)).toBeNull();
  });
});
