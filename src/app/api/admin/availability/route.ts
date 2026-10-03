import {z} from 'zod';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {adminAvailability, setOnline} from '@/lib/availability';
import {sameOrigin} from '@/lib/customer-rules';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  const admin = await getSession();
  if (admin?.role !== 'admin' || !admin.email) return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({online: false, onlineAdmins: []});
  return json(await adminAvailability(admin.email));
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin' || !admin.email) return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = z.object({online: z.boolean()}).strict().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: 'Invalid request.'}, 400);
  try {
    await setOnline(admin.email, parsed.data.online);
    await recordAudit({actorEmail: admin.email, action: parsed.data.online ? 'availability.online' : 'availability.offline', summary: parsed.data.online ? 'Went online for trades' : 'Went offline', entityType: 'settings'});
    return json(await adminAvailability(admin.email));
  } catch { return json({error: 'Your status could not be saved.'}, 503); }
}
