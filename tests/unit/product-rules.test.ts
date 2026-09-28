import {describe, expect, it} from 'vitest';
import {productInput} from '../../src/lib/product-rules';

const valid = {slug: 'sample-item', category: 'general', sortOrder: 0, imagePath: '', active: false, vi: {title: 'Mẫu', description: ''}, en: {title: 'Sample', description: ''}, packages: [{sku: 'SAMPLE-1', baseUsdCents: 1000, saleUsdCents: 900, stockOnHand: 0, active: true, vi: {title: 'Gói', description: ''}, en: {title: 'Package', description: ''}, fields: [{key: 'recipient', labelVi: 'Người nhận', labelEn: 'Recipient', required: true, maxLength: 80}]}]};

describe('product input', () => {
  it('accepts a valid bilingual package', () => expect(productInput.safeParse(valid).success).toBe(true));
  it('rejects sale price above base price', () => expect(productInput.safeParse({...valid, packages: [{...valid.packages[0], saleUsdCents: 1001}]}).success).toBe(false));
  it('rejects duplicate SKUs', () => expect(productInput.safeParse({...valid, packages: [valid.packages[0], valid.packages[0]]}).success).toBe(false));
  it('rejects remote image URLs', () => expect(productInput.safeParse({...valid, imagePath: 'https://example.com/p.png'}).success).toBe(false));
});