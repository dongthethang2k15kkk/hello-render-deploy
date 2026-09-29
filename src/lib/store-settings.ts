import 'server-only';
import {DEFAULT_VND_PER_USD, validVndPerUsd} from './money';
import {getPaymentDb} from './payment-db';

const CACHE_MS = 60_000;
const store = globalThis as unknown as {vndPerUsdCache?: {value: number; at: number}};

/** VND per USD used only to display USD prices. Falls back to the default when unset or unreadable. */
export async function getVndPerUsd() {
  const hit = store.vndPerUsdCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value = DEFAULT_VND_PER_USD;
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: 'vndPerUsd'}});
      if (validVndPerUsd(row?.value)) value = row.value;
    } catch { /* keep default */ }
  }
  store.vndPerUsdCache = {value, at: Date.now()};
  return value;
}

export async function setVndPerUsd(value: number, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({where: {key: 'vndPerUsd'}, create: {key: 'vndPerUsd', value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
  store.vndPerUsdCache = {value, at: Date.now()};
}
