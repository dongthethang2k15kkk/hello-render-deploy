import Link from 'next/link';
import SettingsViewers from '@/components/settings-viewers';

export default async function AdminSettings({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <div className="page-heading"><p className="eyebrow">ADMIN / SETTINGS</p><h1>Store settings</h1><SettingsViewers resource="settings" prefix context="Settings"/><p className="notice">Manage the catalog, how customers pay and how the shop sends email.</p>
    <div className="grid settings-grid">
      <section className="card"><h2>Products</h2><SettingsViewers resource="settings/products" context="Products"/><p className="muted">Create and edit products, VND prices, sale prices, stock, images and delivery forms.</p><Link className="button" href={`/${locale}/admin/settings/products`}>Manage products</Link></section>
      <section className="card"><h2>Payments</h2><p className="muted">Bank accounts shown to customers with a VietQR code, and the VND/USD rate used to display USD prices.</p><Link className="button" href={`/${locale}/admin/settings/payments`}>Payment settings</Link></section>
      <section className="card"><h2>Announcements</h2><p className="muted">Images in the large panel at the top of the store. Several images slide automatically and can be swiped.</p><Link className="button" href={`/${locale}/admin/settings/announcements`}>Edit announcements</Link></section>
      <section className="card"><h2>Background</h2><p className="muted">The faint pictures behind the store: drop new images, drag them into place and set size, opacity and blur.</p><Link className="button" href={`/${locale}/admin/settings/background`}>Edit background</Link></section>
      <section className="card"><h2>Admins</h2><p className="muted">Add or remove the Gmail addresses that can sign in to Admin and receive order emails.</p><Link className="button" href={`/${locale}/admin/settings/admins`}>Manage Admins</Link></section>
      <section className="card"><h2>Email</h2><p className="muted">Connect the shop’s Gmail to send order emails to Admins and customers, send a test and review the email log.</p><Link className="button" href={`/${locale}/admin/settings/email`}>Email settings</Link></section>
    </div>
  </div>;
}
