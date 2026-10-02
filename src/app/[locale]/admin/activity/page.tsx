'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {formatDateTime} from '@/lib/customer-labels';
import {LoadingRows} from '@/components/loading-state';

type Entry = {id: string; actorEmail: string; action: string; summary: string; entityType: string | null; entityId: string | null; customerId: string | null; createdAt: string};
type Filters = {q: string; type: string; actor: string; from: string; to: string};
const emptyFilters: Filters = {q: '', type: 'all', actor: '', from: '', to: ''};
const typeLabels: Record<string, string> = {order: 'Order', customer: 'Customer', product: 'Product', settings: 'Settings', email: 'Email'};

function entityLink(locale: string, entry: Entry) {
  if (entry.entityType === 'order' && entry.entityId) return `/${locale}/admin/orders/${entry.entityId}`;
  if (entry.entityType === 'customer' && entry.customerId) return `/${locale}/admin/customers/${entry.customerId}`;
  if (entry.entityType === 'product') return `/${locale}/admin/settings/products`;
  if (entry.entityType === 'settings') return `/${locale}/admin/settings/payments`;
  if (entry.entityType === 'email') return `/${locale}/admin/settings/email`;
  return null;
}

export default function AdminActivity() {
  const locale = useLocale();
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{entries: Entry[]; total: number; pageSize: number; actors: string[]} | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/activity?${new URLSearchParams({...filters, page: String(page)})}`, {cache: 'no-store', signal: controller.signal})
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Activity could not be loaded.'); });
    return () => controller.abort();
  }, [filters, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="admin-activity-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow">ADMIN / ACTIVITY</p><h1>Activity</h1><p className="admin-lede">Every change made by an Admin: orders, payments, customers, products and settings.</p></div></div>
    <section className="card admin-panel">
      <form className="admin-filters" onSubmit={event => {event.preventDefault(); setPage(1); setFilters(draft);}}>
        <label>Search<input type="search" value={draft.q} onChange={event => setDraft({...draft, q: event.target.value})} placeholder="Order code, product, amount…"/></label>
        <label>Type<select value={draft.type} onChange={event => setDraft({...draft, type: event.target.value})}><option value="all">All</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Admin<select value={draft.actor} onChange={event => setDraft({...draft, actor: event.target.value})}><option value="">Everyone</option>{data?.actors.map(actor => <option key={actor} value={actor}>{actor}</option>)}</select></label>
        <label>From<input type="date" value={draft.from} onChange={event => setDraft({...draft, from: event.target.value})}/></label>
        <label>To<input type="date" value={draft.to} onChange={event => setDraft({...draft, to: event.target.value})}/></label>
        <div className="admin-filter-actions"><button type="submit">Apply</button><button type="button" className="secondary" onClick={() => {setDraft(emptyFilters); setFilters(emptyFilters); setPage(1);}}>Reset</button></div>
      </form>
      {error && <p className="admin-feedback error" role="alert">{error}</p>}
      {!data && !error && <LoadingRows label="Loading activity…"/>}
      {data && <>
        <p className="admin-result-count">{data.total} action{data.total === 1 ? '' : 's'}</p>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Time</th><th>Admin</th><th>Type</th><th>What happened</th></tr></thead>
          <tbody>{data.entries.length === 0 ? <tr><td colSpan={4} className="admin-empty">No actions match these filters.</td></tr> : data.entries.map(entry => {
            const link = entityLink(locale, entry);
            return <tr key={entry.id}><td>{formatDateTime(entry.createdAt)}</td><td>{entry.actorEmail}</td><td><span className="badge">{typeLabels[entry.entityType ?? ''] ?? 'Other'}</span></td><td>{link ? <Link href={link}>{entry.summary}</Link> : entry.summary}</td></tr>;
          })}</tbody>
        </table></div>
        {pages > 1 && <div className="admin-pager"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button><span>Page {page} of {pages}</span><button type="button" className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older →</button></div>}
      </>}
    </section>
  </div>;
}
