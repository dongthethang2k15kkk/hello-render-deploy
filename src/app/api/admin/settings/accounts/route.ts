import {z} from 'zod';
import {recordAudit} from '@/lib/audit';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {openApiKey, sealApiKey} from '@/lib/account-vault';
import {getHypixelSettings, getShelf, saveHypixelSettings, saveShelf} from '@/lib/accounts-settings';
import {HYPIXEL_KEY, publicHypixelSettings, shelfSchema} from '@/lib/accounts-shelf-rules';
import {HypixelError, testApiKey} from '@/lib/skyblock-fetch';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

// The API key is only ever sent from the browser to the server. These answers carry its last four characters and nothing more.
async function state() {
  const [shelf, hypixel] = await Promise.all([getShelf(), getHypixelSettings()]);
  return {shelf, hypixel: publicHypixelSettings(hypixel)};
}

export async function GET() {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  try { return json(await state()); } catch { return json({error: 'The settings could not be loaded.'}, 503); }
}

const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('save-shelf'), shelf: shelfSchema}).strict(),
  z.object({action: z.literal('save-hypixel'), autoRefreshHours: z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(24)]), fairySoulsTotal: z.number().int().min(1).max(2000)}).strict(),
  z.object({action: z.literal('save-key'), apiKey: z.string().trim().regex(HYPIXEL_KEY, 'A Hypixel API key looks like 8-4-4-4-12 letters and digits. Copy it again from developer.hypixel.net.')}).strict(),
  z.object({action: z.literal('test-key')}).strict(),
  z.object({action: z.literal('remove-key')}).strict()
]);

export async function POST(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid request.'}, 400);
  const input = parsed.data;
  try {
    const current = await getHypixelSettings();
    if (input.action === 'save-shelf') {
      await saveShelf(input.shelf, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.accounts_shelf', summary: `Saved the SkyBlock accounts shelf (${input.shelf.enabled ? 'on' : 'off'})`, entityType: 'settings'});
    } else if (input.action === 'save-hypixel') {
      await saveHypixelSettings({...current, autoRefreshHours: input.autoRefreshHours, fairySoulsTotal: input.fairySoulsTotal}, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.hypixel', summary: `Hypixel: refresh every ${input.autoRefreshHours || '—'} h, ${input.fairySoulsTotal} fairy souls in total`, entityType: 'settings'});
    } else if (input.action === 'save-key') {
      await saveHypixelSettings({...current, apiKeyEnc: sealApiKey(input.apiKey), apiKeyTail: input.apiKey.slice(-4)}, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.hypixel_key', summary: `Saved a Hypixel API key ending …${input.apiKey.slice(-4)}`, entityType: 'settings'});
    } else if (input.action === 'remove-key') {
      await saveHypixelSettings({...current, apiKeyEnc: null, apiKeyTail: null}, admin.email);
      await recordAudit({actorEmail: admin.email, action: 'settings.hypixel_key', summary: 'Removed the Hypixel API key', entityType: 'settings'});
    } else {
      const key = current.apiKeyEnc ? openApiKey(current.apiKeyEnc) : null;
      if (!key) return json({error: current.apiKeyEnc ? 'The saved key cannot be opened (AUTH_SECRET changed?). Save it again.' : 'Save an API key first.'}, 409);
      return json({ok: true, ...(await testApiKey(key)), ...(await state())});
    }
    return json({ok: true, ...(await state())});
  } catch (error) {
    if (error instanceof HypixelError) return json({error: error.message}, error.kind === 'key' ? 400 : error.kind === 'rate' ? 429 : 502);
    console.error('Account settings failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The settings could not be saved.'}, 503);
  }
}
