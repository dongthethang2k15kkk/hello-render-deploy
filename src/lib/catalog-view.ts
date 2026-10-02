import type {CatalogProduct} from './catalog';

export type CatalogSort = 'featured' | 'price-low' | 'price-high' | 'name';
export function filterCatalog(products: CatalogProduct[], query: string, inStock: boolean, sort: CatalogSort) {
  const text = query.trim().toLocaleLowerCase();
  const result = products.filter(product => (!inStock || product.stock > 0) && (!text || `${product.title.en} ${product.description.en} ${product.category}`.toLocaleLowerCase().includes(text)));
  if (sort === 'price-low') result.sort((a, b) => a.priceVnd - b.priceVnd);
  if (sort === 'price-high') result.sort((a, b) => b.priceVnd - a.priceVnd);
  if (sort === 'name') result.sort((a, b) => a.title.en.localeCompare(b.title.en));
  return result;
}
