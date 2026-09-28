import {z} from 'zod';

const translation = z.object({title: z.string().trim().min(1).max(120), description: z.string().trim().max(5000)}).strict();
export const productInput = z.object({
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  category: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().min(0).max(100000),
  imagePath: z.string().regex(/^\/product-images\/[a-zA-Z0-9_-]+\.(png|jpg|webp)$/).or(z.literal('')),
  active: z.boolean(),
  vi: translation, en: translation,
  packages: z.array(z.object({
    sku: z.string().trim().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),
    baseUsdCents: z.number().int().min(1).max(100000000),
    saleUsdCents: z.number().int().min(1).max(100000000).nullable(),
    stockOnHand: z.number().int().min(0).max(100000000), active: z.boolean(),
    vi: translation, en: translation,
    fields: z.array(z.object({key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(40), labelVi: z.string().trim().min(1).max(100), labelEn: z.string().trim().min(1).max(100), required: z.boolean(), maxLength: z.number().int().min(1).max(1000)}).strict()).max(20)
  }).strict().refine(p => p.saleUsdCents === null || p.saleUsdCents <= p.baseUsdCents, 'Sale price must not exceed base price')).min(1).max(30)
}).strict().refine(v => new Set(v.packages.map(p => p.sku.toLowerCase())).size === v.packages.length, 'Duplicate SKU').refine(v => v.packages.every(p => new Set(p.fields.map(f => f.key)).size === p.fields.length), 'Duplicate delivery field key');