import {redirect} from 'next/navigation';
import {getSession} from '@/lib/auth';
import ChatPanel from '@/components/chat-panel';

export default async function WorkspacePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const account = await getSession();
  if (!account) redirect(`/${locale}/login?next=workspace`);
  if (account.role === 'admin') redirect(`/${locale}/admin/chat`);
  return <div className="page-heading"><p className="eyebrow">WORKSPACE / {account.role.toUpperCase()}</p><h1>{account.role === 'user' ? 'Chat with support' : 'Customer support center'}</h1><p className="muted">{'Hello'} {account.name}. {account.role === 'user' ? 'Talk directly with our support team.' : 'Manage customer conversations.'}</p><ChatPanel role={account.role}/></div>;
}
