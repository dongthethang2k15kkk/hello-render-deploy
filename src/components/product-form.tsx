'use client';
import {useLocale} from 'next-intl';
import {useRouter, useSearchParams} from 'next/navigation';
import {useState} from 'react';
import type {CatalogProduct} from '@/lib/catalog';
import {cartLineSchema, createCartSchema} from '@/lib/cart';
import {useCart} from './cart-provider';
import {useCatalog} from './catalog-provider';

export function ProductForm({product}: {product: CatalogProduct}) {
  const locale = useLocale();
  const {lines, save, ready} = useCart();
  const catalog = useCatalog();
  const [status, setStatus] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const productId = product.id;
  const requestedIndex = Number(searchParams.get('edit'));
  const editIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && lines[requestedIndex]?.productId === productId ? requestedIndex : -1;
  const editing = editIndex >= 0 ? lines[editIndex] : null;
  return <form key={editing ? `edit-${editIndex}` : 'new'} onSubmit={event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = cartLineSchema.safeParse({
      productId, quantity: Number(form.get('quantity')),
      delivery: Object.fromEntries(product.fields.map(f => [f.key, String(form.get(f.key) ?? '').trim()]))
    });
    const next = parsed.success ? (editing ? lines.map((line, index) => index === editIndex ? parsed.data : line) : [...lines, parsed.data]) : null;
    const validationCatalog = catalog.products.some(item => item.id === product.id) ? catalog.products : [...catalog.products, product];
    if (!parsed.success || !next || !createCartSchema(validationCatalog).safeParse(next).success) {setStatus('Check the information and available stock.'); return;}
    if (!save(next)) {setStatus('Unable to save the cart on this device.'); return;}
    // The shop has few packages, so buying one goes straight to the cart.
    setStatus(editing ? 'Cart updated. Opening your cart…' : 'Added to cart. Opening your cart…');
    router.push(`/${locale}/cart`);
  }}>
    {product.fields.map(field => <label key={field.key}>{field.labelEn}
      <input name={field.key} required={field.required} maxLength={field.maxLength} autoComplete="off" defaultValue={editing?.delivery[field.key] ?? ''}/>
    </label>)}
    <label>Quantity<input name="quantity" type="number" min="1" max={product.stock} defaultValue={editing?.quantity ?? 1} required /></label>
    <button className="full-width" disabled={!ready || !product.stock} type="submit">{product.stock ? (editing ? 'Update cart' : 'Add to cart') : 'Out of stock'} <span aria-hidden="true">→</span></button>
    <p className="form-status" role="status" aria-live="polite">{status}</p>
  </form>;
}
