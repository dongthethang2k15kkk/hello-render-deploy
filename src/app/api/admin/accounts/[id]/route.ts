import {z} from 'zod';
import {getSession} from '@/lib/auth';
import {sameOrigin} from '@/lib/customer-rules';
import {accountInputSchema} from '@/lib/account-input';
import {AccountError, getAccount, revealLogin, setAccountStatus, updateAccount} from '@/lib/account-store';
import {openApiKey} from '@/lib/account-vault';
import {getHypixelSettings} from '@/lib/accounts-settings';
import {recordAudit} from '@/lib/audit';
import {getPaymentDb} from '@/lib/payment-db';
import {HypixelError, lookupPlayer, refreshAccountStats} from '@/lib/skyblock-fetch';
import {ADMIN_STATUSES} from '@/lib/account-rules';

export const runtime = 'nodejs';
const json = (data: unknown, status = 200) => Response.json(data, {status, headers: {'Cache-Control': 'no-store'}});
const validId = (id: string) => /^[a-z0-9]{10,40}$/.test(id);

export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  if ((await getSession())?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  const {id} = await params;
  if (!validId(id)) return json({error: 'Account not found.'}, 404);
  try {
    const account = await getAccount(id);
    return account ? json({account}) : json({error: 'Account not found.'}, 404);
  } catch { return json({error: 'The account could not be loaded.'}, 503); }
}

const action = z.discriminatedUnion('action', [
  z.object({action: z.literal('save'), account: accountInputSchema}).strict(),
  z.object({action: z.literal('set-status'), status: z.enum(ADMIN_STATUSES)}).strict(),
  z.object({action: z.literal('reveal-secret')}).strict(),
  /** Reads the player's profiles again (to pick another profile) for an account that already exists. */
  z.object({action: z.literal('lookup'), ign: z.string().trim().max(40)}).strict(),
  /** Fetches the stats from Hypixel for the chosen profile and stores them. */
  z.object({action: z.literal('fetch-stats'), uuid: z.string().regex(/^[0-9a-f]{32}$/).optional(), profileId: z.string().max(60).optional()}).strict()
]);

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  if (!sameOrigin(request.headers)) return json({error: 'Invalid request origin.'}, 403);
  const admin = await getSession();
  if (admin?.role !== 'admin') return json({error: 'Admin role required'}, 403);
  if (!process.env.DATABASE_URL) return json({error: 'Database is not configured'}, 503);
  const {id} = await params;
  if (!validId(id)) return json({error: 'Account not found.'}, 404);
  const parsed = action.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({error: parsed.error.issues[0]?.message ?? 'Invalid request.'}, 400);
  const input = parsed.data;
  try {
    if (input.action === 'save') {
      await updateAccount(admin.email, id, input.account);
    } else if (input.action === 'set-status') {
      await setAccountStatus(admin.email, id, input.status);
    } else if (input.action === 'reveal-secret') {
      return json({login: await revealLogin(admin.email, id)});
    } else {
      const settings = await getHypixelSettings();
      const key = settings.apiKeyEnc ? openApiKey(settings.apiKeyEnc) : null;
      if (!key) return json({error: 'Add your Hypixel API key in Settings → SkyBlock accounts first, or enter the stats by hand.'}, 409);
      if (input.action === 'lookup') return json(await lookupPlayer(input.ign, key));
      const account = await getPaymentDb().gameAccount.findUnique({where: {id}, select: {id: true, code: true, status: true, uuid: true, profileId: true, ign: true, statsLocked: true}});
      if (!account) return json({error: 'Account not found.'}, 404);
      if (account.status === 'sold') return json({error: 'A sold account keeps the stats it was sold with.'}, 409);
      const target = {...account, uuid: input.uuid ?? account.uuid, profileId: input.profileId ?? account.profileId};
      if (input.uuid || input.profileId) await getPaymentDb().gameAccount.update({where: {id}, data: {uuid: target.uuid, profileId: target.profileId}});
      // A manual number freezes the snapshot; pressing Refresh is the Admin saying "use Hypixel again".
      const {stats, remaining} = await refreshAccountStats(target, key, settings.fairySoulsTotal);
      await getPaymentDb().gameAccount.update({where: {id}, data: {statsLocked: false}});
      await recordAudit({actorEmail: admin.email, action: 'account.stats_refreshed', summary: `Refreshed the stats of ${account.code} from Hypixel`, entityType: 'account', entityId: id});
      return json({ok: true, stats, remaining, account: await getAccount(id)});
    }
    return json({ok: true, account: await getAccount(id)});
  } catch (error) {
    if (error instanceof AccountError) return json({error: error.message}, error.status);
    if (error instanceof HypixelError) return json({error: error.message}, error.kind === 'player' ? 404 : error.kind === 'rate' ? 429 : 502);
    console.error('Account action failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return json({error: 'The action could not be completed.'}, 503);
  }
}
