import {z} from 'zod';
import {accountCardSchema} from './account-card';
import {defaultShelf, shelfSchema} from './accounts-shelf-rules';
import {DEFAULT_VND_PER_USD} from './money';

export type Locale = 'en';

export const deliveryFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/).max(40),
  labelEn: z.string().trim().min(1).max(100),
  required: z.boolean(),
  maxLength: z.number().int().min(1).max(1000)
}).strict();

// One purchasable package. Prices are whole VND; `priceVnd` is the effective (sale or base) price.
export const catalogProductSchema = z.object({
  id: z.string().min(1),
  sourceProductId: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string().min(1),
  category: z.string(),
  imagePath: z.string(),
  priceVnd: z.number().int().positive(),
  basePriceVnd: z.number().int().positive(),
  salePriceVnd: z.number().int().positive().nullable(),
  stock: z.number().int().min(0),
  title: z.object({en: z.string().min(1)}),
  description: z.object({en: z.string()}),
  fields: z.array(deliveryFieldSchema),
  // A game account for sale is one unit with its own card; packages keep the defaults.
  kind: z.enum(['package', 'account']).default('package'),
  account: accountCardSchema.nullable().default(null)
}).strict();

export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type CatalogSource = 'database' | 'demo' | 'fallback';
export const catalogResponseSchema = z.object({products: z.array(catalogProductSchema), source: z.enum(['database', 'demo', 'fallback']), vndPerUsd: z.number().int().positive(), vndPerLtc: z.number().int().positive().nullable().default(null), accounts: z.array(catalogProductSchema).default([]), shelf: shelfSchema.default(defaultShelf)});

export const fallbackProducts: CatalogProduct[] = [
  {
    id: 'sample-basic', sourceProductId: 'sample-basic', slug: 'sample-basic', sku: 'SAMPLE_BASIC', category: 'demo', imagePath: '',
    priceVnd: 260000, basePriceVnd: 260000, salePriceVnd: null, stock: 5,
    title: {en: 'Basic sample package'},
    description: {en: 'Test data for the shopping flow. This is not an offered service.'},
    fields: [{key: 'recipient', labelEn: 'Recipient name (test data)', required: true, maxLength: 80}], kind: 'package', account: null
  },
  {
    id: 'sample-plus', sourceProductId: 'sample-plus', slug: 'sample-plus', sku: 'SAMPLE_PLUS', category: 'demo', imagePath: '',
    priceVnd: 650000, basePriceVnd: 650000, salePriceVnd: null, stock: 5,
    title: {en: 'Extended sample package'},
    description: {en: 'Demonstrates a different delivery form.'},
    fields: [{key: 'recipient', labelEn: 'Recipient name (test data)', required: true, maxLength: 80}, {key: 'note', labelEn: 'Delivery note (no sensitive information)', required: false, maxLength: 300}], kind: 'package', account: null
  }
];
export const fallbackVndPerUsd = DEFAULT_VND_PER_USD;

// Backward-compatible export for unit tests without a database.
export const products = fallbackProducts;
