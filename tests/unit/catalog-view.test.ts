import {expect, it} from 'vitest';
import {fallbackProducts} from '../../src/lib/catalog';
import {filterCatalog} from '../../src/lib/catalog-view';

it('combines stock and text filters without modifying catalog order or prices', () => {
  const products = fallbackProducts.map((product, index) => ({...product, stock: index, priceVnd: index ? 200 : 500}));
  expect(filterCatalog(products, 'sample', true, 'featured')).toHaveLength(1);
  expect(filterCatalog(products, '', false, 'price-low').map(product => product.priceVnd)).toEqual([200, 500]);
  expect(products.map(product => product.priceVnd)).toEqual([500, 200]);
  expect(filterCatalog(products, 'no such package', false, 'featured')).toEqual([]);
});
