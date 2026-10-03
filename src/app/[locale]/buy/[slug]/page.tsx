import {notFound, redirect} from 'next/navigation';
import {getPublicCatalog} from '@/lib/catalog-server';

/**
 * Short links Admins can paste in Discord for returning customers, e.g. /en/buy/100m: opens that package ready to buy.
 * Matches the product slug or the package SKU (case-insensitive); unknown names go to the buy box on the store.
 */
export default async function BuyLink({params}: {params: Promise<{locale: string; slug: string}>}) {
  const {locale, slug} = await params;
  if (locale !== 'en') notFound();
  const wanted = decodeURIComponent(slug).toLowerCase();
  const catalog = await getPublicCatalog();
  const product = catalog.products.find(item => item.slug.toLowerCase() === wanted) ?? catalog.products.find(item => item.sku.toLowerCase() === wanted);
  redirect(product ? `/${locale}/products/${product.id}` : `/${locale}#buy`);
}
