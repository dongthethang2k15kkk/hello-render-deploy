// Amount slider on the storefront: customers choose any amount of one "per unit" package (shared by server and browser).
import {z} from 'zod';

/** Stock at or above this reads as "always available" instead of a number. */
export const UNLIMITED_STOCK = 1_000_000;
export const MAX_AMOUNT = 100_000_000;

const amount = z.number().int().min(1).max(MAX_AMOUNT);
export const amountSliderSchema = z.object({
  enabled: z.boolean(),
  // The package the slider sells; the cart line is that package × (amount ÷ unitSize).
  packageId: z.string().max(40),
  title: z.string().trim().min(1, 'Add a title.').max(80),
  unitLabel: z.string().trim().min(1, 'Add a unit, for example “M coins”.').max(24),
  // How many units one package holds (100 for a "100M" package sold in M coins); amounts below are in units.
  unitSize: z.number().int().min(1).max(1_000_000).default(1),
  min: amount, max: amount, step: amount, defaultAmount: amount,
  // Hide the per-unit package from the package grid, so it is bought only with the slider.
  hideFromGrid: z.boolean()
}).strict().superRefine((value, ctx) => {
  if (value.min > value.max) ctx.addIssue({code: 'custom', message: 'The smallest amount must not be larger than the largest.', path: ['min']});
  if (value.step > value.max - value.min && value.max !== value.min) ctx.addIssue({code: 'custom', message: 'The step must fit between the smallest and the largest amount.', path: ['step']});
  if (value.defaultAmount < value.min || value.defaultAmount > value.max) ctx.addIssue({code: 'custom', message: 'The starting amount must be between the smallest and the largest.', path: ['defaultAmount']});
  for (const key of ['min', 'max', 'step', 'defaultAmount'] as const) {
    if (value[key] % value.unitSize) ctx.addIssue({code: 'custom', message: `Amounts must be multiples of what one package holds (${value.unitSize} ${value.unitLabel}).`, path: [key]});
  }
  if (value.enabled && !value.packageId) ctx.addIssue({code: 'custom', message: 'Choose the package that sets the price per unit.', path: ['packageId']});
});
export type AmountSlider = z.infer<typeof amountSliderSchema>;

export const defaultAmountSlider: AmountSlider = {enabled: false, packageId: '', title: 'Choose any amount', unitLabel: 'M coins', unitSize: 1, min: 10, max: 1000, step: 10, defaultAmount: 100, hideFromGrid: true};

/** The largest amount the stock allows (stock counts packages; amounts count units). */
export const sliderTop = (slider: Pick<AmountSlider, 'max' | 'unitSize'>, stock = MAX_AMOUNT) => Math.min(slider.max, stock * (slider.unitSize ?? 1));

/** Snaps an amount onto the slider's steps inside its range (and the stock on hand). */
export function snapAmount(value: number, slider: Pick<AmountSlider, 'min' | 'max' | 'step'> & {unitSize?: number}, stock = MAX_AMOUNT) {
  const top = sliderTop({max: slider.max, unitSize: slider.unitSize ?? 1}, stock);
  if (!Number.isFinite(value)) return slider.min;
  const stepped = slider.min + Math.round((value - slider.min) / slider.step) * slider.step;
  return Math.max(slider.min, Math.min(top, stepped));
}

/** Customers see only whether a package can be bought, never the stock count (coins are farmed on demand). */
export const stockText = (stock: number) => stock > 0 ? 'Available' : 'Out of stock';

const UNIT_LADDER = ['K', 'M', 'B', 'T'];
/** "100M · Coins Skyblock" → {value: 100, unit: 'M'}; null when the title does not start with an amount. */
export function titleAmount(title: string) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*([KMBT])\b/i.exec(title);
  return match ? {value: Number(match[1]), unit: match[2].toUpperCase()} : null;
}
const baseValue = (amount: {value: number; unit: string}) => amount.value * 1000 ** UNIT_LADDER.indexOf(amount.unit);

/** "1500" + "M coins" → "1.5B coins"; labels without a K/M/B/T unit read "3 packs". */
export function formatUnits(amount: number, unitLabel: string) {
  const match = /^([KMBT])\b(.*)$/i.exec(unitLabel.trim());
  if (!match) return `${amount.toLocaleString('en-US')} ${unitLabel}`;
  let index = UNIT_LADDER.indexOf(match[1].toUpperCase());
  let value = amount;
  while (value >= 1000 && index < UNIT_LADDER.length - 1) { value /= 1000; index++; }
  return `${Number(value.toFixed(2)).toLocaleString('en-US')}${UNIT_LADDER[index]}${match[2]}`;
}
/** What a cart line holds in game units: 3 × "100M · Coins" → "300M"; otherwise "Title × 3". */
export function lineAmount(title: string, quantity: number) {
  const amount = titleAmount(title);
  return amount ? formatUnits(amount.value * quantity, amount.unit) : `${shortTitle(title)} × ${quantity}`;
}
export const shortTitle = (title: string) => title.split(' · ')[0].trim();

/**
 * Until an Admin saves the slider, it is set up from the catalog: the smallest package whose name starts with an amount
 * ("100M · …") becomes the unit, so customers can pick 100M, 200M, … up to 100 packages. Null when no name has an amount.
 */
export function autoSlider(products: {id: string; title: {en: string}; stock: number}[]): AmountSlider | null {
  const candidates = products.map(product => ({product, amount: titleAmount(product.title.en)}))
    .filter((item): item is {product: typeof item.product; amount: {value: number; unit: string}} => Boolean(item.amount && Number.isInteger(item.amount.value) && item.amount.value > 0 && item.product.stock > 0))
    .sort((a, b) => baseValue(a.amount) - baseValue(b.amount));
  const first = candidates[0];
  if (!first) return null;
  const {value, unit} = first.amount;
  const max = value * 100;
  return {enabled: true, packageId: first.product.id, title: 'Choose any amount', unitLabel: /coin/i.test(first.product.title.en) ? `${unit} coins` : unit,
    unitSize: value, min: value, max, step: value, defaultAmount: Math.min(value * 3, max), hideFromGrid: false};
}

/**
 * Quick-pick amounts under the slider: the smallest, round numbers players use (500M, 1B, 5B… from ×1 and ×5 of powers
 * of ten, else ×2 too) and the largest. Falls back to quarter points when the range is too narrow for round numbers.
 */
export function sliderPresets(slider: Pick<AmountSlider, 'min' | 'max' | 'step' | 'unitSize'>, stock = MAX_AMOUNT) {
  const top = sliderTop(slider, stock);
  const round = (multipliers: number[]) => {
    const values: number[] = [];
    for (let power = 1; power <= top; power *= 10) for (const multiplier of multipliers) {
      const value = multiplier * power;
      if (value > slider.min && value < top && (value - slider.min) % slider.step === 0) values.push(value);
    }
    return values.sort((a, b) => a - b);
  };
  const preferred = round([1, 5]);
  const nice = preferred.length >= 2 ? preferred : round([1, 2, 5]);
  if (nice.length < 2) return [...new Set([slider.min, slider.min + (top - slider.min) / 4, slider.min + (top - slider.min) / 2, top].map(value => snapAmount(value, slider, stock)))];
  const picked = nice.length <= 3 ? nice : [0, 1, 2].map(index => nice[Math.round(index * (nice.length - 1) / 2)]);
  return [...new Set([slider.min, ...picked, top])];
}
