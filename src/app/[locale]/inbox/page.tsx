'use client';
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {formatRange} from '@/lib/order-rules';
import {LoadingRows} from '@/components/loading-state';

type Item = {id: string; title: string; body: string; link: string; readAt: string | null; createdAt: string};
type Appointment = {code: string; appointmentStart: string; appointmentEnd: string};

export default function Inbox() {
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/notifications', {cache: 'no-store'}).catch(() => null);
    if (response?.status === 401) { router.replace(`/${locale}/login?next=account`); return; }
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data) { setError(data?.error ?? 'Your Inbox could not be loaded.'); return; }
    setItems(data.notifications); setUnread(data.unread); setAppointments(data.appointments ?? []);
  }, [locale, router]);
  useEffect(() => {void load();}, [load]);

  async function markRead(ids?: string[]) {
    await fetch('/api/notifications', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'read', ...(ids ? {ids} : {})})}).catch(() => null);
  }

  return <div className="page-heading inbox-page"><p className="eyebrow">YOUR ACCOUNT</p><h1>Inbox</h1>
    <div className="inbox-toolbar"><p className="muted">{unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'All caught up.'} Order updates also arrive by email.</p>{unread > 0 && <button type="button" className="secondary" onClick={() => void markRead().then(load)}>Mark all as read</button>}</div>
    {appointments.length > 0 && <section className="card inbox-appointments"><h2>Upcoming appointments</h2><ul>{appointments.map(item => <li key={item.code}><Link href={`/${locale}/orders/${item.code}`}><strong>{formatRange(item.appointmentStart, item.appointmentEnd, Intl.DateTimeFormat().resolvedOptions().timeZone)}</strong><span>Order {item.code} · open Chat at this time</span></Link></li>)}</ul></section>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {!items && !error && <LoadingRows label="Loading…"/>}
    {items && items.length === 0 && <div className="empty-state"><h2>No messages yet</h2><p className="muted">Updates about your orders will appear here.</p></div>}
    {items && items.length > 0 && <ul className="inbox-list">{items.map(item => <li key={item.id} className={item.readAt ? '' : 'unread'}>
      <Link href={item.link.startsWith('/') ? item.link : `/${locale}`} onClick={() => { if (!item.readAt) void markRead([item.id]); }}>
        <strong>{item.title}</strong><span>{item.body}</span><small>{new Date(item.createdAt).toLocaleString('en-GB')}</small>
      </Link>
    </li>)}</ul>}
  </div>;
}
