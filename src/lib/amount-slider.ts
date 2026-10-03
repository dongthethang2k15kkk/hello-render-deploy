import 'server-only';
import {amountSliderSchema, defaultAmountSlider, type AmountSlider} from './amount-slider-rules';
import {getPaymentDb} from './payment-db';

const KEY = 'amountSlider';
const CACHE_MS = 30_000;
const store = globalThis as unknown as {amountSliderCache?: {value: AmountSlider; at: number}};

/** The saved slider settings, or the default (switched off) until an Admin saves them. */
export async function getAmountSlider(): Promise<AmountSlider> {
  const hit = store.amountSliderCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value = defaultAmountSlider;
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: KEY}});
      const parsed = amountSliderSchema.safeParse(row?.value);
      if (parsed.success) value = parsed.data;
    } catch { return hit?.value ?? defaultAmountSlider; }
  }
  store.amountSliderCache = {value, at: Date.now()};
  return value;
}

export async function setAmountSlider(value: AmountSlider, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({where: {key: KEY}, create: {key: KEY, value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
  store.amountSliderCache = {value, at: Date.now()};
}
