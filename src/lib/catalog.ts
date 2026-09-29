import {z} from 'zod';

export type Locale = 'en';

export const deliveryFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(40),
  labelEn: z.string().trim().min(1).max(100),
  required: z.boolean(),
  maxLength: z.number().int().min(1).max(1000)
}).strict();

export const catalogProductSchema = z.object({
  id: z.string().min(1),
  sourceProductId: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string().min(1),
  category: z.string(),
  imagePath: z.string(),
  usdCents: z.number().int().positive(),
  baseUsdCents: z.number().int().positive(),
  saleUsdCents: z.number().int().positive().nullable(),
  stock: z.number().int().min(0),
  title: z.object({en: z.string().min(1)}),
  description: z.object({en: z.string()}),
  fields: z.array(deliveryFieldSchema)
}).strict();

export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type CatalogSource = 'database' | 'demo' | 'fallback';
export const catalogResponseSchema = z.object({products: z.array(catalogProductSchema), source: z.enum(['database', 'demo', 'fallback'])});

export const fallbackProducts: CatalogProduct[] = [
  {
    id: 'sample-basic', sourceProductId: 'sample-basic', slug: 'sample-basic', sku: 'SAMPLE_BASIC', category: 'demo', imagePath: '',
    usdCents: 1000, baseUsdCents: 1000, saleUsdCents: null, stock: 5,
    title: {en: 'Basic sample package'},
    description: {en: 'Test data for the shopping flow. This is not an offered service.'},
    fields: [{key: 'recipient', labelEn: 'Recipient name (test data)', required: true, maxLength: 80}]
  },
  {
    id: 'sample-plus', sourceProductId: 'sample-plus', slug: 'sample-plus', sku: 'SAMPLE_PLUS', category: 'demo', imagePath: '',
    usdCents: 2500, baseUsdCents: 2500, saleUsdCents: null, stock: 5,
    title: {en: 'Extended sample package'},
    description: {en: 'Demonstrates a different delivery form. Payment is unavailable.'},
    fields: [{key: 'recipient', labelEn: 'Recipient name (test data)', required: true, maxLength: 80}, {key: 'note', labelEn: 'Delivery note (no sensitive information)', required: false, maxLength: 300}]
  }
];

// Backward-compatible demo export for unit tests and payment staging without a database.
export const products = fallbackProducts;

export function usd(cents: number, locale: Locale) {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
}
