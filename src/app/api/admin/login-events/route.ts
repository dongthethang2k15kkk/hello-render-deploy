import {getSession} from '@/lib/auth';
import {loginEventFilterSchema, readFilters} from '@/lib/customer-rules';
import {listLoginEvents} from '@/lib/customer-store';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET(request: Request) {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json(await listLoginEvents(readFilters(loginEventFilterSchema, new URL(request.url).searchParams))); }
  catch (error) {
    console.error('Sign-in activity failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'Sign-in activity could not be loaded.'}, 503);
  }
}
