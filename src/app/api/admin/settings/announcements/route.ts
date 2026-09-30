import {announcementsSchema} from '@/lib/announcement-rules';
import {getAnnouncements, setAnnouncements} from '@/lib/announcements';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  return json(await getAnnouncements());
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = announcementsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid announcements.'}, 400);
  try {
    await setAnnouncements(parsed.data, admin.email);
    await recordAudit({actorEmail: admin.email, action: 'settings.announcements', summary: `Saved ${parsed.data.slides.length} announcement image${parsed.data.slides.length === 1 ? '' : 's'} (every ${parsed.data.intervalSeconds} s)`, entityType: 'settings'});
    return json({ok: true, ...parsed.data});
  } catch { return json({error: 'Announcements could not be saved.'}, 503); }
}
