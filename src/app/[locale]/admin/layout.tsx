import {redirect} from 'next/navigation';
import Link from 'next/link';
import {getSession} from '@/lib/demo-auth';
import AdminLogout from '@/components/admin-logout';

export default async function AdminLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if ((await getSession())?.role !== 'admin') redirect(`/${locale}/login`);
  return <div className="admin-surface"><header className="admin-header"><div className="shell admin-header-inner"><Link className="brand" href={`/${locale}/admin`}>Jewish Horse / Admin</Link><nav aria-label="Admin navigation"><Link href={`/${locale}/admin/chat`}>Chat</Link><Link href={`/${locale}/admin/settings`}>Settings</Link></nav><div className="admin-header-actions"><AdminLogout locale={locale}/></div></div></header><main className="shell admin-content">{children}</main></div>;
}