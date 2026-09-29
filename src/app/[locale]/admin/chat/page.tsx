import ChatPanel from '@/components/chat-panel';

export default async function AdminChat({searchParams}: {searchParams: Promise<{room?: string}>}) {
  const {room} = await searchParams;
  const initialRoom = typeof room === 'string' && /^user:[a-z0-9]{10,40}$/.test(room) ? room : '';
  return <><div className="page-heading"><p className="eyebrow">ADMIN / CHAT</p><h1>Customer inbox</h1><p className="muted">Reply to each customer in their own conversation.</p></div><ChatPanel role="admin" initialRoom={initialRoom}/></>;
}
