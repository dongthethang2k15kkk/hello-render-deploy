// Prices are stored and charged in whole VND; USD is a display conversion using the Admin-set rate.
export const DEFAULT_VND_PER_USD = 26000;

const vndFormat = new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 0});
const usdFormat = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'});

export function formatVnd(vnd: number) {
  return `${vndFormat.format(Math.round(vnd))} ₫`;
}

export function vndToUsdCents(vnd: number, vndPerUsd: number) {
  if (!Number.isFinite(vndPerUsd) || vndPerUsd <= 0) return 0;
  return Math.round((vnd * 100) / vndPerUsd);
}

export function formatUsdFromVnd(vnd: number, vndPerUsd: number) {
  return usdFormat.format(vndToUsdCents(vnd, vndPerUsd) / 100);
}

export function validVndPerUsd(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1000 && value <= 1_000_000;
}
