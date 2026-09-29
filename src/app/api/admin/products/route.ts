import {Prisma} from '@prisma/client';
import {getSession} from '@/lib/auth';
import {getPaymentDb} from '@/lib/payment-db';
import {productInput} from '@/lib/product-rules';
import {z} from 'zod';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

async function admin() {
  const account = await getSession();
  return account?.role === 'admin' ? account : null;
}

function serialize(product: any) {
  const translations = Object.fromEntries(product.translations.map((t: any) => [t.locale, {title: t.title, description: t.description}]));
  return {...product, translations, packages: product.packages.map((p: any) => ({...p, translations: Object.fromEntries(p.translations.map((t: any) => [t.locale, {title: t.title, description: t.description}])), fields: p.deliveryForms.at(-1)?.fields ?? []}))};
}

export async function GET() {
  if (!await admin()) return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try {
    const products = await getPaymentDb().product.findMany({orderBy: [{sortOrder: 'asc'}, {updatedAt: 'desc'}], include: {translations: true, packages: {include: {translations: true, deliveryForms: {orderBy: {version: 'desc'}, take: 1}}}}});
    return json({products: products.map(serialize)});
  } catch { return json({error: 'Database unavailable. Apply the reviewed migration first.'}, 503); }
}

export async function POST(request: Request) {
  if (!await admin()) return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  let input;
  try {
    const raw = await request.json();
    const {id, ...product} = raw as {id?: unknown; [key: string]: unknown};
    input = {...productInput.parse(product), id: typeof id === 'string' && id ? id : undefined};
  } catch (error) { return json({error: error instanceof Error ? error.message : 'Invalid product'}, 400); }
  try {
    const db = getPaymentDb();
    const product = await db.$transaction(async tx => {
      const fields = {slug: input.slug, category: input.category, sortOrder: input.sortOrder, imagePath: input.imagePath, active: input.active};
      const saved = input.id
        ? await tx.product.update({where: {id: input.id}, data: {...fields, translations: {deleteMany: {}, create: [{locale: 'en', ...input.en}]}}})
        : await tx.product.create({data: {...fields, translations: {create: [{locale: 'en', ...input.en}]}}});
      const existing = await tx.package.findMany({where: {productId: saved.id}, include: {deliveryForms: {orderBy: {version: 'desc'}, take: 1}}});
      for (const item of input.packages) {
        const previous = existing.find(p => p.sku === item.sku);
        if (previous) {
          await tx.package.update({where: {id: previous.id}, data: {baseUsdCents: item.baseUsdCents, saleUsdCents: item.saleUsdCents, stockOnHand: item.stockOnHand, active: item.active, translations: {deleteMany: {}, create: [{locale: 'en', ...item.en}]}}});
          if (JSON.stringify(previous.deliveryForms[0]?.fields ?? []) !== JSON.stringify(item.fields)) await tx.deliveryForm.create({data: {packageId: previous.id, version: (previous.deliveryForms[0]?.version ?? 0) + 1, fields: item.fields}});
        } else await tx.package.create({data: {productId: saved.id, sku: item.sku, baseUsdCents: item.baseUsdCents, saleUsdCents: item.saleUsdCents, stockOnHand: item.stockOnHand, active: item.active, translations: {create: [{locale: 'en', ...item.en}]}, deliveryForms: {create: {version: 1, fields: item.fields}}}});
      }
      await tx.package.updateMany({where: {productId: saved.id, sku: {notIn: input.packages.map((p: {sku: string}) => p.sku)}}, data: {active: false}});
      return tx.product.findUniqueOrThrow({where: {id: saved.id}, include: {translations: true, packages: {include: {translations: true, deliveryForms: true}}}});
    }, {maxWait: 10000, timeout: 20000}); // Remote DB round trips can exceed Prisma's 5s default.
    return json({product: serialize(product)}, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return json({error: 'Slug or SKU already exists'}, 409);
    console.error('Admin product save failed', error instanceof Error ? error.message : error);
    return json({error: 'Product operation unavailable'}, 503);
  }
}

export async function DELETE(request: Request) {
  if (!await admin()) return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({error: 'Product id is required'}, 400);
  try { await getPaymentDb().product.delete({where: {id}}); return json({ok: true}); }
  catch { return json({error: 'Product not found or could not be deleted'}, 404); }
}