'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {describeUserAgent, formatDateTime, methodLabels, outcomeLabels, outcomeTone} from '@/lib/customer-labels';

type LoginEvent = {id: string; customerId: string | null; email: string; method: string; outcome: string; ip: string | null; userAgent: string | null; createdAt: string};
type Filters = {q: string; outcome: string; method: string; from: string; to: string};
const emptyFilters: Filters = {q: '', outcome: 'all', method: 'all', from: '', to: ''};

/** Sign-in history with filters. With `customerId` it shows one customer's events only. */
export default function SignInActivity({locale, customerId, reloadKey = 0}: {locale: string; customerId?: string; reloadKey?: number}) {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{events: LoginEvent[]; total: number; pageSize: number} | null>(null);
  const [error, setError] = useState('');

  // Aborting the previous request keeps a slow, older response from replacing newer filter results.
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({...filters, page: String(page), ...(customerId ? {customerId} : {})});
    fetch(`/api/admin/login-events?${params}`, {cache: 'no-store', signal: controller.signal})
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Sign-in activity could not be loaded.'); });
    return () => controller.abort();
  }, [filters, page, customerId, reloadKey]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="admin-activity">
    <form className="admin-filters" onSubmit={event => {event.preventDefault(); setPage(1); setFilters(draft);}}>
      {!customerId && <label>Email or IP<input type="search" value={draft.q} onChange={event => setDraft({...draft, q: event.target.value})} placeholder="name@example.com or 203.0.113"/></label>}
      <label>Result<select value={draft.outcome} onChange={event => setDraft({...draft, outcome: event.target.value})}><option value="all">All results</option><option value="success">Signed in</option><option value="failed">Failed attempts</option><option value="rate_limited">Blocked</option><option value="locked">Locked account</option></select></label>
      <label>Method<select value={draft.method} onChange={event => setDraft({...draft, method: event.target.value})}><option value="all">All methods</option><option value="password">Email + password</option><option value="google">Google</option><option value="register">Registered</option></select></label>
      <label>From<input type="date" value={draft.from} onChange={event => setDraft({...draft, from: event.target.value})}/></label>
      <label>To<input type="date" value={draft.to} onChange={event => setDraft({...draft, to: event.target.value})}/></label>
      <div className="admin-filter-actions"><button type="submit">Apply</button><button type="button" className="secondary" onClick={() => {setDraft(emptyFilters); setFilters(emptyFilters); setPage(1);}}>Reset</button></div>
    </form>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {!data && !error && <p className="muted" role="status">Loading sign-in activity…</p>}
    {data && <>
      <p className="admin-result-count">{data.total} event{data.total === 1 ? '' : 's'} · kept for 90 days</p>
      <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>Time</th>{!customerId && <th>Email</th>}<th>Method</th><th>Result</th><th>IP address</th><th>Device</th></tr></thead>
        <tbody>{data.events.length === 0 ? <tr><td colSpan={customerId ? 5 : 6} className="admin-empty">No sign-in events match these filters.</td></tr> : data.events.map(event => <tr key={event.id}>
          <td>{formatDateTime(event.createdAt)}</td>
          {!customerId && <td>{event.customerId ? <Link href={`/${locale}/admin/customers/${event.customerId}`}>{event.email}</Link> : event.email}</td>}
          <td>{methodLabels[event.method] ?? event.method}</td>
          <td><span className={`badge ${outcomeTone(event.outcome)}`}>{outcomeLabels[event.outcome] ?? event.outcome}</span></td>
          <td className="admin-mono">{event.ip ?? '—'}</td>
          <td title={event.userAgent ?? ''}>{describeUserAgent(event.userAgent)}</td>
        </tr>)}</tbody>
      </table></div>
      {pages > 1 && <div className="admin-pager"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Newer</button><span>Page {page} of {pages}</span><button type="button" className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Older →</button></div>}
    </>}
  </div>;
}
