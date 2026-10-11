'use client';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {useLocale, useTranslations} from 'next-intl';
import {useCallback, useDeferredValue, useEffect, useMemo, useRef, useState} from 'react';
import {type CatalogProduct, type CatalogSource, Locale} from '@/lib/catalog';
import {defaultShelf, type Shelf} from '@/lib/accounts-shelf-rules';
import {AccountShelf} from './account-shelf';
import Price from './price';
import {QuickBuy} from './quick-buy';
import {shortTitle, stockText, type AmountSlider} from '@/lib/amount-slider-rules';
import {InboxPopover, NotificationToast, OrdersPopover, type Notice} from './header-popover';
import {HeaderLiveStatus} from './availability';
import {playChime, unlockSound} from '@/lib/notify-sound';
import {filterCatalog, type CatalogSort} from '@/lib/catalog-view';
import {clearChatDrafts} from '@/lib/chat-drafts';
import {watchChat} from '@/lib/chat-client';
import {formatUsdFromVnd} from '@/lib/money';
import {useCart} from './cart-provider';
import {formatCompactCoins} from '@/lib/coin-format';
import {invalidateJson, loadJson} from '@/lib/client-data-cache';

export function ProductArt({variant = 0}: {variant?: number}) {
  return <div className={`product-art art-${variant}`} aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><div className="isometric"><i/><i/><i/></div><span className="art-caption">DIGITAL / {variant ? 'PLUS' : 'ESSENTIAL'}</span><span className="art-number">0{variant + 1}</span></div>;
}
type HeaderAccount = {name: string; role: string; unread?: number; chatUnread?: number; coinBalance?: string};

const icons = {
  orders: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h12l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6l2-4Zm0 4h12M9 10h6M9 14h6"/></svg>,
  inbox: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M10.3 20a2 2 0 0 0 3.4 0"/></svg>,
  chat: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.6A8 8 0 1 1 21 12Z"/></svg>
};
// The last known account for this tab, so the header does not flash "Sign in" before the session request returns.
const ACCOUNT_CACHE = 'jh.header-account';
function rememberAccount(account: HeaderAccount | null) {
  try { if (account) sessionStorage.setItem(ACCOUNT_CACHE, JSON.stringify(account)); else sessionStorage.removeItem(ACCOUNT_CACHE); } catch { /* storage blocked */ }
}

const badge = (count?: number) => count ? <b className="pill-badge">{count > 99 ? '99+' : count}</b> : null;

export function StoreHeader() {
  const locale = useLocale(); const path = usePathname(); const {lines} = useCart(); const [account, setAccount] = useState<HeaderAccount | null>(null); const [menuOpen, setMenuOpen] = useState(false); const [panel, setPanel] = useState<'orders' | 'inbox' | null>(null);
  const setUnread = useCallback((unread: number) => setAccount(current => current && current.unread !== unread ? {...current, unread} : current), []);
  const router = useRouter();
  const [ringing, setRinging] = useState(false);
  const [toast, setToast] = useState<Notice | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  const seenUnread = useRef<number | null>(null);
  // Browsers allow sound only after a click or key press on the page.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockSound);
    window.addEventListener('keydown', unlockSound);
    return () => { window.removeEventListener('pointerdown', unlockSound); window.removeEventListener('keydown', unlockSound); };
  }, []);
  // A new Inbox notification: the bell shakes and glows, a chime plays and the notification pops up under the header.
  const unreadNow = account?.role === 'user' ? account.unread ?? 0 : null;
  useEffect(() => {
    const before = seenUnread.current;
    seenUnread.current = unreadNow;
    if (unreadNow === null || before === null || unreadNow <= before) return;
    setRinging(true);
    playChime();
    void loadJson<{notifications?: Notice[]}>('/api/notifications', {force: true}).then(response => {
      const latest = response.data.notifications?.find(item => !item.readAt);
      if (latest) setToast(latest);
    }).catch(() => undefined);
  }, [unreadNow]);
  useEffect(() => {
    if (!ringing) return;
    const timer = window.setTimeout(() => setRinging(false), 4000);
    return () => window.clearTimeout(timer);
  }, [ringing]);
  // "(3) Jewish Horse" in the browser tab, so a waiting notification shows even when the tab is in the background.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\+?\) /, '');
    document.title = unreadNow ? `(${unreadNow > 99 ? '99+' : unreadNow}) ${base}` : base;
  }, [unreadNow, path]);
  function openToast(notice: Notice) {
    setToast(null);
    void fetch('/api/notifications', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'read', ids: [notice.id]})}).then(response => response.json()).then(data => { invalidateJson('/api/notifications', '/api/auth/session'); if (typeof data?.unread === 'number') setUnread(data.unread); }).catch(() => undefined);
    router.push(notice.link.startsWith('/') ? notice.link : `/${locale}/inbox`);
  }
  useEffect(() => {
    try { const cached = sessionStorage.getItem(ACCOUNT_CACHE); if (cached) setAccount(current => current ?? JSON.parse(cached)); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => {
    setMenuOpen(false); setPanel(null);
    const load = (force = false) => loadJson<{account: HeaderAccount | null}>('/api/auth/session', {maxAgeMs: 15_000, force}).then(({data}) => {setAccount(data.account); rememberAccount(data.account);}).catch(() => undefined);
    void load();
    // Keeps Inbox and Chat counts fresh, also in a background tab (browsers slow that down to about once a minute),
    // so the chime can announce a new notification while the customer is elsewhere.
    const timer = window.setInterval(() => void load(true), 20000);
    // Checkout signs customers in without leaving the page; it announces the new session so the header updates at once.
    const changed = () => {invalidateJson('/api/auth/session'); void load(true);};
    window.addEventListener('jh-account-changed', changed);
    return () => { window.clearInterval(timer); window.removeEventListener('jh-account-changed', changed); };
  }, [path]);
  useEffect(() => {
    if (!account) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = watchChat(event => {
      if (event.kind === 'disconnected') return;
      if (!timer) timer = setTimeout(() => {timer = undefined; void loadJson<{account: HeaderAccount | null}>('/api/auth/session', {force: true}).then(({data}) => setAccount(data.account)).catch(() => {});}, 250);
    });
    return () => {stop(); clearTimeout(timer);};
  }, [account?.role]);
  async function logout() {await fetch('/api/auth/logout', {method: 'POST'}); clearChatDrafts(); rememberAccount(null); setAccount(null); window.location.reload();}
  const cartCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const accountHref = `/${locale}/${account?.role === 'admin' ? 'admin' : 'account'}`;
  return <header className="site-header"><div className="shell header">
    <Link href={`/${locale}`} className="brand"><span className="brand-name">Jewish Horse</span><small className="brand-tagline">Digital package shop</small></Link>
    <button className="mobile-nav-toggle secondary" type="button" aria-expanded={menuOpen} aria-controls="store-navigation" onClick={() => setMenuOpen(value => !value)}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span><span>{menuOpen ? 'Close' : 'Menu'}</span></button>
    <nav id="store-navigation" className={menuOpen ? 'open' : ''} aria-label="Navigation">
      <Link onClick={() => setMenuOpen(false)} href={`/${locale}#catalog`}>Packages</Link><Link onClick={() => setMenuOpen(false)} href={`/${locale}#how-it-works`}>How it works</Link>{account?.role !== 'user' && <Link onClick={() => setMenuOpen(false)} href={`/${locale}/workspace`}>Chat support</Link>}<Link onClick={() => setMenuOpen(false)} href={`/${locale}#faq`}>Help</Link>
      <span className="mobile-nav-account">{account ? <><Link onClick={() => setMenuOpen(false)} href={accountHref}>{account.name}</Link><button type="button" onClick={() => void logout()}>Log out</button></> : <Link onClick={() => setMenuOpen(false)} href={`/${locale}/login`}>Sign in / Register</Link>}</span>
    </nav>
    <HeaderLiveStatus locale={locale}/>
    <div className="header-actions">
      {account?.role === 'user' && <Link className="coin-balance-pill" href={`/${locale}/account`} title={`${account.coinBalance ?? '0'} coins`} aria-label={`Coin balance: ${account.coinBalance ?? '0'} coins`}><span aria-hidden="true">✦</span>{account.coinBalance === undefined ? '…' : formatCompactCoins(account.coinBalance)}</Link>}
      {account?.role === 'user' && <div className="header-pills" role="group" aria-label="Your orders and messages">
        <OrdersPopover locale={locale} cartCount={cartCount} open={panel === 'orders'} onOpenChange={open => setPanel(open ? 'orders' : null)} icon={icons.orders} badge={badge(cartCount)}/>
        <InboxPopover locale={locale} unread={account.unread ?? 0} onUnreadChange={setUnread} open={panel === 'inbox'} onOpenChange={open => setPanel(open ? 'inbox' : null)} icon={icons.inbox} badge={badge(account.unread)} ringing={ringing}/>
      </div>}
      <span className="header-account-control">{account ? <span className="account-menu"><Link href={accountHref}>{account.name}</Link><button className="secondary" onClick={() => void logout()}>Log out</button></span> : <Link className="text-link" href={`/${locale}/login`}>Sign in / Register</Link>}</span>
      <Link className="cart-link" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`} href={`/${locale}/cart`}><span>Cart</span> <b>{cartCount}</b></Link>
    </div>
  </div><NotificationToast notice={toast} onOpen={openToast} onClose={closeToast}/></header>;
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

export function Catalog({products: allProducts, accounts = [], shelf = defaultShelf, source, vndPerUsd, vndPerLtc = null, slider = null, trades}: {products: CatalogProduct[]; accounts?: CatalogProduct[]; shelf?: Shelf; source: CatalogSource; vndPerUsd: number; vndPerLtc?: number | null; slider?: AmountSlider | null; trades?: {completed: number}}) {
  const locale = useLocale() as Locale; const t = useTranslations();
  // Two tabs: the packages and the game accounts. The chosen tab lives in the address (?shelf=accounts, or #accounts) so it can be shared.
  const showShelf = shelf.enabled && accounts.length > 0;
  const [tab, setTab] = useState<'packages' | 'accounts'>('packages');
  useEffect(() => {
    const read = () => { if (new URLSearchParams(window.location.search).get('shelf') === 'accounts' || window.location.hash === '#accounts') setTab('accounts'); };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  function chooseTab(next: 'packages' | 'accounts') {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'accounts') url.searchParams.set('shelf', 'accounts'); else { url.searchParams.delete('shelf'); if (url.hash === '#accounts') url.hash = ''; }
    window.history.replaceState(null, '', url);
  }
  const availableAccounts = accounts.filter(account => account.stock > 0).length;
  // The slider sells its per-unit package by amount; that package can stay out of the grid.
  const sliderProduct = slider?.enabled ? allProducts.find(product => product.id === slider.packageId) : undefined;
  const products = useMemo(() => sliderProduct && slider?.hideFromGrid ? allProducts.filter(product => product.id !== sliderProduct.id) : allProducts, [allProducts, sliderProduct, slider?.hideFromGrid]);
  const [query, setQuery] = useState('');
  const [inStock, setInStock] = useState(false);
  const [sort, setSort] = useState<CatalogSort>('featured');
  const deferredQuery = useDeferredValue(query);
  const shown = useMemo(() => filterCatalog(products, deferredQuery, inStock, sort), [products, deferredQuery, inStock, sort]);
  const reset = () => {setQuery(''); setInStock(false); setSort('featured');};
  const tabs = showShelf && <div className="shelf-tabs" role="tablist" aria-label="What to buy">
    <button type="button" role="tab" aria-selected={tab === 'packages'} onClick={() => chooseTab('packages')}>{shelf.packagesTabLabel}</button>
    <button type="button" role="tab" aria-selected={tab === 'accounts'} onClick={() => chooseTab('accounts')}>{shelf.accountsTabLabel}<span className="shelf-count">{availableAccounts}</span></button>
  </div>;
  if (showShelf && tab === 'accounts') return <section id="catalog" className="section"><span id="accounts"/>{tabs}<AccountShelf accounts={accounts} shelf={shelf} vndPerUsd={vndPerUsd} vndPerLtc={vndPerLtc} locale={locale}/></section>;
  return <section id="catalog" className="section">
    {tabs}
    <div className="section-heading"><div><p className="eyebrow">BUY</p><h2>Choose your amount</h2><p className="muted">{products.length ? 'Any amount on the slider, or one of the packages below. Checkout takes about a minute.' : 'No packages are currently available.'}</p></div><span className="pill">Prices in USD</span></div>
    {source !== 'fallback' && <QuickBuy products={allProducts} slider={slider} vndPerUsd={vndPerUsd} vndPerLtc={vndPerLtc} trades={trades}/>}
    {source === 'fallback' && <p className="catalog-status" role="status">The catalog is temporarily unavailable. Please refresh in a moment.</p>}
    {!products.length && <div className="empty-state"><div className="empty-icon">◇</div><h3>Catalog coming soon</h3><p className="muted">The store has no active packages right now. Please check again later or ask support.</p></div>}
    {/* Search and sort only help with a longer list; a few packages are easier to compare at a glance. */}
    {products.length > 4 && <div className="package-tools">
      <label className="package-search"><span className="sr-only">Search packages</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search packages..."/></label>
      <label className="package-sort"><span className="sr-only">Sort packages</span><select aria-label="Sort packages" value={sort} onChange={event => setSort(event.target.value as CatalogSort)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select></label>
      <label className="stock-filter"><input type="checkbox" checked={inStock} onChange={event => setInStock(event.target.checked)}/>In stock only</label>
      <span className="package-count muted" role="status">{shown.length} of {products.length} packages</span>
    </div>}
    {products.length > 0 && !shown.length && <div className="empty-state"><h3>No matching packages</h3><p className="muted">Try another search or clear your filters.</p><button type="button" className="secondary" onClick={reset}>Clear filters</button></div>}
    <div className="product-grid" aria-busy={query !== deferredQuery}>{shown.map(p => <article className={`product-card ${p.imagePath ? 'has-photo' : ''}`} key={p.id}>
      {p.imagePath ? <div className="preview-slot product-photo"><img loading="lazy" decoding="async" src={p.imagePath} alt={`Preview of ${p.title[locale]}`}/></div> : <div className="preview-slot" role="img" aria-label={p.title[locale]}><span>{p.title[locale]}</span></div>}
      <div className="product-content">
        <div className="row"><span className="eyebrow">DIGITAL PACKAGE</span><span className="sample-tag">{p.stock ? 'Available' : 'Out of stock'}</span></div>
        <h3>{p.title[locale]}</h3>
        <p className="muted">{p.description[locale]}</p>
        <ul className="compare-list">{(comparison[p.id] ?? [stockText(p.stock), p.fields.length ? `${p.fields.filter(field => field.required).length} required delivery field${p.fields.filter(field => field.required).length === 1 ? '' : 's'}` : 'No delivery details required']).map(item => <li key={item}>{item}</li>)}</ul>
        <div className="product-bottom"><div><small>{p.salePriceVnd ? 'Sale price' : 'Price'}</small>{p.salePriceVnd && <del>{formatUsdFromVnd(p.basePriceVnd, vndPerUsd)}</del>}<Price vnd={p.priceVnd} vndPerUsd={vndPerUsd} vndPerLtc={vndPerLtc}/></div><Link className={`button ${!p.stock ? 'disabled-link' : ''}`} aria-disabled={!p.stock} tabIndex={p.stock ? undefined : -1} href={p.stock ? `/${locale}/products/${p.id}` : '#catalog'}>{p.stock ? `Buy ${shortTitle(p.title[locale])}` : 'Out of stock'} <span aria-hidden="true">→</span></Link></div>
      </div>
    </article>)}</div>
    <div className="after-purchase card"><p className="eyebrow">WHAT YOU GET AFTER PURCHASE</p><h3>Pick a time, pay, then trade in the chat</h3><p className="muted">At checkout choose “Trade now” while a trader is online, or a few times you are free. Then pay within 30 minutes using the QR code. We confirm your payment and your time by email and in your Inbox, and deliver with you through the site chat.</p></div>
  </section>;
}
