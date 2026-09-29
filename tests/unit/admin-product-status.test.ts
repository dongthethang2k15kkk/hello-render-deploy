import {describe, expect, it} from 'vitest';
import {productSlug, storefrontStatus} from '../../src/lib/admin-product-status';

const pkg = (active: boolean, stockOnHand: number) => ({active, stockOnHand});

describe('storefront status', () => {
  it('is hidden when the product switch is off', () => expect(storefrontStatus({active: false, packages: [pkg(true, 5)]}).tone).toBe('hidden'));
  it('is not in store when no package is available', () => expect(storefrontStatus({active: true, packages: [pkg(false, 5)]}).label).toBe('Not in store'));
  it('warns when every available package is out of stock', () => expect(storefrontStatus({active: true, packages: [pkg(true, 0), pkg(false, 9)]}).label).toBe('In store · out of stock'));
  it('is live with an available package in stock', () => expect(storefrontStatus({active: true, packages: [pkg(true, 3), pkg(false, 0)]})).toMatchObject({tone: 'live', detail: '1 of 2 packages available to customers.'}));
});

describe('product slug', () => {
  it('keeps Vietnamese letters readable', () => expect(productSlug('Khánh Vy')).toBe('khanh-vy'));
  it('maps đ and trims separators', () => expect(productSlug('  Đồ chơi — Gói #1!  ')).toBe('do-choi-goi-1'));
  it('never ends with a hyphen after truncation', () => expect(productSlug(`${'a'.repeat(99)} b`)).toBe('a'.repeat(99)));
});
