import {describe, expect, it} from 'vitest';
import {cartSchema, totalUsdCents} from '../../src/lib/cart';
const basic = {productId: 'sample-basic', quantity: 2, delivery: {recipient: 'Test'}};
describe('demo cart validation and server-side prices', () => {
  it('calculates a mixed cart in integer USD cents', () => {
    expect(totalUsdCents([basic, {productId: 'sample-plus', quantity: 1, delivery: {recipient: 'Test', note: ''}}])).toBe(4500);
  });
  it('rejects unknown products', () => {
    expect(cartSchema.safeParse([{...basic, productId: 'unknown'}]).success).toBe(false);
  });
  it.each([0, -1, 1.5, 6])('rejects quantity %s', quantity => {
    expect(cartSchema.safeParse([{...basic, quantity}]).success).toBe(false);
  });
  it('rejects aggregate quantities above stock', () => {
    expect(cartSchema.safeParse([{...basic, quantity: 3}, {...basic, quantity: 3}]).success).toBe(false);
  });
  it('requires a nonempty recipient', () => {
    expect(cartSchema.safeParse([{...basic, delivery: {recipient: '  '}}]).success).toBe(false);
  });
  it('rejects unknown fields and client-supplied prices', () => {
    expect(cartSchema.safeParse([{...basic, delivery: {recipient: 'Test', password: 'secret'}}]).success).toBe(false);
    expect(cartSchema.safeParse([{...basic, usdCents: 1}]).success).toBe(false);
  });
  it('handles empty carts', () => {expect(totalUsdCents([])).toBe(0);});
});