import {createCartSchema, totalUsdCents} from '@/lib/cart';
import {getPublicCatalog} from '@/lib/catalog-server';

export async function POST(request: Request) {
  // Demo validation only: no inventory reservation or payment is performed.
  const raw = await request.text();
  if (raw.length > 20000) return Response.json({error: 'Payload too large'}, {status: 413});
  let data: unknown;
  try {data = JSON.parse(raw);} catch {return Response.json({error: 'Invalid JSON'}, {status: 400});}
  const catalog = await getPublicCatalog();
  const result = createCartSchema(catalog.products).safeParse(data);
  if (!result.success || result.data.length === 0) return Response.json({error: 'Invalid cart'}, {status: 400});
  return Response.json({demo: true, currency: 'USD', totalMinor: totalUsdCents(result.data, catalog.products), paymentEnabled: false});
}
