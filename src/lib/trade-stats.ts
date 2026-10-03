import 'server-only';
import {lineAmount} from './amount-slider-rules';
import {getPaymentDb} from './payment-db';

/** Real completed trades for the store's trust line: a count and the latest few, without any customer names. */
export type TradeStats = {completed: number; recent: {label: string; at: string}[]};

const CACHE_MS = 60_000;
const store = globalThis as unknown as {tradeStatsCache?: {value: TradeStats; at: number}};

export async function getTradeStats(): Promise<TradeStats> {
  const hit = store.tradeStatsCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const empty: TradeStats = {completed: 0, recent: []};
  if (!process.env.DATABASE_URL) return empty;
  try {
    const db = getPaymentDb();
    const [completed, rows] = await Promise.all([
      db.order.count({where: {status: 'completed'}}),
      db.order.findMany({where: {status: 'completed', completedAt: {not: null}}, orderBy: {completedAt: 'desc'}, take: 3, select: {completedAt: true, items: {select: {title: true, quantity: true}}}})
    ]);
    const value = {completed, recent: rows.map(row => ({label: row.items.map(item => lineAmount(item.title, item.quantity)).join(' + '), at: row.completedAt!.toISOString()}))};
    store.tradeStatsCache = {value, at: Date.now()};
    return value;
  } catch { return hit?.value ?? empty; }
}
