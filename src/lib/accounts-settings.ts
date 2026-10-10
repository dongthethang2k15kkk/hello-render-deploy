import 'server-only';
import {defaultHypixelSettings, defaultShelf, hypixelSettingsSchema, shelfSchema, type HypixelSettings, type Shelf} from './accounts-shelf-rules';
import {getPaymentDb} from './payment-db';

const CACHE_MS = 30_000;
const store = globalThis as unknown as {accountSettingsCache?: Map<string, {value: unknown; at: number}>};
const cache = store.accountSettingsCache ??= new Map();

async function read<T>(key: string, parse: (value: unknown) => T | null, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  let value = fallback;
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key}});
      value = parse(row?.value) ?? fallback;
    } catch { return (hit?.value as T | undefined) ?? fallback; }
  }
  cache.set(key, {value, at: Date.now()});
  return value;
}

async function write<T>(key: string, value: T, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({where: {key}, create: {key, value: value as object, updatedBy: actorEmail}, update: {value: value as object, updatedBy: actorEmail}});
  cache.set(key, {value, at: Date.now()});
}

/** The storefront words of the accounts shelf (tab labels, heading, intro). */
export const getShelf = () => read<Shelf>('accounts-shelf', value => { const parsed = shelfSchema.safeParse(value); return parsed.success ? parsed.data : null; }, defaultShelf);
export const saveShelf = (value: Shelf, actorEmail: string) => write('accounts-shelf', value, actorEmail);

/** Hypixel options including the sealed key. Server only. */
export const getHypixelSettings = () => read<HypixelSettings>('hypixel', value => { const parsed = hypixelSettingsSchema.safeParse(value); return parsed.success ? parsed.data : null; }, defaultHypixelSettings);
export const saveHypixelSettings = (value: HypixelSettings, actorEmail: string) => write('hypixel', value, actorEmail);
