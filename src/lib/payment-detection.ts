import 'server-only';
import {allAdminEmails} from './admin-team';
import {recordAudit} from './audit';
import {addMessage, postPaymentMessage} from './chat-store';
import * as templates from './email-templates';
import {parseLtc} from './ltc-format';
import {sendMail} from './mailer';
import {notifyCustomer} from './notifications';
import {CRYPTO_METHODS, isCrypto, VN_TIME_ZONE} from './order-rules';
import {reReserveItems} from './order-stock';
import {findLtcPayment, REQUIRED_LTC_CONFIRMATIONS} from './payment-match';
import {getPaymentDb} from './payment-db';
import {findUsdtPayment, USDT_TRC20_CONTRACT} from './usdt';

const PAYABLE = ['awaiting_payment', 'payment_reported', 'expired'];

// ---------- Marking an order paid without an Admin ----------

/** Confirms a crypto payment found on the blockchain, then tells the customer and every Admin. */
export async function markPaidAutomatically(orderId: string, input: {amountVnd: number; reference: string; amountLabel: string}, origin: string) {
  const db = getPaymentDb();
  const order = await db.order.findUnique({where: {id: orderId}, include: {customer: {select: {id: true, name: true, email: true}}, slots: {orderBy: {startsAt: 'asc'}}}});
  if (!order || !PAYABLE.includes(order.status)) return false;
  const network = isCrypto(order.paymentMethod) ? CRYPTO_METHODS[order.paymentMethod].network : 'Litecoin';
  try {
    await db.$transaction(async tx => {
      if (order.status === 'expired') await reReserveItems(tx, orderId);
      const changed = await tx.order.updateMany({where: {id: orderId, status: order.status}, data: {
        status: 'paid', paidAt: new Date(), paidAmountVnd: input.amountVnd, paymentReference: input.reference.slice(0, 120),
        paymentConfirmedBy: 'auto:blockchain', paymentSource: 'blockchain', cancelledAt: null, cancelReason: null
      }});
      if (changed.count !== 1) throw new Error('Order changed');
      await tx.orderEvent.create({data: {orderId, actor: 'system', action: 'payment_confirmed', note: `Detected automatically on the ${network} blockchain: ${input.amountLabel}`}});
    }, {maxWait: 10000, timeout: 20000});
  } catch (error) {
    console.error('Automatic confirmation failed', error instanceof Error ? error.message : error);
    return false;
  }
  await recordAudit({actorEmail: 'system', action: 'order.payment_detected', summary: `Payment for ${order.code} detected automatically on the ${network} blockchain: ${input.amountLabel}`, entityType: 'order', entityId: orderId, customerId: order.customerId});
  await postPaymentMessage({customerId: order.customerId, code: order.code, customerTimeZone: order.customerTimeZone});
  const needsTimes = order.slots.length === 0 && !order.asap;
  await notifyCustomer({customerId: order.customerId, orderId, title: `Payment received · ${order.code}`, body: needsTimes ? 'Thank you! Your payment arrived. Tell us when you are free so we can book your appointment.' : 'Thank you! Your payment arrived. We will confirm your appointment shortly.', link: `/en/orders/${order.code}`});
  await sendMail({to: [order.customer.email], ...templates.customerPaymentConfirmed({code: order.code, name: order.customer.name, orderUrl: `${origin}/en/orders/${order.code}`}), kind: 'customer.payment_confirmed', orderId});
  await sendMail({to: await allAdminEmails(), ...templates.adminPaymentDetected({code: order.code, customerName: order.customer.name, amountLabel: input.amountLabel, network, slots: order.slots.map(slot => ({start: slot.startsAt, end: slot.endsAt})), asap: order.asap, orderUrl: `${origin}/en/admin/workspace/${orderId}`}), kind: 'admin.payment_detected', orderId});
  return true;
}

// ---------- Litecoin (public blockchain explorer) ----------

const EXPLORER = 'https://litecoinspace.org/api';
const cache = globalThis as unknown as {ltcAddressCache?: Map<string, {at: number; txs: unknown[]}>; ltcTip?: {at: number; height: number}; ltcChecks?: Map<string, number>};
const addressCache = cache.ltcAddressCache ??= new Map();
const recentChecks = cache.ltcChecks ??= new Map();

async function explorerJson(path: string) {
  const response = await fetch(`${EXPLORER}${path}`, {cache: 'no-store', signal: AbortSignal.timeout(6000), headers: {accept: 'application/json'}});
  if (!response.ok) throw new Error(`explorer ${response.status}`);
  return response.json();
}
async function addressTxs(address: string) {
  const hit = addressCache.get(address);
  if (hit && Date.now() - hit.at < 20_000) return hit.txs;
  const txs = await explorerJson(`/address/${encodeURIComponent(address)}/txs`) as unknown[];
  addressCache.set(address, {at: Date.now(), txs});
  return txs;
}
async function tipHeight() {
  if (cache.ltcTip && Date.now() - cache.ltcTip.at < 30_000) return cache.ltcTip.height;
  const height = Number(await explorerJson('/blocks/tip/height'));
  cache.ltcTip = {at: Date.now(), height};
  return height;
}

// ---------- USDT on TRON (TronGrid public API) ----------

const TRONGRID = 'https://api.trongrid.io';
const tronCache = globalThis as unknown as {usdtTransferCache?: Map<string, {at: number; transfers: unknown[]}>};
const transferCache = tronCache.usdtTransferCache ??= new Map();

/** Confirmed USDT transfers into the address during the last day (TronGrid lists only solidified blocks with only_confirmed). */
async function usdtTransfers(address: string) {
  const hit = transferCache.get(address);
  if (hit && Date.now() - hit.at < 20_000) return hit.transfers;
  const query = new URLSearchParams({only_to: 'true', only_confirmed: 'true', limit: '100', contract_address: USDT_TRC20_CONTRACT, min_timestamp: String(Date.now() - 26 * 60 * 60_000)});
  // An optional free TronGrid key raises the rate limit; the public endpoint works without one.
  const key = process.env.TRONGRID_API_KEY;
  const response = await fetch(`${TRONGRID}/v1/accounts/${encodeURIComponent(address)}/transactions/trc20?${query}`, {cache: 'no-store', signal: AbortSignal.timeout(6000), headers: {accept: 'application/json', ...(key ? {'TRON-PRO-API-KEY': key} : {})}});
  if (!response.ok) throw new Error(`trongrid ${response.status}`);
  const transfers = ((await response.json()) as {data?: unknown[]}).data ?? [];
  transferCache.set(address, {at: Date.now(), transfers});
  return transfers;
}

/** Looks for this order's exact USDT amount on TRON; a confirmed transfer marks the order paid. */
async function checkUsdt(order: {id: string; cryptoAmount: string; createdAt: Date; customerTxid: string | null; paymentSeenAt: Date | null; totalVnd: number}, address: string, origin: string) {
  const found = findUsdtPayment(await usdtTransfers(address) as Parameters<typeof findUsdtPayment>[0], address, order.cryptoAmount, order.createdAt);
  if (!found) return {seen: false};
  const db = getPaymentDb();
  await db.order.update({where: {id: order.id}, data: {customerTxid: order.customerTxid ?? found.txid, ...(order.paymentSeenAt ? {} : {paymentSeenAt: new Date()})}});
  if (!order.paymentSeenAt) await db.orderEvent.create({data: {orderId: order.id, actor: 'system', action: 'payment_seen', note: `TRON transaction seen: ${found.txid.slice(0, 16)}…`}});
  await markPaidAutomatically(order.id, {amountVnd: order.totalVnd, reference: found.txid, amountLabel: `${order.cryptoAmount} USDT`}, origin);
  return {seen: true, confirmations: null};
}

/** Looks for this order's exact crypto amount on its blockchain and confirms it once it is final. */
export async function checkCryptoOrder(orderId: string, origin: string, {force = false} = {}) {
  const last = recentChecks.get(orderId) ?? 0;
  if (!force && Date.now() - last < 20_000) return null;
  recentChecks.set(orderId, Date.now());
  const db = getPaymentDb();
  const order = await db.order.findUnique({where: {id: orderId}, select: {id: true, status: true, paymentMethod: true, cryptoAmount: true, bankSnapshot: true, createdAt: true, customerTxid: true, paymentSeenAt: true, totalVnd: true}});
  if (!order || !isCrypto(order.paymentMethod) || !order.cryptoAmount || !PAYABLE.includes(order.status)) return null;
  if (order.status === 'expired' && Date.now() - order.createdAt.getTime() > 24 * 60 * 60_000) return null;
  const address = (order.bankSnapshot as {address?: string}).address;
  if (!address) return null;
  if (order.paymentMethod === 'usdt') {
    try { return await checkUsdt({...order, cryptoAmount: order.cryptoAmount}, address, origin); }
    catch (error) { console.error('USDT check failed', error instanceof Error ? error.message : error); return null; }
  }
  const litoshi = parseLtc(order.cryptoAmount);
  if (litoshi === null) return null;
  try {
    const [txs, tip] = await Promise.all([addressTxs(address), tipHeight()]);
    const found = findLtcPayment(txs as Parameters<typeof findLtcPayment>[0], address, litoshi, order.createdAt, tip);
    if (!found) return {seen: false};
    await db.order.update({where: {id: orderId}, data: {txConfirmations: found.confirmations, customerTxid: order.customerTxid ?? found.txid, ...(order.paymentSeenAt ? {} : {paymentSeenAt: new Date()})}});
    if (!order.paymentSeenAt) await db.orderEvent.create({data: {orderId, actor: 'system', action: 'payment_seen', note: `Litecoin transaction seen: ${found.txid.slice(0, 16)}…`}});
    if (found.confirmations >= REQUIRED_LTC_CONFIRMATIONS) await markPaidAutomatically(orderId, {amountVnd: order.totalVnd, reference: found.txid, amountLabel: `${order.cryptoAmount} LTC`}, origin);
    return {seen: true, confirmations: found.confirmations};
  } catch (error) {
    console.error('Litecoin check failed', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function checkOpenCryptoOrders(origin: string) {
  const open = await getPaymentDb().order.findMany({where: {paymentMethod: {in: Object.keys(CRYPTO_METHODS)}, status: {in: ['awaiting_payment', 'payment_reported']}}, select: {id: true}, take: 50});
  for (const order of open) await checkCryptoOrder(order.id, origin);
  return open.length;
}

// ---------- Appointment reminders and "we are ready now" ----------

/** Chat message, Inbox entry and emails telling the customer the appointment starts soon or now. */
export async function alertAppointment(orderId: string, origin: string, now: boolean, {email = true} = {}) {
  const db = getPaymentDb();
  const order = await db.order.findUnique({where: {id: orderId}, include: {customer: {select: {id: true, name: true, email: true}}}});
  if (!order?.appointmentStart || !order.appointmentEnd) return false;
  const claimed = await db.order.updateMany({where: {id: orderId, reminderSentAt: null}, data: {reminderSentAt: new Date()}});
  if (claimed.count !== 1 && !now) return false;
  const orderUrl = `${origin}/en/orders/${order.code}`;
  const time = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', timeZone: order.customerTimeZone ?? VN_TIME_ZONE}).format(order.appointmentStart);
  await addMessage({customerId: order.customerId, role: 'admin', authorName: 'Jewish Horse', body: now ? `We are ready for your order ${order.code} now. Reply here to start.` : `Reminder: your appointment for order ${order.code} starts at ${time}. We will talk here in this chat.`});
  await notifyCustomer({customerId: order.customerId, orderId, title: now ? `We are ready now · ${order.code}` : `Appointment at ${time} · ${order.code}`, body: 'Open Chat on this website to receive your order.', link: '/en/workspace'});
  if (email) await sendMail({to: [order.customer.email], ...templates.customerReminder({code: order.code, name: order.customer.name, start: order.appointmentStart, end: order.appointmentEnd, timeZone: order.customerTimeZone ?? VN_TIME_ZONE, orderUrl, now}), kind: now ? 'customer.ready_now' : 'customer.reminder', orderId});
  if (!now && order.assignedAdmin) await sendMail({to: [order.assignedAdmin], ...templates.adminReminder({code: order.code, customerName: order.customer.name, start: order.appointmentStart, end: order.appointmentEnd, orderUrl: `${origin}/en/admin/workspace/${orderId}`}), kind: 'admin.reminder', orderId});
  return true;
}

/** Reminders for appointments starting within the next 20 minutes (called by the scheduled tick). */
export async function sendDueReminders(origin: string) {
  const now = Date.now();
  const due = await getPaymentDb().order.findMany({where: {status: 'scheduled', reminderSentAt: null, appointmentStart: {gte: new Date(now - 10 * 60_000), lte: new Date(now + 20 * 60_000)}}, select: {id: true}, take: 20});
  let sent = 0;
  for (const order of due) if (await alertAppointment(order.id, origin, false)) sent++;
  return sent;
}
