// PayPal.me payments: settings shape, link and per-order amount (no Prisma; unit-tested).
import {z} from 'zod';
import {formatCents, uniqueCents} from './unique-cents';

export const PAYPAL_USERNAME = /^[A-Za-z0-9]{1,20}$/;

export const paypalSettingsSchema = z.object({
  enabled: z.boolean(),
  // Empty while PayPal has never been set up; `paypalReady` needs a real name.
  username: z.string().max(20).regex(/^[A-Za-z0-9]*$/),
  email: z.string().max(120).nullable(),
  feePercent: z.number().min(0).max(15),
  feeFixedCents: z.number().int().min(0).max(500),
  instructions: z.string().max(500)
}).strict();
export type PaypalSettings = z.infer<typeof paypalSettingsSchema>;
export const defaultPaypalSettings: PaypalSettings = {enabled: false, username: '', email: null, feePercent: 0, feeFixedCents: 0, instructions: ''};

/** PayPal can only be offered when an Admin turned it on and gave a valid PayPal.me name. */
export const paypalReady = (settings: PaypalSettings | null | undefined): settings is PaypalSettings => Boolean(settings?.enabled && PAYPAL_USERNAME.test(settings.username));

/** Accepts "name", "@name", "paypal.me/name" or the full link that an Admin pasted, and returns just the name. */
export const cleanPaypalUsername = (value: string) => value.trim().replace(/^https?:\/\//i, '').replace(/^(www\.)?paypal\.me\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');

/** The PayPal.me link with the amount filled in. PayPal opens the payment screen at that amount in USD. */
export const paypalMeLink = (username: string, amount: string) => `https://paypal.me/${username}/${amount}USD`;

type Fees = Pick<PaypalSettings, 'feePercent' | 'feeFixedCents'>;

/** The VND total at the locked USD rate, rounded up to the cent, plus the shop's PayPal fee: the price before the per-order cents. */
export function paypalBaseCents(totalVnd: number, vndPerUsd: number, fees: Fees) {
  const base = Math.max(1, Math.ceil((totalVnd * 100) / vndPerUsd));
  // The percent is held in hundredths so that 4.4% of 1000 cents is exactly 44, not 44.00000000000001 rounded up to 45.
  return base + Math.ceil((base * Math.round(fees.feePercent * 100)) / 10_000) + fees.feeFixedCents;
}

/**
 * USD to send for an order: the price plus fee, plus the smallest extra cents no other open PayPal order uses.
 * PayPal payments carry the order code as a note, but the customer types it, so the cents are what we match on.
 */
export function paypalAmount(totalVnd: number, vndPerUsd: number, fees: Fees, taken: Set<string>) {
  const cents = uniqueCents(paypalBaseCents(totalVnd, vndPerUsd, fees), taken);
  if (cents === null) throw new Error('Too many open PayPal orders');
  return formatCents(cents);
}
