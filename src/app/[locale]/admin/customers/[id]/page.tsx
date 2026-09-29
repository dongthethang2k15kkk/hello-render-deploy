'use client';
import {use, useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import SignInActivity from '@/components/admin-sign-in-activity';
import {describeUserAgent, formatDateTime, generatePassword} from '@/lib/customer-labels';
import {formatVnd} from '@/lib/money';
import {statusLabels, statusTone, type OrderStatus} from '@/lib/order-rules';

type Detail = {
  customer: {id: string; email: string; name: string; emailVerified: boolean; status: string; lockedReason: string | null; mustChangePassword: boolean; createdAt: string; lastLoginAt: string | null; methods: string[]; chatMessages: number};
  sessions: {id: string; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; expiresAt: string}[];
  audit: {id: string; actorEmail: string; action: string; summary: string; createdAt: string}[];
  orders: {id: string; code: string; status: OrderStatus; totalVnd: number; createdAt: string}[];
};

export default function AdminCustomerDetail({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = use(params);
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState('');
  const [requireChange, setRequireChange] = useState(true);
  const [lockReason, setLockReason] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/customers/${id}`, {cache: 'no-store'});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setDetail(body); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Customer could not be loaded.'); }
  }, [id]);
  useEffect(() => {void load();}, [load]);

  async function act(body: Record<string, unknown>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/admin/customers/${id}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.deleted) {router.push(`/${locale}/admin/customers`); return true;}
      setDetail({customer: data.customer, sessions: data.sessions, audit: data.audit, orders: data.orders}); setMessage(data.anonymized ? 'This customer has orders, so the account was anonymised: personal data, chat and sign-in history were deleted; orders are kept.' : success); setReloadKey(key => key + 1);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.'); return false; }
    finally { setBusy(false); }
  }

  if (!detail) return <div className="page-heading"><Link href={`/${locale}/admin/customers`}>← Customers</Link>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <p className="muted" role="status">Loading customer…</p>}</div>;
  const {customer, sessions, audit, orders} = detail;
  const locked = customer.status === 'locked';
  return <div className="admin-customer-detail">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/customers`}>ADMIN / CUSTOMERS</Link></p><h1>{customer.name}</h1><p className="admin-lede">{customer.email} {customer.emailVerified ? <span className="badge ok">verified by Google</span> : <span className="badge warn">email not verified</span>} <span className={`badge ${locked ? 'danger' : 'ok'}`}>{locked ? 'Locked' : 'Active'}</span></p></div><Link className="button secondary" href={`/${locale}/admin/chat?room=user:${customer.id}`}>Open chat ({customer.chatMessages})</Link></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}

    <div className="admin-detail-grid">
      <section className="card admin-panel"><h2>Profile</h2>
        <dl className="account-details"><dt>Joined</dt><dd>{formatDateTime(customer.createdAt)}</dd><dt>Last sign-in</dt><dd>{formatDateTime(customer.lastLoginAt)}</dd><dt>Sign-in methods</dt><dd>{customer.methods.map(method => method === 'google' ? 'Google' : 'Email + password').join(' · ') || 'None'}</dd><dt>Password</dt><dd>{customer.methods.includes('password') ? (customer.mustChangePassword ? 'Set by Admin, must be changed at next sign-in' : 'Set by the customer') : 'No password (Google only)'}</dd>{locked && <><dt>Lock reason</dt><dd>{customer.lockedReason || '—'}</dd></>}</dl>
      </section>

      <section className="card admin-panel"><h2>Set a new password</h2>
        <p className="field-caption">For a customer who forgot their password. First confirm on Zalo that the person owns <strong>{customer.email}</strong>. The customer’s current password stops working and all their devices are signed out.</p>
        <form onSubmit={event => {event.preventDefault(); void act({action: 'set-password', password, requireChange}, 'Password set. Send it to the customer on Zalo now; it is not stored anywhere readable and disappears when you leave this page.');}}>
          <label>New password<span className="password-field"><input className="admin-mono" value={password} onChange={event => setPassword(event.target.value)} minLength={8} maxLength={128} required autoComplete="off"/><button type="button" className="secondary" onClick={() => setPassword(generatePassword())}>Generate</button></span></label>
          <label className="admin-compact-check"><input type="checkbox" checked={requireChange} onChange={event => setRequireChange(event.target.checked)}/> Customer must choose a new password at next sign-in</label>
          <button type="submit" disabled={busy || password.length < 8}>Set password</button>
        </form>
      </section>

      <section className="card admin-panel"><h2>Access</h2>
        {locked ? <><p className="field-caption">The customer cannot sign in until unlocked.</p><button type="button" disabled={busy} onClick={() => void act({action: 'unlock'}, 'Account unlocked.')}>Unlock account</button></>
          : <form onSubmit={event => {event.preventDefault(); void act({action: 'lock', reason: lockReason}, 'Account locked and signed out everywhere.');}}><label>Reason (visible to Admin only)<input value={lockReason} onChange={event => setLockReason(event.target.value)} maxLength={200} placeholder="e.g. suspected fraud"/></label><button type="submit" className="danger-button" disabled={busy}>Lock account</button></form>}
        <hr/>
        <p className="field-caption">Ends every active session, e.g. after a lost phone.</p>
        <button type="button" className="secondary" disabled={busy || sessions.length === 0} onClick={() => void act({action: 'sign-out-everywhere'}, 'Signed out of all devices.')}>Sign out everywhere</button>
      </section>
    </div>

    <section className="card admin-panel"><h2>Orders ({orders.length})</h2>
      {orders.length === 0 ? <p className="admin-empty">No orders yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td><Link href={`/${locale}/admin/orders/${order.id}`}>{order.code}</Link></td><td><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span></td><td>{formatVnd(order.totalVnd)}</td><td>{formatDateTime(order.createdAt)}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="card admin-panel"><h2>Signed-in devices ({sessions.length})</h2>
      {sessions.length === 0 ? <p className="admin-empty">No active sessions.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Device</th><th>IP address</th><th>Signed in</th><th>Last active</th><th>Expires</th></tr></thead><tbody>{sessions.map(session => <tr key={session.id}><td title={session.userAgent ?? ''}>{describeUserAgent(session.userAgent)}</td><td className="admin-mono">{session.ip ?? '—'}</td><td>{formatDateTime(session.createdAt)}</td><td>{formatDateTime(session.lastSeenAt)}</td><td>{formatDateTime(session.expiresAt)}</td></tr>)}</tbody></table></div>}
    </section>

    <section className="card admin-panel"><h2>Sign-in history</h2><SignInActivity locale={locale} customerId={customer.id} reloadKey={reloadKey}/></section>

    <section className="card admin-panel"><h2>Admin actions</h2>
      {audit.length === 0 ? <p className="admin-empty">No Admin actions yet.</p> : <ul className="admin-audit">{audit.map(item => <li key={item.id}><span>{formatDateTime(item.createdAt)}</span><strong>{item.summary}</strong><small>by {item.actorEmail}</small></li>)}</ul>}
    </section>

    <section className="card admin-panel admin-danger-zone"><h2>Delete account</h2>
      <p className="field-caption">Only when the customer asks. Deletes the account, sessions, chat (including images) and sign-in history. Customers with orders are anonymised instead so order records stay. This cannot be undone.</p>
      <form onSubmit={event => {event.preventDefault(); if (window.confirm(`Delete ${customer.email} permanently?`)) void act({action: 'delete', confirmEmail}, 'Deleted.');}}>
        <label>Type the customer’s email to confirm<input value={confirmEmail} onChange={event => setConfirmEmail(event.target.value)} placeholder={customer.email} autoComplete="off"/></label>
        <button type="submit" className="danger-button" disabled={busy || confirmEmail.trim().toLowerCase() !== customer.email}>Delete account</button>
      </form>
    </section>
  </div>;
}
