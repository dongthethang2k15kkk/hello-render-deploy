import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import Link from 'next/link';
import {getSession} from '@/lib/auth';
import AdminLogout from '@/components/admin-logout';
import AdminNav from '@/components/admin-nav';
import {AdminPresenceProvider, PresenceSummary} from '@/components/admin-presence';
import {needsActionCount} from '@/lib/order-store';
import {AvailabilityToggle} from '@/components/availability';

export default async function AdminLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const account = await getSession();
  if (account?.role !== 'admin') redirect(`/${locale}/login?next=${encodeURIComponent((await headers()).get('x-shop-path') ?? '')}`);
  const pending = await needsActionCount();
  return <AdminPresenceProvider><div className="admin-surface"><header className="admin-header"><div className="shell admin-header-inner"><Link className="brand" href={`/${locale}/admin`}>Jewish Horse / Admin</Link><AdminNav locale={locale} initialOrders={pending}/><div className="admin-header-actions"><AvailabilityToggle/><PresenceSummary/><span className="admin-identity" title={account.email}>{account.email ?? account.name}</span><AdminLogout locale={locale}/></div></div></header><main className="shell admin-content">{children}</main></div></AdminPresenceProvider>;
}