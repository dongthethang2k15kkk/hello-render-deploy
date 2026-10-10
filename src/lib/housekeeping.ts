import 'server-only';
import {expireStaleOrders} from './order-store';
import {checkOpenCryptoOrders, sendDueReminders} from './payment-detection';
import {refreshDueAccountStats} from './skyblock-fetch';

const state = globalThis as unknown as {lastHousekeeping?: number};

/**
 * Expires unpaid orders, checks open crypto payments and sends appointment reminders. Every step only does work
 * that is due and never twice, so callers may run it often; runs closer together than `minGapMs` are skipped.
 */
export async function runHousekeeping(origin: string, minGapMs = 60_000) {
  if (state.lastHousekeeping && Date.now() - state.lastHousekeeping < minGapMs) return null;
  state.lastHousekeeping = Date.now();
  await expireStaleOrders();
  const ltcChecked = await checkOpenCryptoOrders(origin);
  const reminders = await sendDueReminders(origin);
  // Keeps the stats of accounts for sale fresh (a few per run, only when an Admin set a Hypixel key and an interval).
  const accountsRefreshed = await refreshDueAccountStats().catch(() => 0);
  return {ltcChecked, reminders, accountsRefreshed};
}
