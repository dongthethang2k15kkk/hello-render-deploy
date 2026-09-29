type StatusProduct = {active: boolean; packages: {active: boolean; stockOnHand: number}[]};
export type StorefrontStatus = {tone: 'live' | 'warning' | 'hidden'; label: string; detail: string};

// Mirrors getPublicCatalog: a product is listed only when it and at least one package are active.
export function storefrontStatus(product: StatusProduct): StorefrontStatus {
  const available = product.packages.filter(item => item.active);
  if (!product.active) return {tone: 'hidden', label: 'Hidden from store', detail: 'Turn on “Visible in store” to show this product.'};
  if (available.length === 0) return {tone: 'warning', label: 'Not in store', detail: 'No package is available. Turn on “Package available” for at least one package.'};
  if (available.every(item => item.stockOnHand <= 0)) return {tone: 'warning', label: 'In store · out of stock', detail: 'Customers can see this product but cannot buy it until a package has stock above 0.'};
  return {tone: 'live', label: 'Live in store', detail: `${available.length} of ${product.packages.length} package${product.packages.length === 1 ? '' : 's'} available to customers.`};
}

export function productSlug(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 100).replace(/^-+|-+$/g, '');
}
