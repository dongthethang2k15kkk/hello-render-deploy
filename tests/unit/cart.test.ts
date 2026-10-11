import {accountCatalogLine} from '../../src/lib/account-card';
import {describe, expect, it} from 'vitest';
import {cartSchema, createCartSchema, totalVnd} from '../../src/lib/cart';
import type {CatalogProduct} from '../../src/lib/catalog';
const basic = {productId: 'sample-basic', quantity: 2, delivery: {recipient: 'Test'}};
describe('demo cart validation and server-side prices', () => {
  it('calculates a mixed cart in whole VND', () => {
    expect(totalVnd([basic, {productId: 'sample-plus', quantity: 1, delivery: {recipient: 'Test', note: ''}}])).toBe(1170000);
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
    expect(cartSchema.safeParse([{...basic, priceVnd: 1}]).success).toBe(false);
  });
  it('handles empty carts', () => {expect(totalVnd([])).toBe(0);});
  it('validates and prices a configured catalog package', () => {
    const configured: CatalogProduct = {
      id: 'package-db-1', sourceProductId: 'product-db-1', slug: 'configured-product', sku: 'CONFIGURED_1', category: 'general', imagePath: '',
      priceVnd: 123000, basePriceVnd: 150000, salePriceVnd: 123000, stock: 3,
      title: {en: 'Configured package'}, description: {en: 'Database catalog test'},
      fields: [{key: 'account_name', labelEn: 'Account name', required: true, maxLength: 12}], kind: 'package', account: null
    };
    const lines = [{productId: configured.id, quantity: 2, delivery: {account_name: 'Demo'}}];
    expect(createCartSchema([configured]).safeParse(lines).success).toBe(true);
    expect(totalVnd(lines, [configured])).toBe(246000);
    expect(createCartSchema([configured]).safeParse([{...lines[0], quantity: 4}]).success).toBe(false);
    expect(createCartSchema([configured]).safeParse([{...lines[0], delivery: {account_name: 'Too long for field'}}]).success).toBe(false);
  });
  it('sells a game account once: quantity 2, a reserved account and a delivery form are refused', () => {
    const account = accountCatalogLine({id: 'acc1', code: 'SB234567', ign: 'Farmer', showIgn: false, profileName: 'Mango', imagePaths: [], status: 'available', stats: null, title: 'Farming 45', description: '', priceVnd: 5_000_000, salePriceVnd: null});
    const line = {productId: 'acc1', quantity: 1, delivery: {}};
    expect(account).toMatchObject({kind: 'account', stock: 1, fields: [], sku: 'SB234567', priceVnd: 5_000_000, salePriceVnd: null});
    expect(account.account.ign).toBeNull();
    expect(createCartSchema([account]).safeParse([line]).success).toBe(true);
    expect(totalVnd([line], [account])).toBe(5_000_000);
    expect(createCartSchema([account]).safeParse([{...line, quantity: 2}]).success).toBe(false);
    expect(createCartSchema([account]).safeParse([line, line]).success).toBe(false);
    expect(createCartSchema([account]).safeParse([{...line, delivery: {note: 'x'}}]).success).toBe(false);
    expect(createCartSchema([{...account, stock: 0}]).safeParse([line]).success).toBe(false);
  });
});
