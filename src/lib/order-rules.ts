// Pure order rules shared by the server and the browser (no Node.js imports).
import {z} from 'zod';

export const HOLD_MINUTES = 30;
/** The "I've transferred" button unlocks this long after ordering, so customers pay before they report. */
export const REPORT_DELAY_SECONDS = 30;
/** Shown as soon as a customer ticks "I'm free right now": Admins may be busy, so one more time is required. */
export const ASAP_NOTICE = 'An Admin may not be free right now. Please add at least one more time you are free today, so we can still book you.';
/** "Free right now" alone is not enough: at least one later time must come with it. */
export function asapProblem(asap: boolean | undefined, slots: unknown[]) {
  return asap && slots.length < 2 ? ASAP_NOTICE : null;
}
export const MAX_SLOTS = 5;

/** Crypto payment methods: the coin customers send and the network it travels on. */
export const CRYPTO_METHODS = {ltc: {coin: 'LTC', network: 'Litecoin'}, usdt: {coin: 'USDT', network: 'TRON (TRC20)'}} as const;
export type CryptoMethod = keyof typeof CRYPTO_METHODS;
export const isCrypto = (method: string): method is CryptoMethod => Object.hasOwn(CRYPTO_METHODS, method);
export const PAYMENT_METHODS = ['bank', 'ltc', 'usdt', 'paypal'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];
/** Which payment screen an order uses. Always decide by the method: the snapshot's shape no longer tells banks, wallets and PayPal apart. */
export const paymentKind = (order: {paymentMethod: string}): 'bank' | 'crypto' | 'paypal' => order.paymentMethod === 'paypal' ? 'paypal' : isCrypto(order.paymentMethod) ? 'crypto' : 'bank';
/** Where the customer pays, copied onto the order when it is placed (`Order.bankSnapshot`). */
export type BankSnapshot = {bankBin: string; bankName: string; accountNumber: string; accountHolder: string};
export type WalletSnapshot = {network: 'LTC' | 'TRC20'; address: string; label: string};
export type PaypalSnapshot = {paypalMe: string; email: string | null; instructions: string};
export type PaymentSnapshot = BankSnapshot | WalletSnapshot | PaypalSnapshot;
/** Block explorer page for a crypto transaction. */
export const explorerTx = (method: string, txid: string) => method === 'usdt' ? `https://tronscan.org/#/transaction/${txid}` : `https://litecoinspace.org/tx/${txid}`;
export const explorerAddress = (method: string, address: string) => method === 'usdt' ? `https://tronscan.org/#/address/${address}` : `https://litecoinspace.org/address/${address}`;
export const ORDER_STATUSES = ['awaiting_payment', 'payment_reported', 'paid', 'scheduled', 'completed', 'cancelled', 'expired'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const statusLabels: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  payment_reported: 'Checking payment',
  paid: 'Paid · booking a time',
  scheduled: 'Appointment booked',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired'
};

export const statusTone: Record<OrderStatus, 'warn' | 'ok' | 'danger' | 'info'> = {
  awaiting_payment: 'warn', payment_reported: 'warn', paid: 'info', scheduled: 'info', completed: 'ok', cancelled: 'danger', expired: 'danger'
};

/** Statuses an Admin must act on: confirm a reported payment, or book a time for a paid order. */
export const NEEDS_ACTION: OrderStatus[] = ['payment_reported', 'paid'];

type Action = 'report' | 'confirm-payment' | 'schedule' | 'complete' | 'cancel-customer' | 'cancel-admin' | 'expire';
const transitions: Record<Action, {from: OrderStatus[]; to: OrderStatus}> = {
  report: {from: ['awaiting_payment'], to: 'payment_reported'},
  // Admin may confirm money that arrived before the customer pressed "I've transferred", or after the hold expired.
  'confirm-payment': {from: ['awaiting_payment', 'payment_reported', 'expired'], to: 'paid'},
  schedule: {from: ['paid', 'scheduled'], to: 'scheduled'},
  complete: {from: ['paid', 'scheduled'], to: 'completed'},
  'cancel-customer': {from: ['awaiting_payment'], to: 'cancelled'},
  'cancel-admin': {from: ['awaiting_payment', 'payment_reported', 'paid', 'scheduled'], to: 'cancelled'},
  expire: {from: ['awaiting_payment'], to: 'expired'}
};

export function nextStatus(status: string, action: Action): OrderStatus | null {
  const rule = transitions[action];
  return rule.from.includes(status as OrderStatus) ? rule.to : null;
}

/** Stock is reserved while an order is live and returned when it is cancelled or expires. */
export function holdsStock(status: string) {
  return status !== 'cancelled' && status !== 'expired';
}

// Crockford-style alphabet without look-alikes (0/O, 1/I/L, U) so codes survive being typed into banking apps.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
export function generateOrderCode(random: (size: number) => Uint8Array = size => globalThis.crypto.getRandomValues(new Uint8Array(size))) {
  return 'JH' + Array.from(random(6), byte => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}
export const orderCodePattern = /^JH[2-9A-HJ-NP-TV-Z]{6}$/;

export function validTimeZone(value: string) {
  try { new Intl.DateTimeFormat('en-US', {timeZone: value}); return value.length <= 64; } catch { return false; }
}

const slot = z.object({start: z.string().datetime({offset: true}), end: z.string().datetime({offset: true})}).strict();
const slotList = z.array(slot).min(1, 'Add at least one time.').max(MAX_SLOTS, `Add at most ${MAX_SLOTS} times.`);
/** When the customer can trade: chosen at checkout, or changed later until the appointment is booked. */
export const timingSchema = z.object({timeZone: z.string().max(64), slots: slotList, asap: z.boolean().optional()}).strict();
export const reportSchema = z.object({
  // Orders placed with times at checkout keep them; older orders send their times with the report.
  timeZone: z.string().max(64).optional(),
  slots: slotList.optional(),
  // Optional crypto transaction id (Litecoin or TRON) so the shop can find the payment quickly.
  txid: z.string().trim().regex(/^[0-9a-fA-F]{64}$/, 'The transaction ID is 64 letters and digits (0-9, a-f).').optional().or(z.literal('').transform(() => undefined)),
  // Optional PayPal transaction ID (17 capital letters and digits), kept in capitals.
  paypalTxid: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{17}$/, 'The PayPal transaction ID is 17 letters and digits.').optional().or(z.literal('').transform(() => undefined)),
  // "I am free right now": the shop can start as soon as an Admin is available.
  asap: z.boolean().optional()
}).strict();

/** Checks customer time windows: future (≥ 15 min), within 30 days, 30 min to 12 h long. Returns an error message or null. */
export function slotProblem(slots: {start: string; end: string}[], now = Date.now()) {
  for (const [index, item] of slots.entries()) {
    const start = Date.parse(item.start); const end = Date.parse(item.end);
    const label = `Time ${index + 1}`;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return `${label} is not a valid date.`;
    if (start < now - 10 * 60_000) return `${label} must not be in the past.`;
    if (start > now + 30 * 24 * 60 * 60_000) return `${label} must be within the next 30 days.`;
    if (end - start < 30 * 60_000) return `${label} must be at least 30 minutes long.`;
    if (end - start > 12 * 60 * 60_000) return `${label} must be at most 12 hours long.`;
  }
  return null;
}

/** Appointment set by Admin: future start, 15 min to 8 h. */
export function appointmentProblem(start: number, end: number, now = Date.now()) {
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'Choose a valid start and end time.';
  if (start < now - 5 * 60_000) return 'The appointment must be in the future.';
  if (end - start < 15 * 60_000) return 'The appointment must be at least 15 minutes long.';
  if (end - start > 8 * 60 * 60_000) return 'The appointment must be at most 8 hours long.';
  return null;
}

export const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';
/** "YYYY-MM-DDTHH:mm" entered in Vietnam time (UTC+7, no daylight saving) to a Date. */
export function vietnamLocalToDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? new Date(`${value}:00+07:00`) : new Date(NaN);
}
/** Date to the "YYYY-MM-DDTHH:mm" value of a datetime-local input in Vietnam time. */
export function dateToVietnamLocal(date: Date) {
  return new Date(date.getTime() + 7 * 60 * 60_000).toISOString().slice(0, 16);
}

export function formatInZone(date: Date | string, timeZone: string, withZone = true) {
  const value = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-GB', {weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone, ...(withZone ? {timeZoneName: 'short'} : {})}).format(value);
}

export function formatRange(start: Date | string, end: Date | string, timeZone: string) {
  const endTime = new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', timeZone}).format(typeof end === 'string' ? new Date(end) : end);
  return `${formatInZone(start, timeZone, false)} – ${endTime} (${timeZone === VN_TIME_ZONE ? 'Vietnam time' : timeZone})`;
}
