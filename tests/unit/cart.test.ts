import {describe, expect, it} from 'vitest';
import {cartSchema, createCartSchema, totalUsdCents} from '../../src/lib/cart';
import type {CatalogProduct} from '../../src/lib/catalog';
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
  it('validates and prices a configured catalog package', () => {
    const configured: CatalogProduct = {
      id: 'package-db-1', sourceProductId: 'product-db-1', slug: 'configured-product', sku: 'CONFIGURED_1', category: 'general', imagePath: '',
      usdCents: 1234, baseUsdCents: 1500, saleUsdCents: 1234, stock: 3,
      title: {en: 'Configured package'}, description: {en: 'Database catalog test'},
      fields: [{key: 'account_name', labelEn: 'Account name', required: true, maxLength: 12}]
    };
    const lines = [{productId: configured.id, quantity: 2, delivery: {account_name: 'Demo'}}];
    expect(createCartSchema([configured]).safeParse(lines).success).toBe(true);
    expect(totalUsdCents(lines, [configured])).toBe(2468);
    expect(createCartSchema([configured]).safeParse([{...lines[0], quantity: 4}]).success).toBe(false);
    expect(createCartSchema([configured]).safeParse([{...lines[0], delivery: {account_name: 'Too long for field'}}]).success).toBe(false);
  });
});
