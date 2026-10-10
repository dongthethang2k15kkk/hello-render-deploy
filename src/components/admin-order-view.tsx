'use client';
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {formatDateTime} from '@/lib/customer-labels';
import {formatVnd} from '@/lib/money';
import {CRYPTO_METHODS, dateToVietnamLocal, explorerAddress, explorerTx, formatRange, isCrypto, paymentKind, statusLabels, statusTone, VN_TIME_ZONE, type BankSnapshot, type OrderStatus, type PaymentMethod, type PaymentSnapshot, type PaypalSnapshot, type WalletSnapshot} from '@/lib/order-rules';
import {LoadingRows} from '@/components/loading-state';
import {formatCoins} from '@/lib/coin-format';
import {coinsFromOrderItems} from '@/lib/coin-rules';

export type AdminOrder = {
  id: string; code: string; status: OrderStatus; totalVnd: number; createdAt: string; holdExpiresAt: string; reportedAt: string | null; customerTimeZone: string | null;
  paidAt: string | null; paidAmountVnd: number | null; paymentReference: string | null; paymentConfirmedBy: string | null; assignedAdmin: string | null;
  appointmentStart: string | null; appointmentEnd: string | null; deliveryNote: string | null; cancelReason: string | null;
  paymentMethod: PaymentMethod; cryptoAmount: string | null; cryptoRateVnd: number | null; customerTxid: string | null;
  asap: boolean; paymentSource: string | null; paymentSeenAt: string | null; txConfirmations: number | null;
  redeemWheelCoins: boolean; wheelCoins: string; wheelCoinsReleasedAt: string | null;
  bankSnapshot: PaymentSnapshot;
  customer: {id: string; name: string; email: string; status: string; discordUsername?: string | null};
  items: {id: string; title: string; sku: string; unitPriceVnd: number; quantity: number; delivery: Record<string, string>}[];
  slots: {id: string; startsAt: string; endsAt: string}[];
  events: {id: string; actor: string; action: string; note: string | null; createdAt: string}[];
  emails: {id: string; recipient: string; subject: string; kind: string; status: string; error: string | null; createdAt: string}[];
};

const plusMinutes = (local: string, minutes: number) => dateToVietnamLocal(new Date(new Date(`${local}:00+07:00`).getTime() + minutes * 60_000));

/**
 * One order with everything an Admin does to it. Used on its own page and in the workspace next to the customer's chat.
 * The Admin who takes ("claims") the order handles it; others see who does and can take it over.
 */
export default function AdminOrderView({locale, id, variant = 'page', onLoaded}: {locale: string; id: string; variant?: 'page' | 'workspace'; onLoaded?: (order: AdminOrder) => void}) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [me, setMe] = useState('');
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

  const adopt = useCallback((next: AdminOrder) => {
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
    adopt(body.order); if (body.me) setMe(body.me); onLoaded?.(body.order);
  }, [id, adopt, onLoaded]);
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
      setOrder(data.order); if (data.me) setMe(data.me); setMessage(success);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); return false; }
    finally { setBusy(false); }
  }

  const backHref = variant === 'workspace' ? `/${locale}/admin/workspace` : `/${locale}/admin/orders`;
  if (!order) return <div className="page-heading"><Link href={backHref}>← {variant === 'workspace' ? 'Workspace' : 'Orders'}</Link>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <LoadingRows label="Loading order…"/>}</div>;
  // Another Admin handles this order: show who, and offer to take it over instead of the actions.
  const otherHandler = order.assignedAdmin && me && order.assignedAdmin !== me ? order.assignedAdmin : null;
  const open = ['awaiting_payment', 'payment_reported', 'paid', 'scheduled'].includes(order.status);
  const crypto = isCrypto(order.paymentMethod) ? CRYPTO_METHODS[order.paymentMethod] : null;
  const packageCoins = coinsFromOrderItems(order.items);
  const wheelCoins = /^\d+$/.test(order.wheelCoins) ? BigInt(order.wheelCoins) : BigInt(0);
  const deliveryCoins = packageCoins + wheelCoins;
  const coin = crypto?.coin ?? 'LTC';
  const kind = paymentKind(order);
  // Which snapshot applies follows from the payment method, not from the snapshot's shape.
  const wallet = order.bankSnapshot as WalletSnapshot; const paypal = order.bankSnapshot as PaypalSnapshot; const bank = order.bankSnapshot as BankSnapshot;
  const canConfirm = !otherHandler && ['awaiting_payment', 'payment_reported', 'expired'].includes(order.status);
  const canSchedule = !otherHandler && (order.status === 'paid' || order.status === 'scheduled');
  const canComplete = !otherHandler && (order.status === 'paid' || order.status === 'scheduled');
  const canCancel = !otherHandler && open;
  const appointment = {start, end};
  const timePicker = <div className="appointment-picker">
    {order.slots.length > 0 && <div className="slot-choices"><span className="field-caption">Customer’s free times (Vietnam time) — click to use:</span>{order.slots.map(slot => <button type="button" key={slot.id} className="secondary slot-choice" onClick={() => { const s = dateToVietnamLocal(new Date(slot.startsAt)); setStart(s); setEnd(dateToVietnamLocal(new Date(Math.min(Date.parse(slot.startsAt) + 60 * 60_000, Date.parse(slot.endsAt))))); }}>{formatRange(slot.startsAt, slot.endsAt, VN_TIME_ZONE)}</button>)}</div>}
    <div className="admin-field-row"><label>Start (Vietnam time)<input type="datetime-local" value={start} onChange={event => { setStart(event.target.value); if (!end || end <= event.target.value) setEnd(plusMinutes(event.target.value, 60)); }} required/></label><label>End<input type="datetime-local" value={end} onChange={event => setEnd(event.target.value)} required/></label></div>
    {order.customerTimeZone && order.customerTimeZone !== VN_TIME_ZONE && <p className="field-caption">Customer’s time zone: {order.customerTimeZone}. Emails show them their local time.</p>}
  </div>;

  return <div className="admin-order-detail">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={backHref}>{variant === 'workspace' ? 'ADMIN / WORKSPACE' : 'ADMIN / ORDERS'}</Link></p><h1>Order {order.code}</h1><p className="admin-lede"><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span>{order.asap && ['payment_reported', 'paid'].includes(order.status) && <span className="asap-badge">Free now</span>} {formatVnd(order.totalVnd)} · placed {formatDateTime(order.createdAt)}{order.assignedAdmin ? ` · handled by ${order.assignedAdmin}` : ''}</p></div>
      {variant === 'page' && <Link className="button secondary" href={`/${locale}/admin/workspace/${order.id}`}>Open in workspace</Link>}</div>
    {open && <div className={`claim-bar ${!order.assignedAdmin ? 'unclaimed' : otherHandler ? 'other' : 'mine'}`} role="status">
      {!order.assignedAdmin ? <><span><strong>Nobody has taken this order yet.</strong> The Admin who takes it handles the chat, the payment and the delivery.</span><button type="button" disabled={busy} onClick={() => void act({action: 'claim'}, 'You are handling this order.')}>Take this order</button></>
        : otherHandler ? <><span><strong>{otherHandler}</strong> is handling this order.</span><button type="button" className="secondary" disabled={busy} onClick={() => { if (window.confirm(`Take order ${order.code} over from ${otherHandler}? This is recorded in Activity.`)) void act({action: 'take-over'}, 'You took over this order.'); }}>Take over</button></>
        : <><span><strong>You are handling this order.</strong> Other Admins see it as yours.</span><button type="button" className="secondary" disabled={busy} onClick={() => { if (window.confirm(`Release order ${order.code} so another Admin can take it?`)) void act({action: 'release'}, 'Order released for another Admin.'); }}>Release</button></>}
    </div>}
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}

    <div className="admin-detail-grid">
      <section className="card admin-panel"><h2>Customer</h2>
        <dl className="account-details"><dt>Name</dt><dd><Link href={`/${locale}/admin/customers/${order.customer.id}`}>{order.customer.name}</Link></dd><dt>Email</dt><dd>{order.customer.email}</dd>{order.customer.discordUsername && <><dt>Discord</dt><dd>@{order.customer.discordUsername}</dd></>}{kind === 'crypto' ? <><dt>Method</dt><dd>{crypto ? `${crypto.coin} · ${crypto.network}` : 'Crypto'}</dd><dt>Expected</dt><dd><strong>{order.cryptoAmount} {coin}</strong>{order.cryptoRateVnd ? ` at ${order.cryptoRateVnd.toLocaleString('vi-VN')} ₫/${coin}` : ''}</dd><dt>To wallet</dt><dd>{wallet.label} · <a className="admin-mono" href={explorerAddress(order.paymentMethod, wallet.address)} target="_blank" rel="noreferrer">{wallet.address}</a></dd>{order.paymentSeenAt && <><dt>Seen on chain</dt><dd>{formatDateTime(order.paymentSeenAt)}{order.paymentMethod === 'ltc' ? ` · ${order.txConfirmations ?? 0} confirmation${order.txConfirmations === 1 ? '' : 's'}` : ''}</dd></>}{order.customerTxid && <><dt>Customer TXID</dt><dd><a className="admin-mono" href={explorerTx(order.paymentMethod, order.customerTxid)} target="_blank" rel="noreferrer">{order.customerTxid.slice(0, 16)}…</a></dd></>}</> : kind === 'paypal' ? <><dt>Method</dt><dd>PayPal</dd><dt>Expected</dt><dd><strong>{order.cryptoAmount} USD</strong> to <a href={`https://paypal.me/${paypal.paypalMe}`} target="_blank" rel="noreferrer">paypal.me/{paypal.paypalMe}</a></dd><dt>Note</dt><dd><strong>{order.code}</strong></dd>{order.customerTxid && <><dt>Customer PayPal ID</dt><dd className="admin-mono">{order.customerTxid}</dd></>}</> : <><dt>Method</dt><dd>Bank transfer</dd><dt>Transfer content</dt><dd><strong>{order.code}</strong></dd><dt>To account</dt><dd>{bank.bankName} · {bank.accountNumber}</dd></>}{order.reportedAt && <><dt>Reported transfer</dt><dd>{formatDateTime(order.reportedAt)}</dd></>}{order.paidAt && <><dt>Payment confirmed</dt><dd>{formatVnd(order.paidAmountVnd ?? 0)} · {formatDateTime(order.paidAt)} by {order.paymentConfirmedBy?.startsWith('auto:') ? `automatic (${crypto?.network ?? 'blockchain'})` : order.paymentConfirmedBy}{order.paymentReference ? ` · ref ${order.paymentReference}` : ''}</dd></>}{order.appointmentStart && order.appointmentEnd && <><dt>Appointment</dt><dd><strong>{formatRange(order.appointmentStart, order.appointmentEnd, VN_TIME_ZONE)}</strong></dd></>}{order.cancelReason && <><dt>Reason</dt><dd>{order.cancelReason}</dd></>}</dl>
      </section>
      <section className="card admin-panel"><h2>Items</h2>
        {order.items.map(item => <div className="admin-order-item" key={item.id}><strong>{item.title} × {item.quantity}</strong><span>{item.sku} · {formatVnd(item.unitPriceVnd * item.quantity)}</span>{Object.entries(item.delivery).filter(([, value]) => value).map(([key, value]) => <small key={key}>{key}: {value}</small>)}</div>)}
        {order.redeemWheelCoins && <div className={`admin-coin-calculation ${wheelCoins > BigInt(0) ? '' : 'released'}`}><strong>{wheelCoins > BigInt(0) ? 'Add wheel winnings to delivery' : 'Wheel winnings are not reserved'}</strong>{wheelCoins > BigInt(0) ? <><span>Package amount: {formatCoins(packageCoins)}</span><span>Wheel balance: + {formatCoins(wheelCoins)}</span><b>Admin delivers: {formatCoins(deliveryCoins)}</b></> : <span>{order.wheelCoinsReleasedAt ? 'The reserved balance was returned when this order ended.' : 'The customer selected the option with an empty balance.'}</span>}</div>}
        <p className="admin-order-total">Total <strong>{formatVnd(order.totalVnd)}</strong></p>
      </section>
    </div>

    {canConfirm && <section className="card admin-panel action-panel"><h2>Confirm payment{scheduleNow ? ' and book the appointment' : ''}</h2>
      <p className="field-caption">{kind === 'crypto' ? <>Check that the wallet received exactly <strong>{order.cryptoAmount} {coin}</strong> (<a href={order.customerTxid ? explorerTx(order.paymentMethod, order.customerTxid) : explorerAddress(order.paymentMethod, wallet.address)} target="_blank" rel="noreferrer">open in explorer</a>). The order value is recorded as {formatVnd(order.totalVnd)}.</> : kind === 'paypal' ? <>Check PayPal for exactly <strong>{order.cryptoAmount} USD</strong> with note <strong>{order.code}</strong>. The order value is recorded as {formatVnd(order.totalVnd)}; PayPal does not confirm by itself.</> : <>Check your bank statement for <strong>{formatVnd(order.totalVnd)}</strong> with content <strong>{order.code}</strong>.</>}{order.status === 'expired' ? ' This order expired; confirming re-reserves its items if they are still in stock.' : ''}</p>
      {crypto && <p className="field-caption">The site checks the {crypto.network} network by itself and confirms {order.paymentMethod === 'ltc' ? 'at 2 confirmations' : 'once the transfer is final (about a minute)'}. <button type="button" className="secondary copy-button" disabled={busy} onClick={() => void act({action: 'check-payment'}, `Checked the ${crypto.network} network.`)}>Check payment now</button></p>}
      <form onSubmit={event => {event.preventDefault(); void act({action: 'confirm-payment', amountVnd: Number(amount), reference, ...(scheduleNow ? {appointment} : {})}, scheduleNow ? 'Payment confirmed and appointment sent to the customer.' : 'Payment confirmed.');}}>
        <div className="admin-field-row"><label>{crypto || kind === 'paypal' ? 'Order value received (VND)' : 'Amount received (VND)'}<input type="number" min="1" step="1" value={amount} onChange={event => setAmount(event.target.value)} required/></label><label>{crypto ? 'Transaction ID (optional)' : kind === 'paypal' ? 'PayPal transaction ID (optional)' : 'Bank reference (optional)'}<input value={reference} onChange={event => setReference(event.target.value)} maxLength={120} placeholder={crypto ? '64-character TXID' : kind === 'paypal' ? '17-character ID' : 'e.g. FT26273…'}/></label></div>
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

    {canComplete && <section className="card admin-panel action-panel complete-panel"><h2>Complete the transaction</h2>
      <p className="field-caption">Press this once the customer has everything.{wheelCoins > BigInt(0) ? ` This delivery includes ${formatCoins(wheelCoins)} from the wheel, for ${formatCoins(deliveryCoins)} total coins.` : ''} Only then does the site record the sale and the money received (Overview revenue). Write what the customer receives (codes, links, instructions): only this customer sees it on their order page; the email does not include it.</p>
      <form onSubmit={event => {event.preventDefault(); if (window.confirm('Complete this transaction? The sale is recorded and the customer is told the order is delivered.')) void act({action: 'complete', deliveryNote: delivery}, 'Transaction completed and recorded; the customer was notified.');}}>
        <label>Delivery details<textarea rows={4} value={delivery} onChange={event => setDelivery(event.target.value)} required maxLength={5000}/></label>
        <button type="submit" disabled={busy}>Complete transaction</button>
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
