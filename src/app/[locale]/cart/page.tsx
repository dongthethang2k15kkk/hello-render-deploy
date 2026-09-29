'use client';

import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';
import {useState} from 'react';
import {useCart} from '@/components/cart-provider';
import {useCatalog} from '@/components/catalog-provider';
import {ProductPreview} from '@/components/store-ui';
import type {CartLine} from '@/lib/cart';
import {totalUsdCents} from '@/lib/cart';
import {Locale, usd} from '@/lib/catalog';

export default function Cart() {
  const {lines, ready, save} = useCart();
  const catalog = useCatalog();
  const products = catalog.products;
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState<{line: CartLine; index: number} | null>(null);

  return <section>
    <div className="page-heading">
      <p className="eyebrow">YOUR SELECTION</p>
      <h1>{t('cart')}</h1>
      <div className="checkout-steps"><span className="current">01 / {t('cart')}</span><span>02 / Checkout</span><span>03 / Demo confirmation</span></div>
    </div>
    {!ready || !catalog.ready ? <p aria-busy="true">Loading cart…</p> : <>
      {lines.length === 0 && <div className="empty-state">
        <div className="empty-icon">◇</div><h2>{t('empty')}</h2>
        <p className="muted">A new experience starts with your first pick.</p>
        <Link className="button" href={`/${locale}#catalog`}>Explore packages →</Link>
      </div>}
      {lines.length > 0 && <div className="checkout-layout"><div>
        {lines.map((line, index) => {
          const product = products.find(item => item.id === line.productId);
          if (!product) return null;
          return <article className="card cart-item" key={`${line.productId}-${index}`}>
            <ProductPreview product={product} variant={index % 2}/>
            <div>
              <h2>{product.title[locale]}</h2>
              <p>{t('quantity')}: {line.quantity} · {usd(product.usdCents * line.quantity, locale)}</p>
              {Object.entries(line.delivery).map(([key, value]) => {
                const label = product.fields.find(field => field.key === key)?.labelEn ?? key;
                return <p key={key}>{label}: {value}</p>;
              })}
              <div className="row">
                <div className="quantity-control">
                  <button type="button" aria-label={`Decrease item ${index + 1}`} disabled={line.quantity <= 1} onClick={() => {
                    setRemoved(null);
                    setError(save(lines.map((item, itemIndex) => itemIndex === index ? {...item, quantity: item.quantity - 1} : item)) ? '' : t('invalid'));
                  }}>−</button>
                  <output>{line.quantity}</output>
                  <button type="button" aria-label={`Increase item ${index + 1}`} disabled={lines.filter(item => item.productId === line.productId).reduce((sum, item) => sum + item.quantity, 0) >= product.stock} onClick={() => {
                    setRemoved(null);
                    setError(save(lines.map((item, itemIndex) => itemIndex === index ? {...item, quantity: item.quantity + 1} : item)) ? '' : t('invalid'));
                  }}>+</button>
                </div>
                <div className="cart-item-actions">
                  <Link className="text-link" href={`/${locale}/products/${line.productId}?edit=${index}`}>Edit details</Link>
                  <button className="secondary" type="button" onClick={() => {
                    if (save(lines.filter((_, itemIndex) => itemIndex !== index))) {
                      setError('');
                      setRemoved({line, index});
                    } else setError(t('unavailable'));
                  }}>{t('remove')}</button>
                </div>
              </div>
            </div>
          </article>;
        })}
      </div><aside className="card order-summary">
        <h2>Order summary</h2>
        <div className="summary-line"><span>Items</span><strong>{lines.reduce((sum, line) => sum + line.quantity, 0)}</strong></div>
        <div className="summary-total"><small>{t('total')}</small><p className="price">{usd(totalUsdCents(lines, products), locale)}</p></div>
        <p className="notice">Illustrative prices, excluding undetermined taxes/fees. No money is collected.</p>
        <Link className="button full-width" href={`/${locale}/checkout`}>Preview checkout →</Link>
        <button className="full-width" disabled style={{marginTop: 12}}>{t('checkout')}</button>
      </aside></div>}
    </>}
    <p role="alert">{error}</p>
    {removed && <p className="cart-undo" role="status">Item removed. <button className="secondary" type="button" onClick={() => {
      const next = [...lines];
      next.splice(Math.min(removed.index, next.length), 0, removed.line);
      if (save(next)) setRemoved(null); else setError(t('unavailable'));
    }}>Undo</button></p>}
    <p className="notice">{t('rate')}</p>
  </section>;
}
