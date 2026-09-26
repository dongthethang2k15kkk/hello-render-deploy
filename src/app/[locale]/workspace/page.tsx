import {redirect} from 'next/navigation';
import {getSession} from '@/lib/demo-auth';
import ChatPanel from '@/components/chat-panel';

export default async function WorkspacePage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  const account = await getSession();
  if (!account) redirect(`/${locale}/login?next=workspace`);
  const vi = locale === 'vi';
  return <div className="page-heading"><p className="eyebrow">WORKSPACE / {account.role.toUpperCase()}</p><h1>{account.role === 'user' ? (vi ? 'Trao đổi với bên bán' : 'Chat with the seller') : (vi ? 'Trung tâm hỗ trợ khách hàng' : 'Customer support center')}</h1><p className="muted">{vi ? 'Xin chào' : 'Hello'} {account.name}. {account.role === 'user' ? (vi ? 'Đây là kênh trao đổi trực tiếp với admin.' : 'Talk directly with our support team.') : (vi ? 'Quản lý các cuộc trò chuyện của khách hàng.' : 'Manage customer conversations.')}</p><ChatPanel role={account.role}/></div>;
}