'use client';

import Link from 'next/link';
import {useLocale} from 'next-intl';
import {useEffect, useState} from 'react';
import {useCart} from '@/components/cart-provider';
import {useCatalog} from '@/components/catalog-provider';
import {totalUsdCents} from '@/lib/cart';
import {Locale, usd} from '@/lib/catalog';

export default function Checkout() {
  const locale = useLocale() as Locale;
  const {lines, ready} = useCart();
  const catalog = useCatalog();
  const products = catalog.products;
  const [method, setMethod] = useState('bank');
  const [done, setDone] = useState(false);
  const [account, setAccount] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/session').then(response => response.json()).then(data => setAccount(Boolean(data.account))).catch(() => setAccount(false));
  }, []);

  if (!ready || !catalog.ready) return <p aria-busy="true">Loading cart…</p>;
  if (account === null) return <p aria-busy="true">Checking account…</p>;
  if (account === false) return <section className="card notice"><h1>Sign in to purchase</h1><p>Please sign in or register before continuing to checkout.</p><Link className="button" href={`/${locale}/login?next=checkout`}>Sign in / Register →</Link></section>;
  if (done) return <section className="card success-panel"><div className="success-icon">✓</div><p className="eyebrow">PREVIEW COMPLETE</p><h1>Preview complete</h1><p>You have completed the UI/UX flow. No payment, email or real order was created.</p><p className="notice">Your cart is preserved so you can keep exploring.</p><Link className="button" href={`/${locale}`}>Back to store →</Link></section>;
  if (!lines.length) return <div className="empty-state"><h1>No products to check out</h1><Link className="button" href={`/${locale}#catalog`}>Explore packages</Link></div>;

  return <>
    <div className="page-heading"><p className="eyebrow">CHECKOUT PREVIEW</p><h1>One more step. Try the experience.</h1><div className="checkout-steps"><Link href={`/${locale}/cart`}>01 / Cart</Link><span className="current">02 / Checkout</span><span>03 / Demo confirmation</span></div></div>
    <form className="checkout-layout" onSubmit={event => {event.preventDefault(); setDone(true); window.scrollTo({top: 0});}}>
      <div>
        <section className="card"><span className="eyebrow">01 / CONTACT</span><h2>Sample contact details</h2><p className="muted">You are signed in. This test email is used only to preview the checkout form.</p><label>Test email<input name="email" type="email" defaultValue="demo@example.com" autoComplete="off" required maxLength={254}/></label><p className="field-caption">Use a sample address. This data is not sent or saved.</p></section>
        <section className="card" style={{marginTop: 20}}><span className="eyebrow">02 / PAYMENT PREVIEW</span><h2>Payment method</h2><p className="muted">Choose a method to preview the interface. No payment provider is connected.</p><div className="payment-options">{[['bank', 'Bank transfer / QR'], ['ltc', 'Litecoin (LTC)'], ['card', 'Visa / Mastercard'], ['paypal', 'PayPal']].map(([value, label]) => <label className="payment-option" key={value}><input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value)}/><span>{label}<small>Preview only · no payment will be created</small></span></label>)}</div><p className="notice">Do not enter card, bank account or PayPal credentials. This demo has no payable QR code.</p></section>
      </div>
      <aside className="card order-summary">
        <h2>Review your selection</h2>
        {lines.map((line, index) => {
          const product = products.find(item => item.id === line.productId);
          if (!product) return null;
          return <div className="summary-line" key={`${line.productId}-${index}`}><span>{product.title[locale]} × {line.quantity}</span><strong>{usd(product.usdCents * line.quantity, locale)}</strong></div>;
        })}
        <div className="summary-total"><small>Illustrative total · USD</small><p className="price">{usd(totalUsdCents(lines, products), locale)}</p></div>
        <p className="notice">Taxes/fees are not calculated. The button displays a simulation only, with no payment obligation.</p>
        <button className="full-width" type="submit">Complete simulation →</button>
      </aside>
    </form>
  </>;
}
