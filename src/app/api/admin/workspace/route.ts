import {getSession} from '@/lib/auth';
import {workspaceQueues} from '@/lib/order-store';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

/** Queues for the Admin workspace: orders waiting for an Admin, mine, and those other Admins handle. */
export async function GET() {
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json({me: admin.email, ...await workspaceQueues(admin.email ?? '')}); }
  catch { return json({error: 'The workspace could not be loaded.'}, 503); }
}
