// Pure exchange-rate rules (no Node.js or Prisma imports) shared by the server, the storefront and unit tests.

export type RateMode = 'auto' | 'fixed';
/** A provider name = live market data, "fixed" = the Admin fixed the rate, "fallback" = no market data, so the fixed value stands in. */
export type UsdRateSource = 'currency-api' | 'fixed' | 'fallback';
export type LtcRateSource = 'coinbase' | 'coingecko' | 'kraken' | 'binance' | 'fixed' | 'fallback';

// Sanity bounds: a market answer outside these is treated as broken data, never shown or charged.
const VND_PER_USD_RANGE = {min: 10_000, max: 100_000};
const VND_PER_LTC_RANGE = {min: 10_000, max: 1_000_000_000};

export const isRateMode = (value: unknown): value is RateMode => value === 'auto' || value === 'fixed';

export function validVndPerLtc(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 1_000_000_000;
}

const within = (value: unknown, range: {min: number; max: number}) => typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max ? value : null;

/** VND per USD from the currency-api files (`{date, usd: {vnd: 25934.41, …}}`). */
export function parseCurrencyApiVnd(body: unknown) {
  return within((body as {usd?: {vnd?: unknown}} | null)?.usd?.vnd, VND_PER_USD_RANGE);
}

/** VND per LTC from Coinbase `prices/LTC-VND/spot` (`{data: {amount: "1742723.81", base: "LTC", currency: "VND"}}`). */
export function parseCoinbaseVndPerLtc(body: unknown) {
  const data = (body as {data?: {amount?: unknown; base?: unknown; currency?: unknown}} | null)?.data;
  return data?.base === 'LTC' && data.currency === 'VND' ? within(Number(data.amount), VND_PER_LTC_RANGE) : null;
}

/** VND per LTC from CoinGecko `simple/price?ids=litecoin&vs_currencies=vnd`. */
export function parseCoingeckoVndPerLtc(body: unknown) {
  return within((body as {litecoin?: {vnd?: unknown}} | null)?.litecoin?.vnd, VND_PER_LTC_RANGE);
}

const fromUsd = (usd: number, vndPerUsd: number) => Number.isFinite(usd) && usd > 0 ? within(usd * vndPerUsd, VND_PER_LTC_RANGE) : null;

/** VND per LTC from Kraken's LTC/USD ticker (last trade in `result.<pair>.c[0]`) and a VND/USD rate. */
export function vndPerLtcFromKraken(body: unknown, vndPerUsd: number) {
  const pair = Object.values((body as {result?: Record<string, {c?: unknown[]}>} | null)?.result ?? {})[0];
  return fromUsd(Number(pair?.c?.[0]), vndPerUsd);
}

/** VND per LTC from Binance's LTC/USDT ticker (`{price: "66.99"}`) and a VND/USD rate. */
export function vndPerLtcFromBinance(body: unknown, vndPerUsd: number) {
  return fromUsd(Number((body as {price?: unknown} | null)?.price), vndPerUsd);
}

const ltcEstimate = new Intl.NumberFormat('en-US', {maximumSignificantDigits: 4});

/** "0.3250 LTC"-style estimate for showing a VND price in Litecoin; the exact amount is fixed when the order is placed. */
export function formatLtcEstimate(vnd: number, vndPerLtc: number) {
  if (!Number.isFinite(vnd) || vnd <= 0 || !Number.isFinite(vndPerLtc) || vndPerLtc <= 0) return '';
  return `${ltcEstimate.format(vnd / vndPerLtc)} LTC`;
}
