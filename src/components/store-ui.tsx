'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {useEffect, useState} from 'react';
import {type CatalogProduct, type CatalogSource, Locale, usd} from '@/lib/catalog';
import {useCart} from './cart-provider';

export function ProductArt({variant = 0}: {variant?: number}) {
  return <div className={`product-art art-${variant}`} aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><div className="isometric"><i/><i/><i/></div><span className="art-caption">DIGITAL / {variant ? 'PLUS' : 'ESSENTIAL'}</span><span className="art-number">0{variant + 1}</span></div>;
}
export function StoreHeader() {
  const locale = useLocale(); const path = usePathname(); const {lines} = useCart(); const [account, setAccount] = useState<{name: string; role: string} | null>(null); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {setMenuOpen(false); fetch('/api/auth/session').then(r => r.json()).then(data => setAccount(data.account)).catch(() => undefined);}, [path]);
  async function logout() {await fetch('/api/auth/logout', {method: 'POST'}); setAccount(null); window.location.reload();}
  return <header className="site-header"><div className="shell header"><Link href={`/${locale}`} className="brand"><span className="brand-name">Jewish Horse</span><small className="brand-tagline">Digital package shop</small></Link><button className="mobile-nav-toggle secondary" type="button" aria-expanded={menuOpen} aria-controls="store-navigation" onClick={() => setMenuOpen(value => !value)}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span><span>{menuOpen ? 'Close' : 'Menu'}</span></button><nav id="store-navigation" className={menuOpen ? 'open' : ''} aria-label="Navigation"><Link onClick={() => setMenuOpen(false)} href={`/${locale}#catalog`}>Packages</Link><Link onClick={() => setMenuOpen(false)} href={`/${locale}#how-it-works`}>How it works</Link><Link onClick={() => setMenuOpen(false)} href={`/${locale}/workspace`}>Chat support</Link><Link onClick={() => setMenuOpen(false)} href={`/${locale}#faq`}>Help</Link></nav><div className="header-actions">{account ? <span className="account-menu"><Link href={`/${locale}/${account.role === 'admin' ? 'admin/chat' : 'account'}`}>{account.name}</Link><button className="secondary" onClick={() => void logout()}>Log out</button></span> : <Link className="text-link" href={`/${locale}/login`}>Sign in / Register</Link>}<Link className="cart-link" aria-label="Cart" href={`/${locale}/cart`}>Cart <b>{lines.reduce((sum,l) => sum+l.quantity,0)}</b></Link></div></div></header>;
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

export function Catalog({products, source}: {products: CatalogProduct[]; source: CatalogSource}) {
  const locale = useLocale() as Locale; const t = useTranslations();
  return <section id="catalog" className="section">
    <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Choose a package</h2><p className="muted">{products.length ? `${products.length} package${products.length === 1 ? '' : 's'} available. Review the details before continuing.` : 'No packages are currently available.'}</p></div><span className="pill">USD · {source === 'database' ? 'Configured catalog' : 'Demo prices'}</span></div>
    {source === 'fallback' && <p className="catalog-status" role="status">The configured catalog is temporarily unavailable. Showing demo packages.</p>}
    {!products.length && <div className="empty-state"><div className="empty-icon">◇</div><h3>Catalog coming soon</h3><p className="muted">The store has no active packages right now. Please check again later or ask support.</p></div>}
    <div className="product-grid">{products.map(p => <article className="product-card" key={p.id}>
      {p.imagePath ? <div className="preview-slot product-photo"><img src={p.imagePath} alt={`Preview of ${p.title[locale]}`}/></div> : <div className="preview-slot" role="img" aria-label={`Preview image for ${p.title[locale]} not provided yet`}><span>Preview image</span><small>Placeholder until real screenshots are added</small></div>}
      <div className="product-content">
        <div className="row"><span className="eyebrow">DIGITAL PACKAGE</span><span className="sample-tag">{source === 'database' ? (p.stock ? 'Available' : 'Out of stock') : 'Demo'}</span></div>
        <h3>{p.title[locale]}</h3>
        <p className="muted">{p.description[locale]}</p>
        <ul className="compare-list">{(comparison[p.id] ?? [p.stock ? `${p.stock} currently available` : 'Currently out of stock', p.fields.length ? `${p.fields.filter(field => field.required).length} required delivery field${p.fields.filter(field => field.required).length === 1 ? '' : 's'}` : 'No delivery details required']).map(item => <li key={item}>{item}</li>)}</ul>
        <div className="product-bottom"><div><small>{p.saleUsdCents ? 'Sale price' : source === 'database' ? 'Price' : 'Sample price'}</small>{p.saleUsdCents && <del>{usd(p.baseUsdCents, locale)}</del>}<p className="price">{usd(p.usdCents,locale)}</p></div><Link className={`button ${!p.stock ? 'disabled-link' : ''}`} aria-disabled={!p.stock} tabIndex={p.stock ? undefined : -1} href={p.stock ? `/${locale}/products/${p.id}` : '#catalog'}>{p.stock ? t('detail') : 'Out of stock'} <span aria-hidden="true">→</span></Link></div>
      </div>
    </article>)}</div>
    <div className="after-purchase card"><p className="eyebrow">WHAT YOU GET AFTER PURCHASE</p><h3>This is a preview store</h3><p className="muted">Checkout is simulated. No payment is taken and nothing is delivered. When the shop goes live, this section will explain the delivery method, timing and the details you need to provide.</p></div>
  </section>;
}
