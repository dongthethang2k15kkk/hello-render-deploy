import 'server-only';
import {getPaymentDb} from './payment-db';
import {completedTradeTotal, parseTradeCounterSettings, type TradeCounterSettings} from './trade-counter-rules';

/** The public trust line combines Admin's historical count with real completed shop orders. */
export type TradeStats = {completed: number};
export type TradeCounterState = TradeCounterSettings & {shopCompleted: number; total: number};

const KEY = 'tradeCounter';
const CACHE_MS = 60_000;
const store = globalThis as unknown as {tradeStatsCache?: {value: TradeStats; at: number}};

export function invalidateTradeStats() {
  delete store.tradeStatsCache;
}

async function readTradeCounterState(): Promise<TradeCounterState> {
  const db = getPaymentDb();
  const [row, shopCompleted] = await Promise.all([
    db.storeSetting.findUnique({where: {key: KEY}, select: {value: true}}),
    db.order.count({where: {status: 'completed'}})
  ]);
  const settings = parseTradeCounterSettings(row?.value);
  return {...settings, shopCompleted, total: completedTradeTotal(settings.historicalCompleted, shopCompleted)};
}

export async function getTradeCounterState(): Promise<TradeCounterState> {
  if (!process.env.DATABASE_URL) return {historicalCompleted: 0, shopCompleted: 0, total: 0};
  return readTradeCounterState();
}

export async function setTradeCounterSettings(settings: TradeCounterSettings, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({
    where: {key: KEY},
    create: {key: KEY, value: settings, updatedBy: actorEmail},
    update: {value: settings, updatedBy: actorEmail}
  });
  invalidateTradeStats();
}

export async function getTradeStats(): Promise<TradeStats> {
  const hit = store.tradeStatsCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const empty: TradeStats = {completed: 0};
  if (!process.env.DATABASE_URL) return empty;
  try {
    const state = await readTradeCounterState();
    const value = {completed: state.total};
    store.tradeStatsCache = {value, at: Date.now()};
    return value;
  } catch { return hit?.value ?? empty; }
}
