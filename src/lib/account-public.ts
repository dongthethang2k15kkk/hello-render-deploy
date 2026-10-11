import 'server-only';
import {accountCodePattern, effectivePrice} from './account-rules';
import {getShelf} from './accounts-settings';
import {getPaymentDb} from './payment-db';
import {accountStatsSchema} from './skyblock-stats';

/**
 * What a visitor may see of one account: the stored snapshot, screenshots and description. Never the login details, and the
 * in-game name only when the Admin switched "Show IGN" on for this account. Null for anything not on sale (404).
 */
export async function publicAccount(code: string) {
  if (!accountCodePattern.test(code) || !process.env.DATABASE_URL) return null;
  if (!(await getShelf()).enabled) return null;
  const row = await getPaymentDb().gameAccount.findUnique({where: {code}, select: {id: true, code: true, ign: true, showIgn: true, profileName: true, title: true, description: true, priceVnd: true, salePriceVnd: true, status: true, imagePaths: true, stats: true, statsFetchedAt: true, statsSource: true}});
  if (!row || (row.status !== 'available' && row.status !== 'reserved')) return null;
  const stats = accountStatsSchema.safeParse(row.stats);
  const price = effectivePrice(row);
  return {
    id: row.id, code: row.code, title: row.title, description: row.description, status: row.status as 'available' | 'reserved',
    priceVnd: price, basePriceVnd: row.priceVnd, salePriceVnd: price < row.priceVnd ? price : null,
    ign: row.showIgn ? row.ign : null, profileName: row.profileName,
    images: (Array.isArray(row.imagePaths) ? row.imagePaths : []).filter((path): path is string => typeof path === 'string'),
    stats: stats.success ? stats.data : null, statsFetchedAt: row.statsFetchedAt?.toISOString() ?? null, statsSource: row.statsSource
  };
}
export type PublicAccount = NonNullable<Awaited<ReturnType<typeof publicAccount>>>;
