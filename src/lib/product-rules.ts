import {z} from 'zod';
import {legacyProductImagePathPattern, productImagePathPattern} from './product-image';

const translation = z.object({title: z.string().trim().min(1).max(120), description: z.string().trim().max(5000)}).strict();
export const productInput = z.object({
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(100000),
  imagePath: z.string().refine(value => value === '' || legacyProductImagePathPattern.test(value) || productImagePathPattern.test(value), 'Invalid product image path'),
  active: z.boolean(),
  en: translation,
  packages: z.array(z.object({
    sku: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
    priceVnd: z.number().int().min(1000, 'Price must be at least 1,000 VND').max(1_000_000_000),
    salePriceVnd: z.number().int().min(1000).max(1_000_000_000).nullable(),
    stockOnHand: z.number().int().min(0).max(100000000), active: z.boolean(),
    en: translation,
    fields: z.array(z.object({key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(40), labelEn: z.string().trim().min(1).max(100), required: z.boolean(), maxLength: z.number().int().min(1).max(1000)}).strict()).max(20)
  }).strict().refine(p => p.salePriceVnd === null || p.salePriceVnd <= p.priceVnd, 'Sale price must not exceed base price')).min(1).max(30)
}).strict().refine(v => new Set(v.packages.map(p => p.sku.toLowerCase())).size === v.packages.length, 'Duplicate SKU').refine(v => v.packages.every(p => new Set(p.fields.map(f => f.key)).size === p.fields.length), 'Duplicate delivery field key');
