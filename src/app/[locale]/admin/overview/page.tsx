'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {formatVnd} from '@/lib/money';
import {formatRange, VN_TIME_ZONE} from '@/lib/order-rules';

type Revenue = {vnd: number; orders: number};
type Overview = {
  needsAction: {paymentReported: number; paid: number; awaitingPayment: number};
  upcoming: {id: string; code: string; appointmentStart: string; appointmentEnd: string; assignedAdmin: string | null; customer: {name: string}}[];
  revenue: {today: Revenue; week: Revenue; month: Revenue};
  customers: {active: number; newThisWeek: number};
  lowStock: {id: string; sku: string; stock: number; title: string}[];
  databaseBytes: number; emailFailures: number;
  mail: {email: string} | null;
  setup: {bankAccounts: number; gmail: boolean; vndPerUsd: number};
};

export default function AdminOverview() {
  const locale = useLocale();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/admin/overview', {cache: 'no-store'}).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'The overview could not be loaded.'));
  }, []);

  return <div className="admin-overview">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow">ADMIN / OVERVIEW</p><h1>Overview</h1><p className="admin-lede">What needs attention today. Times are Vietnam time.</p></div></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {!data && !error && <p className="muted" role="status">Loading…</p>}
    {data && <>
      {(!data.setup.bankAccounts || !data.setup.gmail) && <section className="card admin-panel setup-panel"><h2>Finish setting up</h2><ul>
        {!data.setup.bankAccounts && <li>No active bank account: customers cannot place orders. <Link href={`/${locale}/admin/settings/payments`}>Add one →</Link></li>}
        {!data.setup.gmail && <li>Gmail is not connected: nobody receives order emails (Inbox messages still work). <Link href={`/${locale}/admin/settings/email`}>Connect Gmail →</Link></li>}
      </ul></section>}
      <div className="stat-grid">
        <Link className="card stat-card warn" href={`/${locale}/admin/orders?status=payment_reported`}><span>Payments to confirm</span><strong>{data.needsAction.paymentReported}</strong><small>Customers reported a transfer</small></Link>
        <Link className="card stat-card info" href={`/${locale}/admin/orders?status=paid`}><span>Paid, need a time</span><strong>{data.needsAction.paid}</strong><small>Book an appointment</small></Link>
        <Link className="card stat-card" href={`/${locale}/admin/orders?status=awaiting_payment`}><span>Awaiting payment</span><strong>{data.needsAction.awaitingPayment}</strong><small>Within the 30-minute hold</small></Link>
        <Link className="card stat-card" href={`/${locale}/admin/customers`}><span>Customers</span><strong>{data.customers.active}</strong><small>{data.customers.newThisWeek} new in 7 days</small></Link>
      </div>
      <div className="admin-detail-grid">
        <section className="card admin-panel"><h2>Upcoming appointments</h2>
          {data.upcoming.length === 0 ? <p className="admin-empty">No upcoming appointments.</p> : <ul className="admin-list">{data.upcoming.map(item => <li key={item.id}><Link href={`/${locale}/admin/orders/${item.id}`}><strong>{formatRange(item.appointmentStart, item.appointmentEnd, VN_TIME_ZONE)}</strong><span>{item.customer.name} · {item.code}{item.assignedAdmin ? ` · ${item.assignedAdmin}` : ''}</span></Link></li>)}</ul>}
        </section>
        <section className="card admin-panel"><h2>Revenue (confirmed payments)</h2>
          <dl className="revenue-list">{([['Today', data.revenue.today], ['Last 7 days', data.revenue.week], ['Last 30 days', data.revenue.month]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd><strong>{formatVnd(value.vnd)}</strong><small>{value.orders} order{value.orders === 1 ? '' : 's'}</small></dd></div>)}</dl>
        </section>
        <section className="card admin-panel"><h2>Low stock</h2>
          {data.lowStock.length === 0 ? <p className="admin-empty">All visible packages have more than 3 in stock.</p> : <ul className="admin-list">{data.lowStock.map(item => <li key={item.id}><Link href={`/${locale}/admin/settings/products`}><strong>{item.title}</strong><span>{item.sku} · {item.stock} left</span></Link></li>)}</ul>}
        </section>
        <section className="card admin-panel"><h2>System</h2>
          <dl className="account-details"><dt>Database size</dt><dd>{(data.databaseBytes / 1024 / 1024).toFixed(1)} MB</dd><dt>Gmail sender</dt><dd>{data.mail ? data.mail.email : 'Not connected'}</dd><dt>Email failures (7 days)</dt><dd>{data.emailFailures}</dd><dt>Display rate</dt><dd>{data.setup.vndPerUsd.toLocaleString('vi-VN')} VND/USD</dd></dl>
          <p className="field-caption">Neon Free has a storage limit; check it at console.neon.tech if the database grows.</p>
        </section>
      </div>
    </>}
  </div>;
}
