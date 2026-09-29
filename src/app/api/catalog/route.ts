import {getPublicCatalog} from '@/lib/catalog-server';
import {expireStaleOrders} from '@/lib/order-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Every storefront page loads the catalog, so this also returns stock held by expired unpaid orders.
  await expireStaleOrders(60_000).catch(() => undefined);
  const catalog = await getPublicCatalog();
  return Response.json(catalog, {headers: {'Cache-Control': 'no-store'}});
}
