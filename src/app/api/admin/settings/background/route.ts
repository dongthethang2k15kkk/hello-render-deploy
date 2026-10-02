import {sceneSchema} from '@/lib/background-rules';
import {getBackgroundScene, setBackgroundScene} from '@/lib/background-scene';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  return json(await getBackgroundScene());
}

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = sceneSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid background.'}, 400);
  if (new Set(parsed.data.layers.map(layer => layer.id)).size !== parsed.data.layers.length) return json({error: 'Each image must appear once.'}, 400);
  try {
    await setBackgroundScene(parsed.data, admin.email);
    await recordAudit({actorEmail: admin.email, action: 'settings.background', summary: `Saved the storefront background (${parsed.data.layers.length} image${parsed.data.layers.length === 1 ? '' : 's'})`, entityType: 'settings'});
    return json({ok: true, ...parsed.data});
  } catch { return json({error: 'Background could not be saved.'}, 503); }
}
