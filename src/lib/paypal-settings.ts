import 'server-only';
import {defaultPaypalSettings, paypalSettingsSchema, type PaypalSettings} from './paypal';
import {getPaymentDb} from './payment-db';

const KEY = 'paypal';
const CACHE_MS = 30_000;
const store = globalThis as unknown as {paypalSettingsCache?: {value: PaypalSettings; at: number}};

/** The PayPal settings an Admin saved, or "off" defaults until they save some. */
export async function getPaypalSettings(): Promise<PaypalSettings> {
  const hit = store.paypalSettingsCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value = defaultPaypalSettings;
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: KEY}});
      const parsed = paypalSettingsSchema.safeParse(row?.value);
      if (parsed.success) value = parsed.data;
    } catch { return hit?.value ?? defaultPaypalSettings; }
  }
  store.paypalSettingsCache = {value, at: Date.now()};
  return value;
}

export async function savePaypalSettings(value: PaypalSettings, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({where: {key: KEY}, create: {key: KEY, value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
  store.paypalSettingsCache = {value, at: Date.now()};
}
