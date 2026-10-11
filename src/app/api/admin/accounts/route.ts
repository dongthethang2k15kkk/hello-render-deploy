import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {accountInputSchema} from '@/lib/account-input';
import {AccountError, createAccount, deleteAccount, listAccounts} from '@/lib/account-store';
import {openApiKey} from '@/lib/account-vault';
import {ACCOUNT_STATUSES} from '@/lib/account-rules';
import {getHypixelSettings, getShelf} from '@/lib/accounts-settings';
import {publicHypixelSettings} from '@/lib/accounts-shelf-rules';
import {getVndPerUsd} from '@/lib/exchange-rates';
import {fetchAccountStats, getSkillTable, HypixelError, lookupPlayer} from '@/lib/skyblock-fetch';
import {manualAccountStats} from '@/lib/skyblock-stats';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});

const querySchema = z.object({status: z.enum(['all', ...ACCOUNT_STATUSES]).catch('all')});

export async function GET(request: Request) {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const {status} = querySchema.parse({status: new URL(request.url).searchParams.get('status') ?? 'all'});
  try {
    // `?meta=1`: only the settings the account form needs, not the list.
    const metaOnly = new URL(request.url).searchParams.get('meta') === '1';
    const [list, vndPerUsd, hypixel, shelf] = await Promise.all([metaOnly ? {accounts: [], counts: {}} : listAccounts(status), getVndPerUsd(), getHypixelSettings(), getShelf()]);
    return json({...list, vndPerUsd, hypixel: publicHypixelSettings(hypixel), showIgnByDefault: shelf.showIgnByDefault});
  } catch { return json({error: 'Accounts could not be loaded.'}, 503); }
}

const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('lookup'), ign: z.string().trim().max(40)}).strict(),
  /** Stats for a profile chosen after `lookup`, shown in the form before the account is saved. */
  z.object({action: z.literal('preview'), uuid: z.string().regex(/^[0-9a-f]{32}$/), profileId: z.string().max(60)}).strict(),
  z.object({action: z.literal('create'), account: accountInputSchema}).strict(),
  z.object({action: z.literal('blank-stats')}).strict()
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
    if (input.action === 'lookup') {
      const settings = await getHypixelSettings();
      const key = settings.apiKeyEnc ? openApiKey(settings.apiKeyEnc) : null;
      if (!key) return json({error: 'Add your Hypixel API key in Settings → SkyBlock accounts first, or enter the stats by hand.'}, 409);
      return json(await lookupPlayer(input.ign, key));
    }
    if (input.action === 'preview') {
      const settings = await getHypixelSettings();
      const key = settings.apiKeyEnc ? openApiKey(settings.apiKeyEnc) : null;
      if (!key) return json({error: 'Add your Hypixel API key in Settings → SkyBlock accounts first, or enter the stats by hand.'}, 409);
      return json(await fetchAccountStats(input.uuid, input.profileId, key, settings.fairySoulsTotal));
    }
    if (input.action === 'blank-stats') return json({stats: manualAccountStats(await getSkillTable().catch(() => ({})))});
    const created = await createAccount(admin.email, input.account);
    return json({ok: true, ...created}, 201);
  } catch (error) {
    if (error instanceof AccountError) return json({error: error.message}, error.status);
    if (error instanceof HypixelError) return json({error: error.message}, error.kind === 'player' ? 404 : error.kind === 'rate' ? 429 : 502);
    console.error('Account action failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The action could not be completed.'}, 503);
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  const parsed = z.object({id: z.string().regex(/^[a-z0-9]{10,40}$/)}).strict().safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: 'Invalid request.'}, 400);
  try { await deleteAccount(admin.email, parsed.data.id); return json({ok: true}); }
  catch (error) { return error instanceof AccountError ? json({error: error.message}, error.status) : json({error: 'The account could not be deleted.'}, 503); }
}
