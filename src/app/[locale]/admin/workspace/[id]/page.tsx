import {redirect} from 'next/navigation';
import {getSession} from '@/lib/auth';
import {WorkspaceOrder} from '@/components/admin-workspace';

export default async function WorkspaceOrderPage({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = await params;
  const account = await getSession();
  if (account?.role !== 'admin') redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/admin/workspace/${id}`)}`);
  return <WorkspaceOrder locale={locale} id={id} accountId={account.id}/>;
}
