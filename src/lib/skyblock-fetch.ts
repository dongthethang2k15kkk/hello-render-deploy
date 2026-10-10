import 'server-only';
import nbt from 'prismarine-nbt';
import {MINECRAFT_NAME, MINECRAFT_UUID} from './accounts-shelf-rules';
import {getHypixelSettings} from './accounts-settings';
import {openApiKey} from './account-vault';
import {getPaymentDb} from './payment-db';
import {buildAccountStats, skillTableFromResource, type AccountStats, type RawItem, type SkillTable} from './skyblock-stats';

// Hypixel's rules: no public proxy. Customers only read the snapshot stored in the database; this file runs only when an
// Admin presses Fetch/Refresh and from the periodic refresh (housekeeping). A 429 stops everything and is written to `statsError`.
const HYPIXEL = 'https://api.hypixel.net/v2';
const LOW_REMAINING = 10;

export class HypixelError extends Error {
  constructor(message: string, readonly kind: 'key' | 'rate' | 'player' | 'down' | 'nokey') { super(message); }
}

const state = globalThis as unknown as {skillTable?: {table: SkillTable; at: number}; hypixelRemaining?: number | null};

async function getJson(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(15000), headers: {accept: 'application/json', ...headers}}).catch(() => { throw new HypixelError('Hypixel could not be reached. Try again in a minute.', 'down'); });
  return response;
}

async function hypixel(path: string, apiKey: string | null) {
  const response = await getJson(`${HYPIXEL}${path}`, apiKey ? {'API-Key': apiKey} : {});
  const remaining = Number(response.headers.get('RateLimit-Remaining'));
  if (Number.isFinite(remaining) && response.headers.has('RateLimit-Remaining')) state.hypixelRemaining = remaining;
  if (response.status === 429) throw new HypixelError('Hypixel says too many requests. Wait a few minutes and try again.', 'rate');
  if (response.status === 403) throw new HypixelError('Hypixel refused the API key. Check it in Settings → SkyBlock accounts.', 'key');
  if (!response.ok) throw new HypixelError(`Hypixel answered with an error (${response.status}). Try again later.`, 'down');
  return {data: await response.json() as Record<string, any>, remaining: Number.isFinite(remaining) && response.headers.has('RateLimit-Remaining') ? remaining : null};
}

/** The XP table of every skill, from Hypixel's public resources (no key needed), kept 24 hours in memory. */
export async function getSkillTable() {
  if (state.skillTable && Date.now() - state.skillTable.at < 24 * 3_600_000) return state.skillTable.table;
  const {data} = await hypixel('/resources/skyblock/skills', null);
  const table = skillTableFromResource(data);
  if (!Object.keys(table).length) throw new HypixelError('Hypixel returned no skill table.', 'down');
  state.skillTable = {table, at: Date.now()};
  return table;
}

// ---------- Mojang ----------

/** IGN → UUID and the exact spelling of the name. Null when no such player exists. */
export async function mojangByName(ign: string) {
  if (!MINECRAFT_NAME.test(ign)) return null;
  const response = await getJson(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(ign)}`);
  if (response.status === 204 || response.status === 404) return null;
  if (!response.ok) throw new HypixelError('Mojang could not be reached. Try again in a minute.', 'down');
  const body = await response.json() as {id?: string; name?: string};
  return body.id && MINECRAFT_UUID.test(body.id) && body.name ? {uuid: body.id.toLowerCase(), ign: body.name} : null;
}

/** The player's current name: it changes when they rename, the UUID does not. */
export async function mojangNameByUuid(uuid: string) {
  const response = await getJson(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
  if (!response.ok) return null;
  const body = await response.json() as {name?: string};
  return body.name ?? null;
}

// ---------- Profiles ----------

export type ProfileChoice = {id: string; cuteName: string | null; gameMode: string; selected: boolean; lastSave: number | null};
type RawProfile = {profile_id: string; cute_name?: string; selected?: boolean; game_mode?: string; banking?: {balance?: number}; members?: Record<string, any>};

const gameMode = (mode: string | undefined) => mode === 'island' ? 'stranded' : mode ?? 'normal';
const lastSave = (profile: RawProfile, uuid: string) => {
  const member = profile.members?.[uuid];
  const value = member?.last_save ?? member?.profile?.last_save;
  return typeof value === 'number' ? value : null;
};

async function loadProfiles(uuid: string, apiKey: string) {
  const {data, remaining} = await hypixel(`/skyblock/profiles?uuid=${uuid}`, apiKey);
  return {profiles: (Array.isArray(data.profiles) ? data.profiles : []) as RawProfile[], remaining};
}

/** IGN → the player's SkyBlock profiles (the one in use is marked `selected`). */
export async function lookupPlayer(ign: string, apiKey: string) {
  const player = await mojangByName(ign);
  if (!player) throw new HypixelError('No Minecraft player has this name. Check the spelling.', 'player');
  const {profiles, remaining} = await loadProfiles(player.uuid, apiKey);
  const choices: ProfileChoice[] = profiles.filter(profile => profile.members?.[player.uuid]).map(profile => ({id: profile.profile_id, cuteName: profile.cute_name ?? null, gameMode: gameMode(profile.game_mode), selected: Boolean(profile.selected), lastSave: lastSave(profile, player.uuid)}));
  if (!choices.length) throw new HypixelError('This player has no SkyBlock profile, or their SkyBlock API is switched off.', 'player');
  return {uuid: player.uuid, ign: player.ign, profiles: choices, remaining};
}

// ---------- Gear ----------

async function decodeItems(data: unknown): Promise<RawItem[]> {
  if (typeof data !== 'string' || !data) return [];
  const {parsed} = await nbt.parse(Buffer.from(data, 'base64'));
  const items = (nbt.simplify(parsed) as {i?: any[]}).i ?? [];
  return items.map(item => {
    const display = item?.tag?.display;
    if (typeof display?.Name !== 'string') return {name: '', lore: []};
    return {name: display.Name, lore: Array.isArray(display.Lore) ? display.Lore.filter((line: unknown): line is string => typeof line === 'string') : [], id: item.tag.ExtraAttributes?.id, modifier: item.tag.ExtraAttributes?.modifier};
  });
}

async function readGear(member: Record<string, any>) {
  const inventory = member.inventory;
  // Without the Inventory API the armor and equipment fields are missing altogether.
  if (!inventory?.inv_armor?.data) return null;
  const [armor, equipment] = await Promise.all([decodeItems(inventory.inv_armor.data), decodeItems(inventory.equipment_contents?.data)]);
  return {armor, equipment};
}

// ---------- Networth ----------

async function networthOf(member: Record<string, any>, museum: Record<string, any> | null, bank: number | null) {
  try {
    const networth = await import('skyhelper-networth');
    // The package checks npm for updates on a timer; a server has no use for that.
    try { networth.UpdateManager.disable(); } catch { /* older versions */ }
    const calculator = new networth.ProfileNetworthCalculator(member, museum ?? undefined, bank ?? undefined);
    const [total, nonCosmetic] = await Promise.all([calculator.getNetworth(), calculator.getNonCosmeticNetworth()]);
    if (total.noInventory) return null;
    return {total: Math.round(total.networth), nonCosmetic: Math.round(nonCosmetic.networth)};
  } catch (error) {
    console.error('Networth calculation failed', error instanceof Error ? error.message.split('\n')[0] : error);
    return null;
  }
}

// ---------- The snapshot ----------

/** Everything a customer sees of one profile, from Hypixel. A museum or networth failure only leaves those numbers empty. */
export async function fetchAccountStats(uuid: string, profileId: string, apiKey: string, fairySoulsTotal: number) {
  const table = await getSkillTable();
  const {profiles, remaining} = await loadProfiles(uuid, apiKey);
  const profile = profiles.find(item => item.profile_id === profileId);
  const member = profile?.members?.[uuid];
  if (!profile || !member) throw new HypixelError('This SkyBlock profile was not found for the player any more. Pick the profile again.', 'player');
  const bank = typeof profile.banking?.balance === 'number' ? profile.banking.balance : null;
  const museum = await hypixel(`/skyblock/museum?profile=${profileId}`, apiKey).then(({data}) => (data.members?.[uuid] ?? null) as Record<string, any> | null).catch(error => { if (error instanceof HypixelError && error.kind === 'rate') throw error; return null; });
  const [gear, networth] = await Promise.all([readGear(member), networthOf(member, museum, bank)]);
  const stats = buildAccountStats({member, bankBalance: bank, table, profile: {cuteName: profile.cute_name ?? null, gameMode: gameMode(profile.game_mode), coop: Object.keys(profile.members ?? {}).length > 1}, fairySoulsTotal, networth, gear});
  return {stats, remaining: remaining ?? state.hypixelRemaining ?? null};
}

/** Checks a key with one cheap request and reports how many requests are left in the current window. */
export async function testApiKey(apiKey: string) {
  // Notch's UUID: any valid player works, and the answer is irrelevant; only the key check and the rate headers matter.
  const {remaining} = await hypixel('/skyblock/profiles?uuid=069a79f444e94726a5befca90e38aaf5', apiKey);
  return {remaining};
}

// ---------- Saving and the periodic refresh ----------

type StoredAccount = {id: string; uuid: string | null; profileId: string | null; ign: string; statsLocked: boolean};

/** Fetches and stores one account's snapshot. On failure the old snapshot stays and only `statsError` changes. */
export async function refreshAccountStats(account: StoredAccount, apiKey: string, fairySoulsTotal: number) {
  const db = getPaymentDb();
  if (!account.uuid || !account.profileId) throw new HypixelError('This account has no Hypixel profile chosen yet.', 'player');
  try {
    const {stats, remaining} = await fetchAccountStats(account.uuid, account.profileId, apiKey, fairySoulsTotal);
    // A renamed player keeps the same UUID: follow the new name so the SkyCrypt link keeps working.
    const name = await mojangNameByUuid(account.uuid).catch(() => null);
    await db.gameAccount.update({where: {id: account.id}, data: {stats, statsSource: 'hypixel', statsFetchedAt: new Date(), statsError: null, profileName: stats.profile.cuteName, ...(name && name !== account.ign ? {ign: name} : {})}});
    return {stats, remaining};
  } catch (error) {
    await db.gameAccount.update({where: {id: account.id}, data: {statsError: (error instanceof Error ? error.message : 'Refresh failed').slice(0, 300)}}).catch(() => undefined);
    throw error;
  }
}

/** Refreshes up to `limit` accounts whose snapshot is older than the Admin's interval. Stops at the first rate limit. */
export async function refreshDueAccountStats(limit = 5) {
  if (!process.env.DATABASE_URL) return 0;
  const settings = await getHypixelSettings();
  const apiKey = settings.apiKeyEnc ? openApiKey(settings.apiKeyEnc) : null;
  if (!apiKey || settings.autoRefreshHours === 0) return 0;
  if (state.hypixelRemaining !== undefined && state.hypixelRemaining !== null && state.hypixelRemaining < LOW_REMAINING) return 0;
  const cutoff = new Date(Date.now() - settings.autoRefreshHours * 3_600_000);
  // Sold accounts keep the snapshot taken when they sold, as the record of what was delivered.
  const due = await getPaymentDb().gameAccount.findMany({where: {status: {in: ['draft', 'available', 'reserved']}, statsLocked: false, uuid: {not: null}, profileId: {not: null}, OR: [{statsFetchedAt: null}, {statsFetchedAt: {lt: cutoff}}]}, orderBy: [{statsFetchedAt: {sort: 'asc', nulls: 'first'}}], take: limit, select: {id: true, uuid: true, profileId: true, ign: true, statsLocked: true}});
  let refreshed = 0;
  for (const account of due) {
    try {
      const {remaining} = await refreshAccountStats(account, apiKey, settings.fairySoulsTotal);
      refreshed++;
      if (remaining !== null && remaining < LOW_REMAINING) break;
    } catch (error) {
      if (error instanceof HypixelError && (error.kind === 'rate' || error.kind === 'key')) break;
    }
  }
  return refreshed;
}

export type {AccountStats};
