import {getSession} from '@/lib/demo-auth';
import {isValidResource, presenceStore} from '@/lib/admin-presence';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

async function admin() {
  const account = await getSession();
  return account?.role === 'admin' ? account : null;
}

function snapshot(selfId: string) {
  return {self: selfId, admins: presenceStore().list().map(({adminId, name, email, resource, seenAt}) => ({id: adminId, name, email, resource, seenAt: new Date(seenAt).toISOString()}))};
}

export async function GET() {
  const account = await admin();
  if (!account) return json({error: 'Admin role required'}, 403);
  return json(snapshot(account.id));
}

/** Heartbeat: {resource: 'chat:user:<id>' | 'chat' | 'settings' | 'settings/products' | 'payments'} or {leave: true}. */
export async function POST(request: Request) {
  const account = await admin();
  if (!account) return json({error: 'Admin role required'}, 403);
  const data = await request.json().catch(() => null) as {resource?: unknown; leave?: unknown} | null;
  if (data?.leave === true) presenceStore().leave(account.id);
  else if (isValidResource(data?.resource)) presenceStore().beat(account.id, account.name, account.email ?? account.username, data.resource);
  else return json({error: 'Invalid resource'}, 400);
  return json(snapshot(account.id));
}
