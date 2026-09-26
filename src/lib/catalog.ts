export type Locale = 'vi' | 'en';
export const products = [
  {
    id: 'sample-basic', usdCents: 1000, stock: 5,
    title: {vi: 'Gói minh họa cơ bản', en: 'Basic sample package'},
    description: {vi: 'Dữ liệu thử cho luồng mua hàng. Không đại diện cho dịch vụ đang bán.', en: 'Test data for the shopping flow. This is not an offered service.'},
    fields: [{key: 'recipient', required: true, maxLength: 80}]
  },
  {
    id: 'sample-plus', usdCents: 2500, stock: 5,
    title: {vi: 'Gói minh họa mở rộng', en: 'Extended sample package'},
    description: {vi: 'Minh họa sản phẩm có bộ trường giao hàng khác. Không thể thanh toán.', en: 'Demonstrates a different delivery form. Payment is unavailable.'},
    fields: [{key: 'recipient', required: true, maxLength: 80}, {key: 'note', required: false, maxLength: 300}]
  }
] as const;

export function usd(cents: number, locale: Locale) {
  return new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
}