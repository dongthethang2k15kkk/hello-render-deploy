'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {formatDateTime} from '@/lib/customer-labels';
import {formatVnd} from '@/lib/money';
import {ORDER_STATUSES, statusLabels, statusTone, type OrderStatus} from '@/lib/order-rules';

type Row = {id: string; code: string; status: OrderStatus; totalVnd: number; createdAt: string; reportedAt: string | null; appointmentStart: string | null; assignedAdmin: string | null; customer: {id: string; name: string; email: string}; items: {title: string; quantity: number}[]};
type Filters = {q: string; status: string; from: string; to: string};
const emptyFilters: Filters = {q: '', status: 'needs-action', from: '', to: ''};

export default function AdminOrders() {
  const locale = useLocale();
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{orders: Row[]; total: number; pageSize: number; needsAction: number} | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    const initial = {...emptyFilters, status: status && ['all', 'needs-action', ...ORDER_STATUSES].includes(status) ? status : 'needs-action'};
    setDraft(initial); setFilters(initial);
  }, []);

  useEffect(() => {
    if (!filters) return;
    const controller = new AbortController();
    fetch(`/api/admin/orders?${new URLSearchParams({...filters, page: String(page)})}`, {cache: 'no-store', signal: controller.signal})
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Orders could not be loaded.'); });
    return () => controller.abort();
  }, [filters, page]);

  function apply(next: Filters) { setPage(1); setDraft(next); setFilters(next); window.history.replaceState(null, '', `?status=${next.status}`); }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="admin-orders-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow">ADMIN / ORDERS</p><h1>Orders</h1><p className="admin-lede">Confirm transfers against your bank statement, book appointments and complete deliveries.</p></div></div>
    <div className="admin-tabs" role="tablist" aria-label="Order views">
      <button type="button" role="tab" aria-selected={filters?.status === 'needs-action'} className={filters?.status === 'needs-action' ? 'active' : ''} onClick={() => apply({...draft, status: 'needs-action'})}>Needs action{data ? ` (${data.needsAction})` : ''}</button>
      <button type="button" role="tab" aria-selected={filters?.status === 'all'} className={filters?.status === 'all' ? 'active' : ''} onClick={() => apply({...draft, status: 'all'})}>All orders</button>
    </div>
    <section className="card admin-panel">
      <form className="admin-filters" onSubmit={event => {event.preventDefault(); apply(draft);}}>
        <label>Search<input type="search" value={draft.q} onChange={event => setDraft({...draft, q: event.target.value})} placeholder="Order code, name or email"/></label>
        <label>Status<select value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="needs-action">Needs action</option><option value="all">All</option>{ORDER_STATUSES.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        <label>Placed from<input type="date" value={draft.from} onChange={event => setDraft({...draft, from: event.target.value})}/></label>
        <label>Placed to<input type="date" value={draft.to} onChange={event => setDraft({...draft, to: event.target.value})}/></label>
        <div className="admin-filter-actions"><button type="submit">Apply</button><button type="button" className="secondary" onClick={() => apply({...emptyFilters, status: 'all'})}>Reset</button></div>
      </form>
      {error && <p className="admin-feedback error" role="alert">{error}</p>}
      {!data && !error && <p className="muted" role="status">Loading orders…</p>}
      {data && <>
        <p className="admin-result-count">{data.total} order{data.total === 1 ? '' : 's'}</p>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Placed</th><th>Appointment</th></tr></thead>
          <tbody>{data.orders.length === 0 ? <tr><td colSpan={6} className="admin-empty">No orders match these filters.</td></tr> : data.orders.map(order => <tr key={order.id}>
            <td><Link className="admin-customer-link" href={`/${locale}/admin/orders/${order.id}`}><strong>{order.code}</strong><span>{order.items.map(item => `${item.title} × ${item.quantity}`).join(', ')}</span></Link></td>
            <td><Link className="admin-customer-link" href={`/${locale}/admin/customers/${order.customer.id}`}><strong>{order.customer.name}</strong><span>{order.customer.email}</span></Link></td>
            <td>{formatVnd(order.totalVnd)}</td>
            <td><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span></td>
            <td>{formatDateTime(order.createdAt)}</td>
            <td>{order.appointmentStart ? formatDateTime(order.appointmentStart) : '—'}{order.assignedAdmin && <small className="admin-subtle"> · {order.assignedAdmin}</small>}</td>
          </tr>)}</tbody>
        </table></div>
        {pages > 1 && <div className="admin-pager"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button><span>Page {page} of {pages}</span><button type="button" className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older →</button></div>}
      </>}
    </section>
  </div>;
}
