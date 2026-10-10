import {getSession} from '@/lib/auth';
import {redirect} from 'next/navigation';
import ChatPanel from '@/components/chat-panel';

export default async function AdminChat({searchParams}: {searchParams: Promise<{room?: string}>}) {
  const account = await getSession();
  if (account?.role !== 'admin') redirect('/en/login?next=admin/chat');
  const {room} = await searchParams;
  const initialRoom = typeof room === 'string' && /^user:[a-z0-9]{10,40}$/.test(room) ? room : '';
  return <div className="chat-page"><div className="page-heading"><p className="eyebrow">ADMIN / CHAT</p><h1>Customer inbox</h1></div><ChatPanel accountId={account.id} role="admin" initialRoom={initialRoom} backHref="/en/admin/overview" backLabel="Back to Admin"/></div>;
}
