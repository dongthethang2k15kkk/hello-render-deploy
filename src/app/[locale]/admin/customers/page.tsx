'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import SignInActivity from '@/components/admin-sign-in-activity';
import {formatDateTime} from '@/lib/customer-labels';
import {LoadingRows} from '@/components/loading-state';

type Customer = {id: string; email: string; name: string; emailVerified: boolean; status: string; createdAt: string; lastLoginAt: string | null; methods: string[]};
type Filters = {q: string; status: string; method: string; from: string; to: string};
const emptyFilters: Filters = {q: '', status: 'all', method: 'all', from: '', to: ''};

export default function AdminCustomers() {
  const locale = useLocale();
  const [tab, setTab] = useState<'customers' | 'activity'>('customers');
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{customers: Customer[]; total: number; pageSize: number} | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {if (new URLSearchParams(window.location.search).get('tab') === 'activity') setTab('activity');}, []);
  function selectTab(next: 'customers' | 'activity') {
    setTab(next);
    window.history.replaceState(null, '', next === 'activity' ? '?tab=activity' : window.location.pathname);
  }

  // Aborting the previous request keeps a slow, older response from replacing newer filter results.
  useEffect(() => {
    if (tab !== 'customers') return;
    const controller = new AbortController();
    fetch(`/api/admin/customers?${new URLSearchParams({...filters, page: String(page)})}`, {cache: 'no-store', signal: controller.signal})
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setError(''); })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Customers could not be loaded.'); });
    return () => controller.abort();
  }, [filters, page, tab]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return <div className="admin-customers-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow">ADMIN / CUSTOMERS</p><h1>Customers</h1><p className="admin-lede">Accounts and sign-in activity. Passwords are never shown; use a customer’s page to set a new one.</p></div></div>
    <div className="admin-tabs" role="tablist" aria-label="Customer views">
      <button type="button" role="tab" aria-selected={tab === 'customers'} className={tab === 'customers' ? 'active' : ''} onClick={() => selectTab('customers')}>Customers</button>
      <button type="button" role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => selectTab('activity')}>Sign-in activity</button>
    </div>
    {tab === 'activity' ? <section className="card admin-panel"><SignInActivity locale={locale}/></section> : <section className="card admin-panel">
      <form className="admin-filters" onSubmit={event => {event.preventDefault(); setPage(1); setFilters(draft);}}>
        <label>Search<input type="search" value={draft.q} onChange={event => setDraft({...draft, q: event.target.value})} placeholder="Name or email"/></label>
        <label>Status<select value={draft.status} onChange={event => setDraft({...draft, status: event.target.value})}><option value="all">All</option><option value="active">Active</option><option value="locked">Locked</option></select></label>
        <label>Sign-in method<select value={draft.method} onChange={event => setDraft({...draft, method: event.target.value})}><option value="all">All</option><option value="google">Google</option><option value="discord">Discord</option><option value="password">Email + password</option></select></label>
        <label>Joined from<input type="date" value={draft.from} onChange={event => setDraft({...draft, from: event.target.value})}/></label>
        <label>Joined to<input type="date" value={draft.to} onChange={event => setDraft({...draft, to: event.target.value})}/></label>
        <div className="admin-filter-actions"><button type="submit">Apply</button><button type="button" className="secondary" onClick={() => {setDraft(emptyFilters); setFilters(emptyFilters); setPage(1);}}>Reset</button></div>
      </form>
      {error && <p className="admin-feedback error" role="alert">{error}</p>}
      {!data && !error && <LoadingRows label="Loading customers…"/>}
      {data && <>
        <p className="admin-result-count">{data.total} customer{data.total === 1 ? '' : 's'}</p>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Customer</th><th>Sign-in</th><th>Status</th><th>Joined</th><th>Last sign-in</th></tr></thead>
          <tbody>{data.customers.length === 0 ? <tr><td colSpan={5} className="admin-empty">No customers match these filters.</td></tr> : data.customers.map(customer => <tr key={customer.id}>
            <td><Link className="admin-customer-link" href={`/${locale}/admin/customers/${customer.id}`}><strong>{customer.name}</strong><span>{customer.email}</span></Link></td>
            <td>{customer.methods.map(method => <span className="badge" key={method}>{method === 'google' ? 'Google' : 'Password'}</span>)}{!customer.emailVerified && <span className="badge warn">email not verified</span>}</td>
            <td><span className={`badge ${customer.status === 'locked' ? 'danger' : 'ok'}`}>{customer.status === 'locked' ? 'Locked' : 'Active'}</span></td>
            <td>{formatDateTime(customer.createdAt)}</td>
            <td>{formatDateTime(customer.lastLoginAt)}</td>
          </tr>)}</tbody>
        </table></div>
        {pages > 1 && <div className="admin-pager"><button type="button" className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button><span>Page {page} of {pages}</span><button type="button" className="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button></div>}
      </>}
    </section>}
  </div>;
}
