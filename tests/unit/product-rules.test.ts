import {describe, expect, it} from 'vitest';
import {productInput} from '../../src/lib/product-rules';

const valid = {slug: 'sample-item', category: 'general', sortOrder: 0, imagePath: '', active: false, en: {title: 'Sample', description: ''}, packages: [{sku: 'SAMPLE-1', baseUsdCents: 1000, saleUsdCents: 900, stockOnHand: 0, active: true, en: {title: 'Package', description: ''}, fields: [{key: 'recipient', labelEn: 'Recipient', required: true, maxLength: 80}]}]};

describe('product input', () => {
  it('accepts a valid English package', () => expect(productInput.safeParse(valid).success).toBe(true));
  it('rejects legacy Vietnamese fields', () => expect(productInput.safeParse({...valid, vi: {title: 'x', description: ''}}).success).toBe(false));
  it('rejects sale price above base price', () => expect(productInput.safeParse({...valid, packages: [{...valid.packages[0], saleUsdCents: 1001}]}).success).toBe(false));
  it('rejects duplicate SKUs', () => expect(productInput.safeParse({...valid, packages: [valid.packages[0], valid.packages[0]]}).success).toBe(false));
  it('rejects remote image URLs', () => expect(productInput.safeParse({...valid, imagePath: 'https://example.com/p.png'}).success).toBe(false));
});