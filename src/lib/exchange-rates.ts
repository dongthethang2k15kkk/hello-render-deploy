import 'server-only';
import {DEFAULT_VND_PER_USD, validVndPerUsd} from './money';
import {getPaymentDb} from './payment-db';
import {isRateMode, parseCoinbaseVndPerLtc, parseCoingeckoVndPerLtc, parseCurrencyApiVnd, validVndPerLtc, vndPerLtcFromBinance, vndPerLtcFromKraken, type LtcRateSource, type RateMode, type UsdRateSource} from './exchange-rate-rules';

// Live VND/USD and VND/LTC rates with an Admin switch per rate: "auto" follows the market, "fixed" uses the Admin's number.
// The fixed numbers keep their old setting keys and also stand in when no market rate can be fetched.
const KEYS = {usdMode: 'vndPerUsdMode', usdFixed: 'vndPerUsd', ltcMode: 'ltcRateMode', ltcFixed: 'ltcVndOverride'} as const;

export type RateSettings = {usdMode: RateMode; usdFixed: number; ltcMode: RateMode; ltcFixed: number | null};
export type UsdRate = {vndPerUsd: number; source: UsdRateSource; updatedAt: string | null};
export type LtcRate = {vndPerLtc: number; source: LtcRateSource; updatedAt: string | null};
type Market<S> = {value: number; source: S; at: number};

const SETTINGS_CACHE_MS = 30_000;
const USD_MAX_AGE_MS = 30 * 60_000; // the providers publish VND/USD about once a day
const LTC_MAX_AGE_MS = 60_000;
const RETRY_AFTER_FAILURE_MS = 2 * 60_000;

const cache = globalThis as unknown as {fxRates?: {
  settings?: {value: RateSettings; at: number};
  usd?: Market<UsdRateSource>; usdFailedAt?: number; usdPending?: Promise<Market<UsdRateSource> | null>;
  ltc?: Market<LtcRateSource>; ltcFailedAt?: number; ltcPending?: Promise<Market<LtcRateSource> | null>;
}};
const fx = () => (cache.fxRates ??= {});
// Tests and offline machines use the fixed numbers only (no network calls).
const offline = () => process.env.EXCHANGE_RATES_OFFLINE === '1';

async function fetchJson(url: string) {
  const response = await fetch(url, {cache: 'no-store', signal: AbortSignal.timeout(4000), headers: {accept: 'application/json'}});
  if (!response.ok) throw new Error(`${response.status}`);
  return response.json() as Promise<unknown>;
}

export async function getRateSettings(): Promise<RateSettings> {
  const hit = fx().settings;
  if (hit && Date.now() - hit.at < SETTINGS_CACHE_MS) return hit.value;
  const value: RateSettings = {usdMode: 'auto', usdFixed: DEFAULT_VND_PER_USD, ltcMode: 'auto', ltcFixed: null};
  if (process.env.DATABASE_URL) {
    try {
      const rows = await getPaymentDb().storeSetting.findMany({where: {key: {in: Object.values(KEYS)}}});
      const read = (key: string) => rows.find(row => row.key === key)?.value;
      if (isRateMode(read(KEYS.usdMode))) value.usdMode = read(KEYS.usdMode) as RateMode;
      if (validVndPerUsd(read(KEYS.usdFixed))) value.usdFixed = read(KEYS.usdFixed) as number;
      if (isRateMode(read(KEYS.ltcMode))) value.ltcMode = read(KEYS.ltcMode) as RateMode;
      if (validVndPerLtc(read(KEYS.ltcFixed))) value.ltcFixed = read(KEYS.ltcFixed) as number;
    } catch { /* keep the defaults */ }
  }
  fx().settings = {value, at: Date.now()};
  return value;
}

async function saveSetting(key: string, value: string | number | null, actorEmail: string) {
  const db = getPaymentDb();
  if (value === null) await db.storeSetting.deleteMany({where: {key}});
  else await db.storeSetting.upsert({where: {key}, create: {key, value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
}

export async function saveUsdRateSettings(input: {mode: RateMode; vndPerUsd: number}, actorEmail: string) {
  await saveSetting(KEYS.usdMode, input.mode, actorEmail);
  await saveSetting(KEYS.usdFixed, input.vndPerUsd, actorEmail);
  fx().settings = undefined;
}

export async function saveLtcRateSettings(input: {mode: RateMode; vndPerLtc: number | null}, actorEmail: string) {
  await saveSetting(KEYS.ltcMode, input.mode, actorEmail);
  await saveSetting(KEYS.ltcFixed, input.vndPerLtc, actorEmail);
  fx().settings = undefined;
}

/**
 * Cached market value. A fresh entry is returned at once; a stale one too (refreshed in the background) unless the
 * caller needs a fresh price, e.g. to lock an order. Failures are retried at most every two minutes.
 */
async function market<S>(kind: 'usd' | 'ltc', maxAgeMs: number, needFresh: boolean, load: () => Promise<{value: number; source: S} | null>): Promise<Market<S> | null> {
  const state = fx() as Record<string, unknown>;
  const hit = state[kind] as Market<S> | undefined;
  if (hit && Date.now() - hit.at < maxAgeMs) return hit;
  const failedAt = state[`${kind}FailedAt`] as number | undefined;
  let pending = state[`${kind}Pending`] as Promise<Market<S> | null> | undefined;
  if (!pending && !(failedAt && Date.now() - failedAt < RETRY_AFTER_FAILURE_MS)) {
    pending = load().catch(() => null).then(result => {
      if (result) state[kind] = {...result, at: Date.now()};
      else state[`${kind}FailedAt`] = Date.now();
      return (state[kind] as Market<S> | undefined) ?? null;
    }).finally(() => { state[`${kind}Pending`] = undefined; });
    state[`${kind}Pending`] = pending;
  }
  if (hit && !needFresh) return hit;
  return (pending ? await pending : null) ?? hit ?? null;
}

function marketUsd(needFresh = false) {
  if (offline()) return Promise.resolve(null);
  return market<UsdRateSource>('usd', USD_MAX_AGE_MS, needFresh, async () => {
    for (const url of ['https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', 'https://latest.currency-api.pages.dev/v1/currencies/usd.json']) {
      const value = parseCurrencyApiVnd(await fetchJson(url).catch(() => null));
      if (value) return {value, source: 'currency-api'};
    }
    return null;
  });
}

function marketLtc(needFresh = false) {
  if (offline()) return Promise.resolve(null);
  // Render runs in the US: Binance refuses US addresses and CoinGecko often rate-limits cloud servers, so Coinbase goes first.
  return market<LtcRateSource>('ltc', LTC_MAX_AGE_MS, needFresh, async () => {
    const coinbase = parseCoinbaseVndPerLtc(await fetchJson('https://api.coinbase.com/v2/prices/LTC-VND/spot').catch(() => null));
    if (coinbase) return {value: coinbase, source: 'coinbase'};
    const coingecko = parseCoingeckoVndPerLtc(await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=vnd').catch(() => null));
    if (coingecko) return {value: coingecko, source: 'coingecko'};
    const vndPerUsd = (await getUsdRate()).vndPerUsd;
    const kraken = vndPerLtcFromKraken(await fetchJson('https://api.kraken.com/0/public/Ticker?pair=LTCUSD').catch(() => null), vndPerUsd);
    if (kraken) return {value: kraken, source: 'kraken'};
    const binance = vndPerLtcFromBinance(await fetchJson('https://api.binance.com/api/v3/ticker/price?symbol=LTCUSDT').catch(() => null), vndPerUsd);
    return binance ? {value: binance, source: 'binance'} : null;
  });
}

const stamp = (at: number) => new Date(at).toISOString();

/** VND per USD for showing USD prices: the market rate in "auto" mode, else (or when unavailable) the Admin's number. */
export async function getUsdRate(): Promise<UsdRate> {
  const settings = await getRateSettings();
  if (settings.usdMode === 'fixed') return {vndPerUsd: settings.usdFixed, source: 'fixed', updatedAt: null};
  const live = await marketUsd();
  return live ? {vndPerUsd: Math.round(live.value), source: live.source, updatedAt: stamp(live.at)} : {vndPerUsd: settings.usdFixed, source: 'fallback', updatedAt: null};
}

export async function getVndPerUsd() {
  return (await getUsdRate()).vndPerUsd;
}

/** VND per LTC, or null when there is no price at all. `fresh` waits for a price at most a minute old (used to lock orders). */
export async function getLtcRate({fresh = false} = {}): Promise<LtcRate | null> {
  const settings = await getRateSettings();
  if (settings.ltcMode === 'fixed' && settings.ltcFixed) return {vndPerLtc: settings.ltcFixed, source: 'fixed', updatedAt: null};
  const live = await marketLtc(fresh);
  if (live) return {vndPerLtc: Math.round(live.value), source: live.source, updatedAt: stamp(live.at)};
  return settings.ltcFixed ? {vndPerLtc: settings.ltcFixed, source: 'fallback', updatedAt: null} : null;
}

/** Market prices regardless of the Admin's mode, so Settings can compare them with a fixed rate. */
export async function getMarketRates() {
  const [usd, ltc] = await Promise.all([marketUsd(true), marketLtc(true)]);
  return {
    usd: usd ? {vndPerUsd: Math.round(usd.value), source: usd.source, updatedAt: stamp(usd.at)} : null,
    ltc: ltc ? {vndPerLtc: Math.round(ltc.value), source: ltc.source, updatedAt: stamp(ltc.at)} : null
  };
}
