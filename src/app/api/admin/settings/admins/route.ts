import {z} from 'zod';
import {getExtraAdmins, ownerEmails, setExtraAdmins} from '@/lib/admin-team';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {emailSchema, sameOrigin} from '@/lib/customer-rules';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const state = async () => ({owners: ownerEmails(), admins: await getExtraAdmins()});

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  return json(await state());
}

const action = z.object({action: z.enum(['add', 'remove']), email: emailSchema}).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Enter a valid email.'}, 400);
  const {email} = parsed.data;
  const current = await getExtraAdmins();
  if (parsed.data.action === 'add') {
    if (ownerEmails().includes(email) || current.includes(email)) return json({error: 'This email is already an Admin.'}, 409);
    await setExtraAdmins([...current, email], admin.email);
    await recordAudit({actorEmail: admin.email, action: 'settings.admin_added', summary: `Added Admin ${email}`, entityType: 'settings'});
  } else {
    if (ownerEmails().includes(email)) return json({error: 'Owners are set in Render (ADMIN_GOOGLE_EMAILS) and cannot be removed here.'}, 409);
    if (!current.includes(email)) return json({error: 'This email is not in the Admin list.'}, 404);
    await setExtraAdmins(current.filter(item => item !== email), admin.email);
    await recordAudit({actorEmail: admin.email, action: 'settings.admin_removed', summary: `Removed Admin ${email}`, entityType: 'settings'});
  }
  return json({ok: true, ...(await state())});
}
