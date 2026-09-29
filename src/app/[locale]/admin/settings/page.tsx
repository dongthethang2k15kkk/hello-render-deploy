import Link from 'next/link';
import SettingsViewers from '@/components/settings-viewers';

export default async function AdminSettings({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <div className="page-heading"><p className="eyebrow">ADMIN / SETTINGS</p><h1>{'Store settings'}</h1><SettingsViewers resource="settings" prefix context="Settings"/><p className="notice">{'Manage store operations and configuration.'}</p><div className="grid"><section className="card"><h2>{'Products'}</h2><SettingsViewers resource="settings/products" context="Products"/><p className="muted">{'Create, edit, activate products, sale prices, stock and packages.'}</p><Link className="button" href={`/${locale}/admin/settings/products`}>{'Manage products'}</Link></section><section className="card"><h2>{'Staging payments'}</h2><SettingsViewers resource="payments" context="Payments"/><p className="muted">{'For internal operations only; requires a separate Bearer key.'}</p><Link className="button secondary" href={`/${locale}/admin/payments`}>{'Open staging'}</Link></section></div></div>;
}