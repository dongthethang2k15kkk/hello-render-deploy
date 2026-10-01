'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {type CatalogProduct, type CatalogSource, Locale} from '@/lib/catalog';
import Price from './price';
import {formatUsdFromVnd} from '@/lib/money';
import {useCart} from './cart-provider';

export function ProductArt({variant = 0}: {variant?: number}) {
  return <div className={`product-art art-${variant}`} aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><div className="isometric"><i/><i/><i/></div><span className="art-caption">DIGITAL / {variant ? 'PLUS' : 'ESSENTIAL'}</span><span className="art-number">0{variant + 1}</span></div>;
}
type HeaderAccount = {name: string; role: string; unread?: number; chatUnread?: number};

const icons = {
  orders: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6l2-4Zm0 4h12M9 10h6M9 14h6"/></svg>,
  inbox: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10.3 20a2 2 0 0 0 3.4 0"/></svg>,
  chat: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12Z"/></svg>
};
const badge = (count?: number) => count ? <b className="pill-badge">{count > 99 ? '99+' : count}</b> : null;

export function StoreHeader() {
  const locale = useLocale(); const path = usePathname(); const {lines} = useCart(); const [account, setAccount] = useState<HeaderAccount | null>(null); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
    const load = () => fetch('/api/auth/session', {cache: 'no-store'}).then(r => r.json()).then(data => setAccount(data.account)).catch(() => undefined);
    void load();
    // Keeps Inbox and Chat counts fresh while the page stays open.
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [path]);
  async function logout() {await fetch('/api/auth/logout', {method: 'POST'}); setAccount(null); window.location.reload();}
  const cartCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  return <header className="site-header"><div className="shell header"><Link href={`/${locale}`} className="brand"><span className="brand-name">Jewish Horse</span><small className="brand-tagline">Digital package shop</small></Link><button className="mobile-nav-toggle secondary" type="button" aria-expanded={menuOpen} aria-controls="store-navigation" onClick={() => setMenuOpen(value => !value)}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span><span>{menuOpen ? 'Close' : 'Menu'}</span></button><nav id="store-navigation" className={menuOpen ? 'open' : ''} aria-label="Navigation"><Link onClick={() => setMenuOpen(false)} href={`/${locale}#catalog`}>Packages</Link><Link onClick={() => setMenuOpen(false)} href={`/${locale}#how-it-works`}>How it works</Link><Link onClick={() => setMenuOpen(false)} href={`/${locale}/workspace`}>Chat support</Link><Link onClick={() => setMenuOpen(false)} href={`/${locale}#faq`}>Help</Link></nav>
    <div className="header-actions">
      {account?.role === 'user' && <div className="header-pills" role="group" aria-label="Your orders and messages">
        <Link className="header-pill" href={`/${locale}/orders`} aria-label={`Orders, ${cartCount} item${cartCount === 1 ? '' : 's'} in cart`}>{icons.orders}<span>Orders</span>{badge(cartCount)}</Link>
        <Link className="header-pill" href={`/${locale}/inbox`} aria-label={`Inbox, ${account.unread ?? 0} unread`}>{icons.inbox}<span>Inbox</span>{badge(account.unread)}</Link>
        <Link className="header-pill" href={`/${locale}/workspace`} aria-label={`Chat, ${account.chatUnread ?? 0} unread`}>{icons.chat}<span>Chat</span>{badge(account.chatUnread)}</Link>
      </div>}
      {account ? <span className="account-menu"><Link href={`/${locale}/${account.role === 'admin' ? 'admin' : 'account'}`}>{account.name}</Link><button className="secondary" onClick={() => void logout()}>Log out</button></span> : <Link className="text-link" href={`/${locale}/login`}>Sign in / Register</Link>}
      <Link className="cart-link" aria-label="Cart" href={`/${locale}/cart`}>Cart <b>{cartCount}</b></Link>
    </div></div></header>;
}

export function ProductPreview({product, variant = 0}: {product: CatalogProduct; variant?: number}) {
  return product.imagePath
    ? <div className="product-image"><img src={product.imagePath} alt={`Preview of ${product.title.en}`}/></div>
    : <ProductArt variant={variant}/>;
}

// Facts taken from the catalog data. Replace with real product copy once it is provided.
const comparison: Record<string, string[]> = {
  'sample-basic': ['Lower sample price', 'One delivery field: recipient name'],
  'sample-plus': ['Higher sample price', 'Recipient name plus an optional delivery note']
};

export function Catalog({products, source, vndPerUsd, vndPerLtc = null}: {products: CatalogProduct[]; source: CatalogSource; vndPerUsd: number; vndPerLtc?: number | null}) {
  const locale = useLocale() as Locale; const t = useTranslations();
  return <section id="catalog" className="section">
    <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Choose a package</h2><p className="muted">{products.length ? `${products.length} package${products.length === 1 ? '' : 's'} available. Review the details before continuing.` : 'No packages are currently available.'}</p></div><span className="pill">{vndPerLtc ? 'Prices in USD · paid in VND or LTC' : 'Prices in USD · paid in VND'}</span></div>
    {source === 'fallback' && <p className="catalog-status" role="status">The catalog is temporarily unavailable. Please refresh in a moment.</p>}
    {!products.length && <div className="empty-state"><div className="empty-icon">◇</div><h3>Catalog coming soon</h3><p className="muted">The store has no active packages right now. Please check again later or ask support.</p></div>}
    <div className="product-grid">{products.map(p => <article className="product-card" key={p.id}>
      {p.imagePath ? <div className="preview-slot product-photo"><img src={p.imagePath} alt={`Preview of ${p.title[locale]}`}/></div> : <div className="preview-slot" role="img" aria-label={p.title[locale]}><span>{p.title[locale]}</span></div>}
      <div className="product-content">
        <div className="row"><span className="eyebrow">DIGITAL PACKAGE</span><span className="sample-tag">{p.stock ? 'Available' : 'Out of stock'}</span></div>
        <h3>{p.title[locale]}</h3>
        <p className="muted">{p.description[locale]}</p>
        <ul className="compare-list">{(comparison[p.id] ?? [p.stock ? `${p.stock} currently available` : 'Currently out of stock', p.fields.length ? `${p.fields.filter(field => field.required).length} required delivery field${p.fields.filter(field => field.required).length === 1 ? '' : 's'}` : 'No delivery details required']).map(item => <li key={item}>{item}</li>)}</ul>
        <div className="product-bottom"><div><small>{p.salePriceVnd ? 'Sale price' : 'Price'}</small>{p.salePriceVnd && <del>{formatUsdFromVnd(p.basePriceVnd, vndPerUsd)}</del>}<Price vnd={p.priceVnd} vndPerUsd={vndPerUsd} vndPerLtc={vndPerLtc}/></div><Link className={`button ${!p.stock ? 'disabled-link' : ''}`} aria-disabled={!p.stock} tabIndex={p.stock ? undefined : -1} href={p.stock ? `/${locale}/products/${p.id}` : '#catalog'}>{p.stock ? t('detail') : 'Out of stock'} <span aria-hidden="true">→</span></Link></div>
      </div>
    </article>)}</div>
    <div className="after-purchase card"><p className="eyebrow">WHAT YOU GET AFTER PURCHASE</p><h3>Pay by bank transfer, then pick a time</h3><p className="muted">Place your order and transfer the VND amount within 30 minutes using the QR code. Then choose the times you are free. We confirm your payment, book one of your times and send the details to your email and Inbox. At the appointment we deliver through the site chat.</p></div>
  </section>;
}
