'use client';
import {use, useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import TimeSlotsDialog from '@/components/time-slots-dialog';
import {googleCalendarLink} from '@/lib/calendar';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';
import {formatRange, statusLabels, statusTone, type OrderStatus} from '@/lib/order-rules';

type Order = {
  id: string; code: string; status: OrderStatus; totalVnd: number; vndPerUsd: number; holdExpiresAt: string; createdAt: string;
  bankSnapshot: {bankName: string; accountNumber: string; accountHolder: string};
  appointmentStart: string | null; appointmentEnd: string | null; deliveryNote: string | null; cancelReason: string | null;
  items: {title: string; sku: string; unitPriceVnd: number; quantity: number; delivery: Record<string, string>}[];
  slots: {startsAt: string; endsAt: string}[];
  events: {action: string; note: string | null; createdAt: string}[];
};

const eventLabels: Record<string, string> = {created: 'Order placed', payment_reported: 'You reported the transfer', times_updated: 'You changed your times', payment_confirmed: 'Payment confirmed', scheduled: 'Appointment booked', rescheduled: 'Appointment changed', completed: 'Order completed', cancelled: 'Order cancelled', expired: 'Payment window ended'};

function Copy({label, value}: {label: string; value: string}) {
  const [copied, setCopied] = useState(false);
  return <div className="pay-row"><span>{label}</span><strong>{value}</strong><button type="button" className="secondary copy-button" onClick={() => {void navigator.clipboard?.writeText(value).then(() => {setCopied(true); window.setTimeout(() => setCopied(false), 1500);});}}>{copied ? 'Copied' : 'Copy'}</button></div>;
}

export default function OrderPage({params}: {params: Promise<{locale: string; code: string}>}) {
  const {locale, code} = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'report' | 'update-times' | null>(null);
  const [notice, setNotice] = useState('');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const load = useCallback(async () => {
    const response = await fetch(`/api/orders/${code}`, {cache: 'no-store'}).catch(() => null);
    if (response?.status === 401) { router.replace(`/${locale}/login?next=account`); return; }
    const data = await response?.json().catch(() => null);
    if (!response?.ok || !data?.order) { setError(data?.error ?? 'This order could not be loaded.'); return; }
    setOrder(data.order); setQr(data.qrSvg); setOffset(Date.parse(data.serverTime) - Date.now()); setError('');
  }, [code, locale, router]);

  useEffect(() => {void load();}, [load]);
  // Refresh while waiting on the shop so confirmations appear without reloading.
  useEffect(() => {
    if (!order || !['awaiting_payment', 'payment_reported', 'paid'].includes(order.status)) return;
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [order, load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  async function act(body: Record<string, unknown>) {
    const response = await fetch(`/api/orders/${code}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return data.error ?? 'The action could not be completed.';
    await load();
    return null;
  }

  if (!order) return <div className="page-heading"><p className="eyebrow">ORDER {code}</p>{error ? <><p className="error-text" role="alert">{error}</p><Link href={`/${locale}/orders`}>← My orders</Link></> : <p aria-busy="true">Loading order…</p>}</div>;
  const secondsLeft = Math.max(0, Math.floor((Date.parse(order.holdExpiresAt) - (now + offset)) / 1000));
  const calendar = order.appointmentStart && order.appointmentEnd ? {start: new Date(order.appointmentStart), end: new Date(order.appointmentEnd), title: `Jewish Horse · order ${order.code}`, description: 'Open the Jewish Horse website and go to Chat at this time.', url: typeof window === 'undefined' ? '' : window.location.href} : null;

  return <div className="order-page">
    <div className="page-heading"><p className="eyebrow"><Link href={`/${locale}/orders`}>MY ORDERS</Link> / {order.code}</p><h1>Order {order.code}</h1><p><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span></p></div>
    {notice && <p className="account-feedback" role="status">{notice}</p>}
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="order-layout">
      <div>
        {order.status === 'awaiting_payment' && <section className="card pay-card">
          <span className="eyebrow">STEP 1 / PAY BY BANK TRANSFER</span>
          <h2>{secondsLeft > 0 ? <>Pay within <span className="countdown">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span></> : 'Payment window ended'}</h2>
          <div className="pay-grid">
            {qr && <figure className="vietqr"><img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`} alt={`VietQR code: ${formatVnd(order.totalVnd)} to ${order.bankSnapshot.bankName}`}/><figcaption>Scan with your banking app</figcaption></figure>}
            <div className="pay-details">
              <Copy label="Bank" value={order.bankSnapshot.bankName}/>
              <Copy label="Account number" value={order.bankSnapshot.accountNumber}/>
              <Copy label="Account holder" value={order.bankSnapshot.accountHolder}/>
              <Copy label="Amount (VND)" value={String(order.totalVnd)}/>
              <Copy label="Transfer content" value={order.code}/>
              <p className="field-caption">Transfer exactly <strong>{formatVnd(order.totalVnd)}</strong> with the content <strong>{order.code}</strong> so we can match your payment.</p>
            </div>
          </div>
          <div className="pay-actions"><button type="button" disabled={secondsLeft <= 0} onClick={() => setDialog('report')}>I’ve transferred →</button><button type="button" className="secondary" onClick={() => { if (window.confirm('Cancel this order?')) void act({action: 'cancel'}).then(failure => failure ? setError(failure) : setNotice('Order cancelled.')); }}>Cancel order</button></div>
          {secondsLeft <= 0 && <p className="field-caption">If you already transferred, message us in <Link href={`/${locale}/workspace`}>Chat</Link> with the order code.</p>}
        </section>}

        {(order.status === 'payment_reported' || order.status === 'paid') && <section className="card">
          <span className="eyebrow">{order.status === 'paid' ? 'PAYMENT CONFIRMED' : 'CHECKING YOUR PAYMENT'}</span>
          <h2>{order.status === 'paid' ? 'We are booking one of your times' : 'Thanks! We are confirming your transfer'}</h2>
          <p className="muted">You will get an email and a message in your <Link href={`/${locale}/inbox`}>Inbox</Link> when your appointment is booked.</p>
          <h3>Your available times</h3>
          <ul className="slot-list">{order.slots.map(slot => <li key={slot.startsAt}>{formatRange(slot.startsAt, slot.endsAt, timeZone)}</li>)}</ul>
          <button type="button" className="secondary" onClick={() => setDialog('update-times')}>Change my times</button>
        </section>}

        {order.status === 'scheduled' && calendar && <section className="card appointment-card">
          <span className="eyebrow">APPOINTMENT</span><h2>{formatRange(calendar.start, calendar.end, timeZone)}</h2>
          <p className="muted">At this time, open Chat on this website. We will deliver your order with you there.</p>
          <div className="pay-actions"><Link className="button" href={`/${locale}/workspace`}>Open chat</Link><a className="button secondary" href={googleCalendarLink(calendar)} target="_blank" rel="noreferrer">Add to Google Calendar</a><a className="button secondary" href={`/api/orders/${order.code}/calendar`}>Download calendar file</a></div>
        </section>}

        {order.status === 'completed' && <section className="card delivery-card"><span className="eyebrow">DELIVERED</span><h2>Your delivery details</h2><p className="delivery-note">{order.deliveryNote}</p><p className="field-caption">Only you can see this. Questions? <Link href={`/${locale}/workspace`}>Open chat</Link>.</p></section>}

        {(order.status === 'cancelled' || order.status === 'expired') && <section className="card"><span className="eyebrow">{order.status === 'expired' ? 'EXPIRED' : 'CANCELLED'}</span><h2>{order.status === 'expired' ? 'The payment window ended' : 'This order was cancelled'}</h2>{order.cancelReason && <p className="muted">{order.cancelReason}</p>}<Link className="button" href={`/${locale}#catalog`}>Back to packages</Link></section>}

        <section className="card" style={{marginTop: 20}}><h2>Timeline</h2><ol className="timeline">{order.events.map(event => <li key={event.createdAt + event.action}><strong>{eventLabels[event.action] ?? event.action}</strong><span>{new Date(event.createdAt).toLocaleString('en-GB')}</span>{event.note && <small>{event.note}</small>}</li>)}</ol></section>
      </div>
      <aside className="card order-summary">
        <h2>Items</h2>
        {order.items.map((item, index) => <div className="summary-item" key={index}><div className="summary-line"><span>{item.title} × {item.quantity}</span><strong>{formatVnd(item.unitPriceVnd * item.quantity)}</strong></div>{Object.entries(item.delivery).filter(([, value]) => value).map(([key, value]) => <small key={key}>{key}: {value}</small>)}</div>)}
        <div className="summary-total"><small>Total</small><p className="pay-amount">{formatVnd(order.totalVnd)}</p><small>≈ {formatUsdFromVnd(order.totalVnd, order.vndPerUsd)}</small></div>
        <p className="field-caption">Placed {new Date(order.createdAt).toLocaleString('en-GB')}</p>
      </aside>
    </div>
    <TimeSlotsDialog open={dialog !== null} title={dialog === 'report' ? 'When can you receive your order?' : 'Change your available times'} submitLabel={dialog === 'report' ? 'Send my times' : 'Save times'} onClose={() => setDialog(null)} onSubmit={async input => {
      const failure = await act({action: dialog ?? 'report', ...input});
      if (!failure) { setDialog(null); setNotice(dialog === 'report' ? 'Thanks! We received your times and are confirming your payment.' : 'Your times were updated.'); }
      return failure;
    }}/>
  </div>;
}
