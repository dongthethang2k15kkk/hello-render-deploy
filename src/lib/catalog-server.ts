import 'server-only';
import {getPaymentDb} from './payment-db';
import {deliveryFieldSchema, fallbackProducts, type CatalogProduct, type CatalogSource} from './catalog';

export type PublicCatalog = {products: CatalogProduct[]; source: CatalogSource};

function fallback(source: 'demo' | 'fallback'): PublicCatalog {
  return {products: fallbackProducts, source};
}

async function readDatabaseCatalog(): Promise<CatalogProduct[]> {
  const records = await getPaymentDb().product.findMany({
    where: {active: true},
    orderBy: [{sortOrder: 'asc'}, {updatedAt: 'desc'}],
    include: {
      translations: {where: {locale: 'en'}},
      packages: {
        where: {active: true},
        orderBy: {createdAt: 'asc'},
        include: {translations: {where: {locale: 'en'}}, deliveryForms: {orderBy: {version: 'desc'}, take: 1}}
      }
    }
  });

  return records.flatMap(product => {
    const productText = product.translations[0];
    if (!productText) return [];
    return product.packages.flatMap(item => {
      const packageText = item.translations[0];
      if (!packageText) return [];
      const parsedFields = deliveryFieldSchema.array().safeParse(item.deliveryForms[0]?.fields ?? []);
      if (!parsedFields.success) return [];
      const packageTitle = packageText.title.trim();
      const title = packageTitle && packageTitle !== productText.title ? `${productText.title} · ${packageTitle}` : productText.title;
      const sale = item.saleUsdCents;
      return [{
        id: item.id, sourceProductId: product.id, slug: product.slug, sku: item.sku, category: product.category, imagePath: product.imagePath,
        usdCents: sale ?? item.baseUsdCents, baseUsdCents: item.baseUsdCents, saleUsdCents: sale, stock: item.stockOnHand,
        title: {en: title}, description: {en: packageText.description || productText.description}, fields: parsedFields.data
      } satisfies CatalogProduct];
    });
  });
}

export async function getPublicCatalog(timeoutMs = 3000): Promise<PublicCatalog> {
  if (!process.env.DATABASE_URL) return fallback('demo');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error('Catalog database timeout')), timeoutMs);});
    const products = await Promise.race([readDatabaseCatalog(), timeout]);
    return {products, source: 'database'};
  } catch {
    return fallback('fallback');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
