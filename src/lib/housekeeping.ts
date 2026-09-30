import 'server-only';
import {expireStaleOrders} from './order-store';
import {checkOpenLtcOrders, sendDueReminders} from './payment-detection';

const state = globalThis as unknown as {lastHousekeeping?: number};

/**
 * Expires unpaid orders, checks open Litecoin payments and sends appointment reminders. Every step only does work
 * that is due and never twice, so callers may run it often; runs closer together than `minGapMs` are skipped.
 */
export async function runHousekeeping(origin: string, minGapMs = 60_000) {
  if (state.lastHousekeeping && Date.now() - state.lastHousekeeping < minGapMs) return null;
  state.lastHousekeeping = Date.now();
  await expireStaleOrders();
  const ltcChecked = await checkOpenLtcOrders(origin);
  const reminders = await sendDueReminders(origin);
  return {ltcChecked, reminders};
}
