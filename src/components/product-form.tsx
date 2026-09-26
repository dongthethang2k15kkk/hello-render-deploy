'use client';
import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {products} from '@/lib/catalog';
import {cartLineSchema, cartSchema} from '@/lib/cart';
import {useCart} from './cart-provider';

export function ProductForm({productId}: {productId: string}) {
  const t = useTranslations();
  const {lines, save, ready} = useCart();
  const [status, setStatus] = useState('');
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {fetch('/api/auth/session').then(r => r.json()).then(data => setSignedIn(Boolean(data.account))).catch(() => setSignedIn(false));}, []);
  const product = products.find(p => p.id === productId)!;
  return <form onSubmit={event => {
    event.preventDefault();
    if (!signedIn) {setStatus('Bạn cần đăng nhập hoặc đăng ký để mua sản phẩm.'); window.location.href = `/${window.location.pathname.split('/')[1] || 'vi'}/login?next=checkout`; return;}
    const form = new FormData(event.currentTarget);
    const parsed = cartLineSchema.safeParse({
      productId, quantity: Number(form.get('quantity')),
      delivery: Object.fromEntries(product.fields.map(f => [f.key, String(form.get(f.key) ?? '').trim()]))
    });
    if (!parsed.success || !cartSchema.safeParse([...lines, parsed.data]).success) {setStatus(t('invalid')); return;}
    setStatus(save([...lines, parsed.data]) ? t('added') : t('unavailable'));
  }}>
    {product.fields.map(field => <label key={field.key}>{t(field.key)}
      <input name={field.key} required={field.required} maxLength={field.maxLength} autoComplete="off" />
    </label>)}
    <label>{t('quantity')}<input name="quantity" type="number" min="1" max={product.stock} defaultValue="1" required /></label>
    <button className="full-width" disabled={!ready} type="submit">{t('add')} <span aria-hidden="true">→</span></button>
    <p role="status" aria-live="polite">{status}</p>
  </form>;
}