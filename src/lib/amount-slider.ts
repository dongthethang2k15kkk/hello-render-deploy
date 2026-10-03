import 'server-only';
import {amountSliderSchema, autoSlider, type AmountSlider} from './amount-slider-rules';
import {getPaymentDb} from './payment-db';

const KEY = 'amountSlider';
const CACHE_MS = 30_000;
const store = globalThis as unknown as {amountSliderCache?: {value: AmountSlider | null; at: number}};

/** The slider an Admin saved, or null until one is saved (the store then sets it up from the catalog). */
export async function getSavedAmountSlider(): Promise<AmountSlider | null> {
  const hit = store.amountSliderCache;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  let value: AmountSlider | null = null;
  if (process.env.DATABASE_URL) {
    try {
      const row = await getPaymentDb().storeSetting.findUnique({where: {key: KEY}});
      const parsed = amountSliderSchema.safeParse(row?.value);
      if (parsed.success) value = parsed.data;
    } catch { return hit?.value ?? null; }
  }
  store.amountSliderCache = {value, at: Date.now()};
  return value;
}

/** The slider the store shows: the saved one, or the automatic one built from the catalog. */
export async function storeAmountSlider(products: Parameters<typeof autoSlider>[0]) {
  return (await getSavedAmountSlider()) ?? autoSlider(products);
}

export async function setAmountSlider(value: AmountSlider, actorEmail: string) {
  await getPaymentDb().storeSetting.upsert({where: {key: KEY}, create: {key: KEY, value, updatedBy: actorEmail}, update: {value, updatedBy: actorEmail}});
  store.amountSliderCache = {value, at: Date.now()};
}
