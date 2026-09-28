export type Locale = 'en';
export const products = [
  {
    id: 'sample-basic', usdCents: 1000, stock: 5,
    title: {en: 'Basic sample package'},
    description: {en: 'Test data for the shopping flow. This is not an offered service.'},
    fields: [{key: 'recipient', required: true, maxLength: 80}]
  },
  {
    id: 'sample-plus', usdCents: 2500, stock: 5,
    title: {en: 'Extended sample package'},
    description: {en: 'Demonstrates a different delivery form. Payment is unavailable.'},
    fields: [{key: 'recipient', required: true, maxLength: 80}, {key: 'note', required: false, maxLength: 300}]
  }
] as const;

export function usd(cents: number, locale: Locale) {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
}