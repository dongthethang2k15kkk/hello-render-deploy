import 'server-only';
import {getPaymentDb} from './payment-db';
import {deliveryFieldSchema, fallbackProducts, fallbackVndPerUsd, type CatalogProduct, type CatalogSource} from './catalog';
import {getLtcRate, getVndPerUsd} from './exchange-rates';
import {accountCatalogLine} from './account-card';
import {getShelf} from './accounts-settings';
import {defaultShelf, type Shelf} from './accounts-shelf-rules';
import {paypalReady} from './paypal';
import {getPaypalSettings} from './paypal-settings';

// vndPerLtc is set only while Litecoin checkout is on (an active wallet), so the store can show an LTC estimate.
// `products` are the packages; `accounts` are the game accounts for sale (empty when the Admin turned the shelf off).
export type PublicCatalog = {products: CatalogProduct[]; accounts: CatalogProduct[]; shelf: Shelf; source: CatalogSource; vndPerUsd: number; vndPerLtc: number | null};

function fallback(source: 'demo' | 'fallback'): PublicCatalog {
  return {products: fallbackProducts, accounts: [], shelf: defaultShelf, source, vndPerUsd: fallbackVndPerUsd, vndPerLtc: null};
}

async function storeLtcRate() {
  try {
    const wallets = await getPaymentDb().cryptoWallet.count({where: {active: true, network: 'LTC'}});
    return wallets ? (await getLtcRate())?.vndPerLtc ?? null : null;
  } catch {
    return null;
  }
}

/** Whether checkout offers USDT (an active TRON wallet), for the store's payment copy. */
export async function usdtCheckout() {
  if (!process.env.DATABASE_URL) return false;
  try { return (await getPaymentDb().cryptoWallet.count({where: {active: true, network: 'TRC20'}})) > 0; } catch { return false; }
}

/** Whether checkout offers PayPal (switched on with a valid PayPal.me name), for the store's payment copy. */
export async function paypalCheckout() {
  try { return paypalReady(await getPaypalSettings()); } catch { return false; }
}

async function readDatabaseCatalog(): Promise<CatalogProduct[]> {
  const records = await getPaymentDb().product.findMany({
    where: {active: true},
    orderBy: [{sortOrder: 'asc'}, {updatedAt: 'desc'}],
    include: {
      translations: {where: {locale: 'en'}},
      packages: {
        where: {active: true, priceVnd: {gt: 0}},
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
      const sale = item.salePriceVnd && item.salePriceVnd < item.priceVnd ? item.salePriceVnd : null;
      return [{
        id: item.id, sourceProductId: product.id, slug: product.slug, sku: item.sku, category: product.category, imagePath: product.imagePath,
        priceVnd: sale ?? item.priceVnd, basePriceVnd: item.priceVnd, salePriceVnd: sale, stock: Math.max(0, item.stockOnHand),
        title: {en: title}, description: {en: packageText.description || productText.description}, fields: parsedFields.data, kind: 'package' as const, account: null
      } satisfies CatalogProduct];
    });
  });
}

/** Game accounts on sale, and the ones a customer just reserved (shown as "Reserved" until their order is paid or expires). */
async function readAccounts(shelf: Shelf): Promise<CatalogProduct[]> {
  if (!shelf.enabled) return [];
  const rows = await getPaymentDb().gameAccount.findMany({where: {status: {in: ['available', 'reserved']}, priceVnd: {gt: 0}}, orderBy: [{sortOrder: 'asc'}, {createdAt: 'desc'}], take: 200});
  return rows.map(accountCatalogLine);
}

// Neon Free suspends idle compute; the first query after a pause can take several seconds.
export async function getPublicCatalog(timeoutMs = 10000): Promise<PublicCatalog> {
  if (!process.env.DATABASE_URL) return fallback('demo');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {timer = setTimeout(() => reject(new Error('Catalog database timeout')), timeoutMs);});
    const [products, vndPerUsd, vndPerLtc, shelf] = await Promise.race([Promise.all([readDatabaseCatalog(), getVndPerUsd(), storeLtcRate(), getShelf()]), timeout]);
    const accounts = await readAccounts(shelf).catch(() => []);
    return {products, accounts, shelf, source: 'database', vndPerUsd, vndPerLtc};
  } catch {
    return fallback('fallback');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
