import 'server-only';
import {getPaymentDb} from './payment-db';
import {getVndPerUsd} from './store-settings';

export type LtcRate = {vndPerLtc: number; source: 'manual' | 'coingecko' | 'binance'};
const OVERRIDE_KEY = 'ltcVndOverride';
const CACHE_MS = 5 * 60_000;
const store = globalThis as unknown as {ltcRateCache?: {rate: LtcRate; at: number}};

async function fetchJson(url: string) {
  const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(4000), headers: {accept: 'application/json'}});
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json();
}

export async function getLtcOverride() {
  if (!process.env.DATABASE_URL) return null;
  const row = await getPaymentDb().storeSetting.findUnique({where: {key: OVERRIDE_KEY}}).catch(() => null);
  return typeof row?.value === 'number' && Number.isInteger(row.value) && row.value > 0 ? row.value : null;
}

export async function setLtcOverride(value: number | null, actorEmail: string) {
  const db = getPaymentDb();
  if (value === null) await db.storeSetting.deleteMany({where: {key: OVERRIDE_KEY}});
  else await db.storeSetting.upsert({where: {key: OVERRIDE_KEY}, create: {key: OVERRIDE_KEY, value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
  store.ltcRateCache = undefined;
}

/** VND per 1 LTC: Admin override, else the market price (CoinGecko, then Binance LTC/USDT × the VND/USD rate). */
export async function getLtcRate(): Promise<LtcRate | null> {
  const override = await getLtcOverride();
  if (override) return {vndPerLtc: override, source: 'manual'};
  const hit = store.ltcRateCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.rate;
  let rate: LtcRate | null = null;
  try {
    const body = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=vnd') as {litecoin?: {vnd?: number}};
    if (body.litecoin?.vnd && body.litecoin.vnd > 0) rate = {vndPerLtc: Math.round(body.litecoin.vnd), source: 'coingecko'};
  } catch { /* try the fallback */ }
  if (!rate) {
    try {
      const body = await fetchJson('https://api.binance.com/api/v3/ticker/price?symbol=LTCUSDT') as {price?: string};
      const usd = Number(body.price);
      if (usd > 0) rate = {vndPerLtc: Math.round(usd * await getVndPerUsd()), source: 'binance'};
    } catch { /* no market price available */ }
  }
  if (rate) store.ltcRateCache = {rate, at: Date.now()};
  return rate ?? hit?.rate ?? null;
}
