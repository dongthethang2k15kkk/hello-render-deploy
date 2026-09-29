import {z} from 'zod';
import {fallbackProducts, type CatalogProduct} from './catalog';

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(100000000),
  delivery: z.record(z.string().max(1000))
}).strict();

export type CartLine = z.infer<typeof cartLineSchema>;

export function createCartSchema(catalog: CatalogProduct[]) {
  return z.array(cartLineSchema).max(20).superRefine((lines, ctx) => {
    for (const [index, line] of lines.entries()) {
      const product = catalog.find(item => item.id === line.productId);
      if (!product || line.quantity > product.stock) {
        ctx.addIssue({code: 'custom', message: 'Invalid product or stock', path: [index, 'productId']});
        continue;
      }
      const allowed = new Set(product.fields.map(field => field.key));
      if (Object.keys(line.delivery).some(key => !allowed.has(key))) {
        ctx.addIssue({code: 'custom', message: 'Unknown delivery field', path: [index, 'delivery']});
      }
      for (const field of product.fields) {
        const value = line.delivery[field.key] ?? '';
        if ((field.required && !value.trim()) || value.length > field.maxLength) {
          ctx.addIssue({code: 'custom', message: 'Invalid delivery field', path: [index, 'delivery', field.key]});
        }
      }
    }
    for (const product of catalog) {
      const quantity = lines.filter(line => line.productId === product.id).reduce((sum, line) => sum + line.quantity, 0);
      if (quantity > product.stock) ctx.addIssue({code: 'custom', message: 'Combined quantity exceeds stock'});
    }
  });
}

export const cartSchema = createCartSchema(fallbackProducts);

export function totalUsdCents(lines: CartLine[], catalog: CatalogProduct[] = fallbackProducts) {
  return createCartSchema(catalog).parse(lines).reduce((sum, line) => {
    const product = catalog.find(item => item.id === line.productId)!;
    return sum + product.usdCents * line.quantity;
  }, 0);
}
