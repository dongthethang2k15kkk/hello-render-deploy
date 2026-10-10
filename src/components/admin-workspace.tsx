'use client';
import {useCallback, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import AdminOrderView, {type AdminOrder} from './admin-order-view';
import ChatPanel from './chat-panel';
import {LoadingRows} from './loading-state';
import {formatVnd} from '@/lib/money';
import {formatRange, statusLabels, statusTone, VN_TIME_ZONE, type OrderStatus} from '@/lib/order-rules';

type QueueOrder = {id: string; code: string; status: OrderStatus; totalVnd: number; createdAt: string; reportedAt: string | null; asap: boolean; assignedAdmin: string | null;
  appointmentStart: string | null; appointmentEnd: string | null; paymentMethod: string; customer: {id: string; name: string}; items: {title: string; quantity: number}[]};
type Queues = {me: string; waiting: QueueOrder[]; mine: QueueOrder[]; others: QueueOrder[]};

const ago = (iso: string | null) => {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h ago` : new Date(iso).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
};

/** Queues of customers to look after: waiting for an Admin, mine, and those other Admins handle. */
export function WorkspaceQueues({locale}: {locale: string}) {
  const router = useRouter();
  const [queues, setQueues] = useState<Queues | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/workspace', {cache: 'no-store'}).catch(() => null);
    if (response?.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data) { setError(data?.error ?? 'The workspace could not be loaded.'); return; }
    setQueues(data); setError('');
  }, [locale]);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function take(order: QueueOrder) {
    setBusy(order.id); setError('');
    const response = await fetch(`/api/admin/orders/${order.id}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'claim'})}).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy('');
    if (!response?.ok) { setError(data?.error ?? 'The order could not be taken.'); void load(); return; }
    router.push(`/${locale}/admin/workspace/${order.id}`);
  }

  const card = (order: QueueOrder, kind: 'waiting' | 'mine' | 'others') => <li key={order.id} className={`workspace-card ${order.asap && order.status !== 'scheduled' ? 'asap' : ''}`}>
    <div className="workspace-card-head"><strong>{order.customer.name}</strong><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span>{order.asap && order.status !== 'scheduled' && <span className="asap-badge">Free now</span>}</div>
    <p className="workspace-card-meta">{order.code} · {order.items.map(item => `${item.title} × ${item.quantity}`).join(', ')} · {formatVnd(order.totalVnd)}{order.paymentMethod === 'ltc' ? ' · Litecoin' : order.paymentMethod === 'usdt' ? ' · USDT' : order.paymentMethod === 'paypal' ? ' · PayPal' : ''}</p>
    <p className="workspace-card-time">{order.appointmentStart && order.appointmentEnd ? <>Appointment {formatRange(order.appointmentStart, order.appointmentEnd, VN_TIME_ZONE)}</> : <>Reported {ago(order.reportedAt ?? order.createdAt)}</>}{kind === 'others' && order.assignedAdmin ? ` · handled by ${order.assignedAdmin}` : ''}</p>
    <div className="workspace-card-actions">
      {kind === 'waiting' ? <button type="button" disabled={busy === order.id} onClick={() => void take(order)}>{busy === order.id ? 'Taking…' : 'Take this customer'}</button>
        : <Link className={`button ${kind === 'mine' ? '' : 'secondary'}`} href={`/${locale}/admin/workspace/${order.id}`}>{kind === 'mine' ? 'Open workspace' : 'View'}</Link>}
    </div>
  </li>;

  const section = (title: string, hint: string, list: QueueOrder[] | undefined, kind: 'waiting' | 'mine' | 'others', empty: string) => <section className="workspace-queue">
    <h2>{title} {list && list.length > 0 && <span className="workspace-count">{list.length}</span>}</h2><p className="field-caption">{hint}</p>
    {!list ? <LoadingRows label={`Loading ${title.toLowerCase()}…`} rows={2}/> : list.length ? <ul className="workspace-list">{list.map(order => card(order, kind))}</ul> : <p className="admin-empty">{empty}</p>}
  </section>;

  return <div className="page-heading workspace-page"><p className="eyebrow">ADMIN / WORKSPACE</p><h1>Workspace</h1>
    <p className="muted">One place for each customer: take a customer, then chat, confirm the payment, book the time and complete the transaction on one screen.</p>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    <div className="workspace-queues">
      {section('Waiting for an Admin', 'Reported or paid orders nobody has taken. The first Admin to take one handles it.', queues?.waiting, 'waiting', 'Nobody is waiting. New payments appear here and by email.')}
      {section('My customers', 'Orders you are handling, by appointment time.', queues?.mine, 'mine', 'You are not handling any order right now.')}
      {section('Handled by other Admins', 'Open these to read along, or take one over if its Admin cannot finish.', queues?.others, 'others', 'No other Admin is handling an order.')}
    </div>
  </div>;
}

/** One customer's order and their chat side by side; on phones the two are tabs. */
export function WorkspaceOrder({locale, id, accountId}: {locale: string; id: string; accountId: string}) {
  const [customer, setCustomer] = useState<AdminOrder['customer'] | null>(null);
  const [tab, setTab] = useState<'order' | 'chat'>('order');
  const tabs = useRef<HTMLDivElement>(null);
  const switched = useRef(false);
  const show = (next: 'order' | 'chat') => { switched.current = true; setTab(next); };
  // On phones the tabs stick to the top: once the chosen view is on screen, bring them up so it gets the whole screen.
  useEffect(() => {
    const element = tabs.current;
    // scrollIntoView would honour the storefront's scroll-padding-top, so scroll to the exact position instead.
    if (switched.current && element && window.matchMedia('(max-width: 900px)').matches) window.scrollTo({top: element.getBoundingClientRect().top + window.scrollY, behavior: 'instant'});
  }, [tab]);
  const onLoaded = useCallback((order: AdminOrder) => setCustomer(current => current?.id === order.customer.id ? current : order.customer), []);
  return <div className={`workspace-detail show-${tab}`}>
    <div ref={tabs} className="workspace-tabs" role="tablist" aria-label="Workspace view">
      <button type="button" role="tab" aria-selected={tab === 'order'} className={tab === 'order' ? 'active' : 'secondary'} onClick={() => show('order')}>Order</button>
      <button type="button" role="tab" aria-selected={tab === 'chat'} className={tab === 'chat' ? 'active' : 'secondary'} onClick={() => show('chat')}>Chat{customer ? ` with ${customer.name}` : ''}</button>
    </div>
    <div className="workspace-order-column"><AdminOrderView locale={locale} id={id} variant="workspace" onLoaded={onLoaded}/></div>
    <div className="workspace-chat-column">{customer ? <ChatPanel accountId={accountId} role="admin" lockedRoom={`user:${customer.id}`} lockedTitle={customer.name} onBack={() => show('order')} backLabel="Back to the order"/> : <LoadingRows label="Loading the conversation…"/>}</div>
  </div>;
}
