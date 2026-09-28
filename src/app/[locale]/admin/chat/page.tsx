import ChatPanel from '@/components/chat-panel';

export default async function AdminChat({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  return <><div className="page-heading"><p className="eyebrow">ADMIN / CHAT</p><h1>{locale === 'vi' ? 'Hộp thư khách hàng' : 'Customer inbox'}</h1><p className="muted">{locale === 'vi' ? 'Trả lời từng cuộc trò chuyện trong hộp thư riêng.' : 'Reply to each customer in their own conversation.'}</p></div><ChatPanel role="admin"/></>;
}