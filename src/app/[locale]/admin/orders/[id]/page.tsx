'use client';
import {use, useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {formatDateTime} from '@/lib/customer-labels';
import {formatVnd} from '@/lib/money';
import {explorerAddress, explorerTx} from '@/lib/ltc-format';
import {dateToVietnamLocal, formatRange, statusLabels, statusTone, VN_TIME_ZONE, type OrderStatus} from '@/lib/order-rules';

type Order = {
  id: string; code: string; status: OrderStatus; totalVnd: number; createdAt: string; holdExpiresAt: string; reportedAt: string | null; customerTimeZone: string | null;
  paidAt: string | null; paidAmountVnd: number | null; paymentReference: string | null; paymentConfirmedBy: string | null; assignedAdmin: string | null;
  appointmentStart: string | null; appointmentEnd: string | null; deliveryNote: string | null; cancelReason: string | null;
  paymentMethod: 'bank' | 'ltc'; cryptoAmount: string | null; cryptoRateVnd: number | null; customerTxid: string | null;
  asap: boolean; paymentSource: string | null; paymentSeenAt: string | null; txConfirmations: number | null;
  bankSnapshot: {bankName: string; accountNumber: string; accountHolder: string} | {network: 'LTC'; address: string; label: string};
  customer: {id: string; name: string; email: string; status: string};
  items: {id: string; title: string; sku: string; unitPriceVnd: number; quantity: number; delivery: Record<string, string>}[];
  slots: {id: string; startsAt: string; endsAt: string}[];
  events: {id: string; actor: string; action: string; note: string | null; createdAt: string}[];
  emails: {id: string; recipient: string; subject: string; kind: string; status: string; error: string | null; createdAt: string}[];
};

const plusMinutes = (local: string, minutes: number) => dateToVietnamLocal(new Date(new Date(`${local}:00+07:00`).getTime() + minutes * 60_000));

export default function AdminOrderDetail({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [scheduleNow, setScheduleNow] = useState(true);
  const [delivery, setDelivery] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [startMinutes, setStartMinutes] = useState('60');

  const adopt = useCallback((next: Order) => {
    setOrder(next);
    setAmount(current => current || String(next.paidAmountVnd ?? next.totalVnd));
    if (next.customerTxid) setReference(current => current || next.customerTxid!);
    const first = next.appointmentStart ?? next.slots[0]?.startsAt;
    if (first) setStart(current => current || dateToVietnamLocal(new Date(first)));
    const firstEnd = next.appointmentEnd ?? (next.slots[0] ? new Date(Math.min(Date.parse(next.slots[0].startsAt) + 60 * 60_000, Date.parse(next.slots[0].endsAt))).toISOString() : null);
    if (firstEnd) setEnd(current => current || dateToVietnamLocal(new Date(firstEnd)));
  }, []);

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders/${id}`, {cache: 'no-store'}).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok || !body?.order) { setError(body?.error ?? 'Order could not be loaded.'); return; }
    adopt(body.order);
  }, [id, adopt]);
  useEffect(() => {void load();}, [load]);
  const live = order ? ['awaiting_payment', 'payment_reported', 'paid'].includes(order.status) : false;
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20000);
    return () => window.clearInterval(timer);
  }, [live, load]);

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/orders/${id}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOrder(data.order); setMessage(success);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); return false; }
    finally { setBusy(false); }
  }

  if (!order) return <div className="page-heading"><Link href={`/${locale}/admin/orders`}>← Orders</Link>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <p className="muted" role="status">Loading order…</p>}</div>;
  const canConfirm = ['awaiting_payment', 'payment_reported', 'expired'].includes(order.status);
  const canSchedule = order.status === 'paid' || order.status === 'scheduled';
  const canComplete = order.status === 'paid' || order.status === 'scheduled';
  const canCancel = ['awaiting_payment', 'payment_reported', 'paid', 'scheduled'].includes(order.status);
  const appointment = {start, end};
  const timePicker = <div className="appointment-picker">
    {order.slots.length > 0 && <div className="slot-choices"><span className="field-caption">Customer’s free times (Vietnam time) — click to use:</span>{order.slots.map(slot => <button type="button" key={slot.id} className="secondary slot-choice" onClick={() => { const s = dateToVietnamLocal(new Date(slot.startsAt)); setStart(s); setEnd(dateToVietnamLocal(new Date(Math.min(Date.parse(slot.startsAt) + 60 * 60_000, Date.parse(slot.endsAt))))); }}>{formatRange(slot.startsAt, slot.endsAt, VN_TIME_ZONE)}</button>)}</div>}
    <div className="admin-field-row"><label>Start (Vietnam time)<input type="datetime-local" value={start} onChange={event => { setStart(event.target.value); if (!end || end <= event.target.value) setEnd(plusMinutes(event.target.value, 60)); }} required/></label><label>End<input type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} required/></label></div>
    {order.customerTimeZone && order.customerTimeZone !== VN_TIME_ZONE && <p className="field-caption">Customer’s time zone: {order.customerTimeZone}. Emails show them their local time.</p>}
  </div>;

  return <div className="admin-order-detail">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/orders`}>ADMIN / ORDERS</Link></p><h1>Order {order.code}</h1><p className="admin-lede"><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span>{order.asap && ['payment_reported', 'paid'].includes(order.status) && <span className="asap-badge">Free now</span>} {formatVnd(order.totalVnd)} · placed {formatDateTime(order.createdAt)}{order.assignedAdmin ? ` · handled by ${order.assignedAdmin}` : ''}</p></div>
      <Link className="button secondary" href={`/${locale}/admin/chat?room=user:${order.customer.id}`}>Open customer chat</Link></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}

    <div className="admin-detail-grid">
      <section className="card admin-panel"><h2>Customer</h2>
        <dl className="account-details"><dt>Name</dt><dd><Link href={`/${locale}/admin/customers/${order.customer.id}`}>{order.customer.name}</Link></dd><dt>Email</dt><dd>{order.customer.email}</dd>{'address' in order.bankSnapshot ? <><dt>Method</dt><dd>Litecoin</dd><dt>Expected</dt><dd><strong>{order.cryptoAmount} LTC</strong>{order.cryptoRateVnd ? ` at ${order.cryptoRateVnd.toLocaleString('vi-VN')} ₫/LTC` : ''}</dd><dt>To wallet</dt><dd>{order.bankSnapshot.label} · <a className="admin-mono" href={explorerAddress(order.bankSnapshot.address)} target="_blank" rel="noreferrer">{order.bankSnapshot.address}</a></dd>{order.paymentSeenAt && <><dt>Seen on chain</dt><dd>{formatDateTime(order.paymentSeenAt)} · {order.txConfirmations ?? 0} confirmation{order.txConfirmations === 1 ? '' : 's'}</dd></>}{order.customerTxid && <><dt>Customer TXID</dt><dd><a className="admin-mono" href={explorerTx(order.customerTxid)} target="_blank" rel="noreferrer">{order.customerTxid.slice(0, 16)}…</a></dd></>}</> : <><dt>Method</dt><dd>Bank transfer</dd><dt>Transfer content</dt><dd><strong>{order.code}</strong></dd><dt>To account</dt><dd>{order.bankSnapshot.bankName} · {order.bankSnapshot.accountNumber}</dd></>}{order.reportedAt && <><dt>Reported transfer</dt><dd>{formatDateTime(order.reportedAt)}</dd></>}{order.paidAt && <><dt>Payment confirmed</dt><dd>{formatVnd(order.paidAmountVnd ?? 0)} · {formatDateTime(order.paidAt)} by {order.paymentConfirmedBy?.startsWith('auto:') ? (order.paymentSource === 'blockchain' ? 'automatic (Litecoin network)' : 'automatic (SePay bank)') : order.paymentConfirmedBy}{order.paymentReference ? ` · ref ${order.paymentReference}` : ''}</dd></>}{order.appointmentStart && order.appointmentEnd && <><dt>Appointment</dt><dd><strong>{formatRange(order.appointmentStart, order.appointmentEnd, VN_TIME_ZONE)}</strong></dd></>}{order.cancelReason && <><dt>Reason</dt><dd>{order.cancelReason}</dd></>}</dl>
      </section>
      <section className="card admin-panel"><h2>Items</h2>
        {order.items.map(item => <div className="admin-order-item" key={item.id}><strong>{item.title} × {item.quantity}</strong><span>{item.sku} · {formatVnd(item.unitPriceVnd * item.quantity)}</span>{Object.entries(item.delivery).filter(([, value]) => value).map(([key, value]) => <small key={key}>{key}: {value}</small>)}</div>)}
        <p className="admin-order-total">Total <strong>{formatVnd(order.totalVnd)}</strong></p>
      </section>
    </div>

    {canConfirm && <section className="card admin-panel action-panel"><h2>Confirm payment{scheduleNow ? ' and book the appointment' : ''}</h2>
      <p className="field-caption">{'address' in order.bankSnapshot ? <>Check that the wallet received exactly <strong>{order.cryptoAmount} LTC</strong> (<a href={order.customerTxid ? explorerTx(order.customerTxid) : explorerAddress(order.bankSnapshot.address)} target="_blank" rel="noreferrer">open in explorer</a>). The order value is recorded as {formatVnd(order.totalVnd)}.</> : <>Check your bank statement for <strong>{formatVnd(order.totalVnd)}</strong> with content <strong>{order.code}</strong>.</>}{order.status === 'expired' ? ' This order expired; confirming re-reserves its items if they are still in stock.' : ''}</p>
      {order.paymentMethod === 'ltc' && <p className="field-caption">The site checks the Litecoin network by itself and confirms at 2 confirmations. <button type="button" className="secondary copy-button" disabled={busy} onClick={() => void act({action: 'check-payment'}, 'Checked the Litecoin network.')}>Check payment now</button></p>}
      <form onSubmit={event => {event.preventDefault(); void act({action: 'confirm-payment', amountVnd: Number(amount), reference, ...(scheduleNow ? {appointment} : {})}, scheduleNow ? 'Payment confirmed and appointment sent to the customer.' : 'Payment confirmed.');}}>
        <div className="admin-field-row"><label>{order.paymentMethod === 'ltc' ? 'Order value received (VND)' : 'Amount received (VND)'}<input type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} required/></label><label>{order.paymentMethod === 'ltc' ? 'Transaction ID (optional)' : 'Bank reference (optional)'}<input value={reference} onChange={event => setReference(event.target.value)} maxLength={120} placeholder={order.paymentMethod === 'ltc' ? '64-character TXID' : 'e.g. FT26273…'}/></label></div>
        {Number(amount) !== order.totalVnd && amount !== '' && <p className="admin-feedback error">This differs from the order total ({formatVnd(order.totalVnd)}). Confirm only if you accept it.</p>}
        <label className="admin-compact-check"><input type="checkbox" checked={scheduleNow} onChange={event => setScheduleNow(event.target.checked)}/> Book the appointment now</label>
        {scheduleNow && timePicker}
        <button type="submit" disabled={busy}>{scheduleNow ? 'Confirm payment & send appointment' : 'Confirm payment'}</button>
      </form>
    </section>}

    {canSchedule && <section className="card admin-panel action-panel"><h2>{order.status === 'scheduled' ? 'Change the appointment' : 'Book the appointment'}</h2>
      <div className="start-now">
        <div><strong>Free right now?</strong><p className="field-caption">{order.asap ? 'The customer said they are free now. ' : ''}Starts the appointment immediately and messages the customer in Chat, Inbox and email.</p></div>
        <label>Length<select value={startMinutes} onChange={event => setStartMinutes(event.target.value)}><option value="30">30 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option><option value="120">2 hours</option></select></label>
        <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Start order ${order.code} now and notify the customer?`)) void act({action: 'start-now', minutes: Number(startMinutes)}, 'Started now; the customer was messaged in Chat.'); }}>Start now</button>
      </div>
      <form onSubmit={event => {event.preventDefault(); void act({action: 'schedule', appointment}, order.status === 'scheduled' ? 'Appointment changed; the customer was notified.' : 'Appointment booked; the customer was notified.');}}>
        {timePicker}
        <button type="submit" disabled={busy}>{order.status === 'scheduled' ? 'Save new time & notify' : 'Book & notify customer'}</button>
      </form>
    </section>}

    {canComplete && <section className="card admin-panel action-panel"><h2>Complete the order</h2>
      <p className="field-caption">Write what the customer receives (codes, links, instructions). Only this customer sees it on their order page; the email does not include it.</p>
      <form onSubmit={event => {event.preventDefault(); if (window.confirm('Mark this order as delivered?')) void act({action: 'complete', deliveryNote: delivery}, 'Order completed; the customer was notified.');}}>
        <label>Delivery details<textarea rows={4} value={delivery} onChange={event => setDelivery(event.target.value)} required maxLength={5000}/></label>
        <button type="submit" disabled={busy}>Complete order</button>
      </form>
    </section>}

    {order.status === 'completed' && order.deliveryNote && <section className="card admin-panel"><h2>Delivered</h2><p className="delivery-note">{order.deliveryNote}</p></section>}

    <div className="admin-detail-grid">
      <section className="card admin-panel"><h2>Timeline</h2><ol className="timeline">{order.events.map(event => <li key={event.id} className={event.action === 'note' ? 'internal' : ''}><strong>{event.action === 'note' ? 'Internal note' : event.action.replace(/_/g, ' ')}</strong><span>{formatDateTime(event.createdAt)} · {event.actor}</span>{event.note && <small>{event.note}</small>}</li>)}</ol>
        <form className="note-form" onSubmit={event => {event.preventDefault(); void act({action: 'note', note}, 'Note added.').then(ok => ok && setNote(''));}}><label>Internal note (customers never see it)<textarea rows={2} value={note} onChange={event => setNote(event.target.value)} maxLength={2000}/></label><button type="submit" className="secondary" disabled={busy || !note.trim()}>Add note</button></form>
      </section>
      <section className="card admin-panel"><h2>Emails</h2>
        {order.emails.length === 0 ? <p className="admin-empty">No emails for this order yet.</p> : <ul className="admin-list">{order.emails.map(mail => <li key={mail.id}><div><strong>{mail.subject}</strong><span>{formatDateTime(mail.createdAt)} · {mail.recipient}</span>{mail.error && <small className="error-text">{mail.error}</small>}</div><span className={`badge ${mail.status === 'sent' ? 'ok' : mail.status === 'failed' ? 'danger' : 'warn'}`}>{mail.status}</span></li>)}</ul>}
        <div className="resend-actions">
          {order.reportedAt && <button type="button" className="secondary" disabled={busy} onClick={() => void act({action: 'resend', kind: 'admin.payment_reported'}, 'Admin email sent again.')}>Resend admin email</button>}
          {order.status === 'scheduled' && <button type="button" className="secondary" disabled={busy} onClick={() => void act({action: 'resend', kind: 'customer.appointment'}, 'Appointment email sent again.')}>Resend appointment</button>}
          {order.status === 'completed' && <button type="button" className="secondary" disabled={busy} onClick={() => void act({action: 'resend', kind: 'customer.completed'}, 'Completion email sent again.')}>Resend completion</button>}
        </div>
      </section>
    </div>

    {canCancel && <section className="card admin-panel admin-danger-zone"><h2>Cancel order</h2><p className="field-caption">Returns the items to stock and notifies the customer. If they already paid, refund them yourself and say so in Chat.</p>
      <form onSubmit={event => {event.preventDefault(); if (window.confirm(`Cancel order ${order.code}?`)) void act({action: 'cancel', reason}, 'Order cancelled; the customer was notified.');}}><label>Reason (sent to the customer)<input value={reason} onChange={event => setReason(event.target.value)} maxLength={500}/></label><button type="submit" className="danger-button" disabled={busy}>Cancel order</button></form>
    </section>}
  </div>;
}
