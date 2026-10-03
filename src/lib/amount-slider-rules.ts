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

export const stockText = (stock: number) => stock >= UNLIMITED_STOCK ? 'Always in stock' : stock ? `${stock} currently available` : 'Currently out of stock';
