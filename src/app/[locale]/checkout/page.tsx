'use client';

import Link from 'next/link';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {useCart} from '@/components/cart-provider';
import {useCatalog} from '@/components/catalog-provider';
import {totalVnd} from '@/lib/cart';
import {Locale} from '@/lib/catalog';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';
import {HOLD_MINUTES} from '@/lib/order-rules';

export default function Checkout() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const {lines, ready, save} = useCart();
  const catalog = useCatalog();
  const products = catalog.products;
  const [account, setAccount] = useState<{name: string; role: string} | null | false>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/session', {cache: 'no-store'}).then(response => response.json()).then(data => setAccount(data.account ?? false)).catch(() => setAccount(false));
  }, []);

  async function placeOrder() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/orders', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({lines})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Your order could not be placed.');
      save([]);
      router.push(`/${locale}/orders/${data.code}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your order could not be placed.'); setBusy(false); }
  }

  if (!ready || !catalog.ready) return <p aria-busy="true">Loading cart…</p>;
  if (account === null) return <p aria-busy="true">Checking account…</p>;
  if (account === false) return <section className="card notice"><h1>Sign in to purchase</h1><p>Please sign in or register before continuing to checkout.</p><Link className="button" href={`/${locale}/login?next=checkout`}>Sign in / Register →</Link></section>;
  if (account.role !== 'user') return <section className="card notice"><h1>Admin accounts cannot buy</h1><p>Sign out of Admin and use a customer account to place orders.</p></section>;
  if (!lines.length) return <div className="empty-state"><h1>No products to check out</h1><Link className="button" href={`/${locale}#catalog`}>Explore packages</Link></div>;
  const total = totalVnd(lines, products);

  return <>
    <div className="page-heading"><p className="eyebrow">CHECKOUT</p><h1>Review and place your order</h1><div className="checkout-steps"><Link href={`/${locale}/cart`}>01 / Cart</Link><span className="current">02 / Checkout</span><span>03 / Pay &amp; book a time</span></div></div>
    <div className="checkout-layout">
      <div>
        <section className="card"><span className="eyebrow">01 / HOW IT WORKS</span><h2>Bank transfer, then pick a time</h2>
          <ol className="checkout-flow">
            <li><strong>Place the order.</strong> We hold your items for {HOLD_MINUTES} minutes.</li>
            <li><strong>Transfer {formatVnd(total)}</strong> by scanning the VietQR code in your banking app. The amount and order code are filled in for you.</li>
            <li><strong>Tap “I’ve transferred”</strong> and choose a few times you are free.</li>
            <li><strong>We confirm</strong> your payment and one of your times by email and in your Inbox, then deliver with you in the site chat.</li>
          </ol>
        </section>
        <section className="card" style={{marginTop: 20}}><span className="eyebrow">02 / ACCOUNT</span><h2>Signed in as {account.name}</h2><p className="muted">Order updates go to the email on your account and to your <Link href={`/${locale}/inbox`}>Inbox</Link>.</p></section>
      </div>
      <aside className="card order-summary">
        <h2>Your order</h2>
        {lines.map((line, index) => {
          const product = products.find(item => item.id === line.productId);
          if (!product) return null;
          return <div className="summary-line" key={`${line.productId}-${index}`}><span>{product.title[locale]} × {line.quantity}</span><strong>{formatVnd(product.priceVnd * line.quantity)}</strong></div>;
        })}
        <div className="summary-total"><small>You pay by bank transfer</small><p className="pay-amount">{formatVnd(total)}</p><small>≈ {formatUsdFromVnd(total, catalog.vndPerUsd)}</small></div>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button className="full-width" type="button" disabled={busy} onClick={() => void placeOrder()}>{busy ? 'Placing order…' : 'Place order →'}</button>
        <p className="field-caption">You will see the bank details and QR code on the next page.</p>
      </aside>
    </div>
  </>;
}
