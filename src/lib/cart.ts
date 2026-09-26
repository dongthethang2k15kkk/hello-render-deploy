import {z} from 'zod';
import {products} from './catalog';

export const cartLineSchema = z.object({
  productId: z.string(), quantity: z.number().int().min(1).max(5),
  delivery: z.record(z.string().max(300))
}).strict().superRefine((line, ctx) => {
  const product = products.find(p => p.id === line.productId);
  if (!product || line.quantity > product.stock) {
    ctx.addIssue({code: 'custom', message: 'Invalid product or stock'});
    return;
  }
  const allowed = new Set<string>(product.fields.map(f => f.key));
  if (Object.keys(line.delivery).some(key => !allowed.has(key))) {
    ctx.addIssue({code: 'custom', message: 'Unknown delivery field'});
  }
  for (const field of product.fields) {
    const value = line.delivery[field.key] ?? '';
    if ((field.required && !value.trim()) || value.length > field.maxLength) {
      ctx.addIssue({code: 'custom', message: 'Invalid delivery field', path: ['delivery', field.key]});
    }
  }
});
export const cartSchema = z.array(cartLineSchema).max(20).superRefine((lines, ctx) => {
  for (const product of products) {
    if (lines.filter(l => l.productId === product.id).reduce((sum, l) => sum + l.quantity, 0) > product.stock) {
      ctx.addIssue({code: 'custom', message: 'Combined quantity exceeds sample stock'});
    }
  }
});
export type CartLine = z.infer<typeof cartLineSchema>;
export function totalUsdCents(lines: CartLine[]) {
  return cartSchema.parse(lines).reduce((sum, line) => {
    const product = products.find(p => p.id === line.productId)!;
    return sum + product.usdCents * line.quantity;
  }, 0);
}