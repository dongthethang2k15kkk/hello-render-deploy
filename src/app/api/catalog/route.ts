import {getPublicCatalog} from '@/lib/catalog-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const catalog = await getPublicCatalog();
  return Response.json(catalog, {headers: {'Cache-Control': 'no-store'}});
}
