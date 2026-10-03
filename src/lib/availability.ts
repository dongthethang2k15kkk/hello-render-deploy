import 'server-only';
import {getPaymentDb} from './payment-db';

// Each Admin marks themselves online by hand ("ready to trade now"); customers only see how many are online.
const KEY = 'adminAvailability';
const CACHE_MS = 5_000;
type Entry = {online: boolean; since: string};
type Map = Record<string, Entry>;
const store = globalThis as unknown as {availabilityCache?: {value: Map; at: number}};

async function readAll(): Promise<Map> {
  const hit = store.availabilityCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value: Map = {};
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: KEY}});
      if (row?.value && typeof row.value === 'object' && !Array.isArray(row.value)) value = row.value as Map;
    } catch { return hit?.value ?? {}; }
  }
  store.availabilityCache = {value, at: Date.now()};
  return value;
}

/** Public: how many Admins are ready to trade right now. */
export async function onlineCount() {
  return Object.values(await readAll()).filter(entry => entry.online).length;
}

/** Admin view: my own state and which Admins are online. */
export async function adminAvailability(email: string) {
  const all = await readAll();
  return {online: Boolean(all[email]?.online), since: all[email]?.since ?? null, onlineAdmins: Object.entries(all).filter(([, entry]) => entry.online).map(([admin, entry]) => ({email: admin, since: entry.since}))};
}

export async function setOnline(email: string, online: boolean) {
  const db = getPaymentDb();
  // Read-modify-write inside a transaction so two Admins toggling at once do not overwrite each other.
  await db.$transaction(async tx => {
    const row = await tx.storeSetting.findUnique({where: {key: KEY}});
    const current = (row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {}) as Map;
    const value: Map = {...current, [email]: {online, since: new Date().toISOString()}};
    await tx.storeSetting.upsert({where: {key: KEY}, create: {key: KEY, value, updatedBy: email}, update: {value, updatedBy: email}});
  });
  store.availabilityCache = undefined;
}
