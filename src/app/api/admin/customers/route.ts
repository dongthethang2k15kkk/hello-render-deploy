import {getSession} from '@/lib/auth';
import {customerFilterSchema, readFilters} from '@/lib/customer-rules';
import {listCustomers} from '@/lib/customer-store';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET(request: Request) {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json(await listCustomers(readFilters(customerFilterSchema, new URL(request.url).searchParams))); }
  catch (error) {
    console.error('Customer list failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'Customers could not be loaded.'}, 503);
  }
}
