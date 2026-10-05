'use client';
import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {setSoundEnabled, soundEnabled} from '@/lib/notify-sound';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {formatUsdFromVnd} from '@/lib/money';
import {formatRange, statusLabels, statusTone, type OrderStatus} from '@/lib/order-rules';
import {useCatalog} from './catalog-provider';
import {LoadingRows} from './loading-state';
import {invalidateJson, loadJson} from '@/lib/client-data-cache';

type OrderRow = {code: string; status: OrderStatus; totalVnd: number; createdAt: string; items: {title: string; quantity: number}[]};
export type Notice = {id: string; title: string; body: string; link: string; readAt: string | null; createdAt: string};
type Appointment = {code: string; appointmentStart: string; appointmentEnd: string};

const ago = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h ago`;
  return new Date(iso).toLocaleDateString('en-GB', {day: 'numeric', month: 'short'});
};

/**
 * A header pill that opens a small, non-modal glass window under it: the page stays usable around it. It closes on
 * Escape, an outside click or navigation. Rendered in <body> because the frosted header would trap fixed positioning.
 */
function HeaderPopover({open, onOpenChange, label, title, icon, text, badge, children, pillClass = ''}: {open: boolean; onOpenChange: (open: boolean) => void; label: string; title: string; icon: ReactNode; text: string; badge: ReactNode; children: ReactNode; pillClass?: string}) {
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{top: number; right: number; width: number} | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const rect = button.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(380, window.innerWidth - 24);
      setPlace({top: Math.round(rect.bottom + 10), right: Math.max(12, Math.min(Math.round(window.innerWidth - rect.right), window.innerWidth - width - 12)), width});
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !button.current?.contains(target)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { onOpenChange(false); button.current?.focus(); } };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open, onOpenChange]);

  return <>
    <button ref={button} type="button" className={`header-pill ${open ? 'open' : ''} ${pillClass}`} title={title} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={() => onOpenChange(!open)}>{icon}<span>{text}</span>{badge}</button>
    {open && place && createPortal(<div ref={panel} className="header-panel" role="dialog" aria-label={title} style={{top: place.top, right: place.right, width: place.width}}>{children}</div>, document.body)}
  </>;
}

export function OrdersPopover({locale, cartCount, open, onOpenChange, icon, badge}: {locale: string; cartCount: number; open: boolean; onOpenChange: (open: boolean) => void; icon: ReactNode; badge: ReactNode}) {
  const {vndPerUsd} = useCatalog();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    // Shows the last list at once and refreshes it in the background.
    loadJson<{orders: OrderRow[]; error?: string}>('/api/orders', {maxAgeMs: 30_000}).then(response => {
      if (!response.ok) throw new Error(response.data.error);
      setOrders(response.data.orders); setError('');
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Orders could not be loaded.'));
  }, [open]);
  const close = () => onOpenChange(false);
  return <HeaderPopover open={open} onOpenChange={onOpenChange} title="Orders" text="Orders" icon={icon} badge={badge} label={`Orders, ${cartCount} item${cartCount === 1 ? '' : 's'} in cart`}>
    <div className="header-panel-head"><strong>Orders</strong><Link href={`/${locale}/orders`} onClick={close}>See all →</Link></div>
    {cartCount > 0 && <Link className="header-panel-cart" href={`/${locale}/cart`} onClick={close}><span>{cartCount} item{cartCount === 1 ? '' : 's'} in your cart</span><strong>Checkout →</strong></Link>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {!orders && !error && <LoadingRows label="Loading orders…" rows={3}/>}
    {orders && orders.length === 0 && <p className="muted header-panel-empty">No orders yet. Your orders and their payment status appear here.</p>}
    {orders && orders.length > 0 && <ul className="header-panel-list">{orders.slice(0, 5).map(order => <li key={order.code}>
      <Link href={`/${locale}/orders/${order.code}`} onClick={close}>
        <span className="header-panel-row"><strong>{order.code}</strong><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span></span>
        <span className="header-panel-row"><small>{order.items.map(item => `${item.title} × ${item.quantity}`).join(', ')}</small><b>{formatUsdFromVnd(order.totalVnd, vndPerUsd)}</b></span>
        <small className="header-panel-time">{ago(order.createdAt)}</small>
      </Link>
    </li>)}</ul>}
  </HeaderPopover>;
}

export function InboxPopover({locale, unread, onUnreadChange, open, onOpenChange, icon, badge, ringing = false}: {locale: string; unread: number; onUnreadChange: (unread: number) => void; open: boolean; onOpenChange: (open: boolean) => void; icon: ReactNode; badge: ReactNode; ringing?: boolean}) {
  const router = useRouter();
  const [sound, setSound] = useState(true);
  useEffect(() => setSound(soundEnabled()), []);
  const [items, setItems] = useState<Notice[] | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    loadJson<{notifications: Notice[]; appointments?: Appointment[]; unread: number; error?: string}>('/api/notifications', {maxAgeMs: 20_000}).then(response => {
      if (!response.ok) throw new Error(response.data.error);
      setItems(response.data.notifications); setAppointments(response.data.appointments ?? []); onUnreadChange(response.data.unread); setError('');
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Your Inbox could not be loaded.'));
  }, [open, onUnreadChange]);
  async function markRead(ids?: string[]) {
    const response = await fetch('/api/notifications', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action: 'read', ...(ids ? {ids} : {})})}).catch(() => null);
    const data = await response?.json().catch(() => null);
    invalidateJson('/api/notifications', '/api/auth/session');
    if (typeof data?.unread === 'number') onUnreadChange(data.unread);
  }
  function openItem(item: Notice) {
    if (!item.readAt) { setItems(current => current?.map(entry => entry.id === item.id ? {...entry, readAt: new Date().toISOString()} : entry) ?? null); void markRead([item.id]); }
    onOpenChange(false);
    router.push(item.link.startsWith('/') ? item.link : `/${locale}/inbox`);
  }
  return <HeaderPopover open={open} onOpenChange={onOpenChange} title="Inbox" text="Inbox" icon={icon} badge={badge} label={`Inbox, ${unread} unread`} pillClass={`${unread > 0 ? 'has-unread' : ''} ${ringing ? 'ringing' : ''}`}>
    <div className="header-panel-head"><strong>Inbox</strong><button type="button" className="header-panel-link sound-toggle" aria-pressed={sound} onClick={() => { setSoundEnabled(!sound); setSound(!sound); }}>{sound ? '🔔 Sound on' : '🔕 Sound off'}</button>{unread > 0 ? <button type="button" className="header-panel-link" onClick={() => { setItems(current => current?.map(entry => ({...entry, readAt: entry.readAt ?? new Date().toISOString()})) ?? null); void markRead(); }}>Mark all read</button> : <span className="muted">All caught up</span>}</div>
    {appointments.length > 0 && <div className="header-panel-appointments">{appointments.slice(0, 2).map(item => <Link key={item.code} href={`/${locale}/orders/${item.code}`} onClick={() => onOpenChange(false)}><small>Upcoming appointment · {item.code}</small><strong>{formatRange(item.appointmentStart, item.appointmentEnd, Intl.DateTimeFormat().resolvedOptions().timeZone)}</strong></Link>)}</div>}
    {error && <p className="error-text" role="alert">{error}</p>}
    {!items && !error && <LoadingRows label="Loading your Inbox…" rows={3}/>}
    {items && items.length === 0 && <p className="muted header-panel-empty">No messages yet. Updates about your orders appear here.</p>}
    {items && items.length > 0 && <ul className="header-panel-list">{items.slice(0, 6).map(item => <li key={item.id} className={item.readAt ? '' : 'unread'}>
      <button type="button" className="header-panel-item" onClick={() => openItem(item)}>
        <span className="header-panel-row"><strong>{item.title}</strong><small className="header-panel-time">{ago(item.createdAt)}</small></span>
        <small className="header-panel-body">{item.body}</small>
      </button>
    </li>)}</ul>}
    <Link className="header-panel-foot" href={`/${locale}/inbox`} onClick={() => onOpenChange(false)}>Open Inbox →</Link>
  </HeaderPopover>;
}

/** Pops up under the header when a new Inbox notification arrives; a click opens it, it hides by itself after a while. */
export function NotificationToast({notice, onOpen, onClose}: {notice: Notice | null; onOpen: (notice: Notice) => void; onClose: () => void}) {
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(onClose, 12000);
    return () => window.clearTimeout(timer);
  }, [notice, onClose]);
  if (!notice || typeof document === 'undefined') return null;
  return createPortal(<div className="notification-toast" role="alert">
    <button type="button" className="notification-toast-body" onClick={() => onOpen(notice)}>
      <span className="notification-toast-icon" aria-hidden="true">🔔</span>
      <span><small>New notification</small><strong>{notice.title}</strong><span>{notice.body}</span></span>
    </button>
    <button type="button" className="notification-toast-close" aria-label="Dismiss notification" onClick={onClose}>×</button>
  </div>, document.body);
}
