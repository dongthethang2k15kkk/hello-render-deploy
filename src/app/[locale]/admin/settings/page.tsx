import Link from 'next/link';
import SettingsViewers from '@/components/settings-viewers';

export default async function AdminSettings({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <div className="page-heading"><p className="eyebrow">ADMIN / SETTINGS</p><h1>Store settings</h1><SettingsViewers resource="settings" prefix context="Settings"/><p className="notice">Manage the catalog, how customers pay and how the shop sends email.</p>
    <div className="grid settings-grid">
      <section className="card"><h2>Products</h2><SettingsViewers resource="settings/products" context="Products"/><p className="muted">Create and edit products, VND prices, sale prices, stock, images and delivery forms.</p><Link className="button" href={`/${locale}/admin/settings/products`}>Manage products</Link></section>
      <section className="card"><h2>Amount slider</h2><p className="muted">A card above the packages where customers drag to any amount; you choose the package, range, step and wording.</p><Link className="button" href={`/${locale}/admin/settings/slider`}>Edit slider</Link></section>
      <section className="card"><h2>Trade counter</h2><p className="muted">Add completed orders from before this website. Completed shop orders continue increasing the public total automatically.</p><Link className="button" href={`/${locale}/admin/settings/trade-counter`}>Edit trade counter</Link></section>
      <section className="card"><h2>Payments</h2><p className="muted">Bank accounts (VietQR), Litecoin and USDT (TRC20) wallets, and the exchange rates used for USD and crypto prices.</p><Link className="button" href={`/${locale}/admin/settings/payments`}>Payment settings</Link></section>
      <section className="card"><h2>Announcements</h2><p className="muted">Images in the large panel at the top of the store. Several images slide automatically and can be swiped.</p><Link className="button" href={`/${locale}/admin/settings/announcements`}>Edit announcements</Link></section>
      <section className="card"><h2>Background</h2><p className="muted">The faint pictures behind the store: drop new images, drag them into place and set size, opacity and blur.</p><Link className="button" href={`/${locale}/admin/settings/background`}>Edit background</Link></section>
      <section className="card"><h2>Admins</h2><p className="muted">Add or remove the Gmail addresses that can sign in to Admin and receive order emails.</p><Link className="button" href={`/${locale}/admin/settings/admins`}>Manage Admins</Link></section>
      <section className="card"><h2>Lucky wheel</h2><p className="muted">Configure coin prizes and odds, then review every customer spin. Each successfully paid order grants one spin.</p><Link className="button" href={`/${locale}/admin/lucky-wheel`}>Manage lucky wheel</Link></section>
    </div>
  </div>;
}
