'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {LoadingRows} from '@/components/loading-state';
import {MAX_HISTORICAL_TRADES} from '@/lib/trade-counter-rules';

type CounterState = {historicalCompleted: number; shopCompleted: number; total: number};

export default function TradeCounterSettings() {
  const locale = useLocale();
  const [state, setState] = useState<CounterState | null>(null);
  const [historical, setHistorical] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings/trade-counter', {cache: 'no-store'}).then(async response => {
      if (response.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState(body); setHistorical(String(body.historicalCompleted));
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Trade counter settings could not be loaded.'));
  }, [locale]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(historical);
    if (!Number.isInteger(value) || value < 0 || value > MAX_HISTORICAL_TRADES) {
      setError('Enter a whole number from 0 to 100,000,000.'); return;
    }
    setBusy(true); setError(''); setMessage('');
    const response = await fetch('/api/admin/settings/trade-counter', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({historicalCompleted: value})}).catch(() => null);
    const body = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) { setError(body?.error ?? 'Trade counter settings could not be saved.'); return; }
    setState(body); setHistorical(String(body.historicalCompleted)); setMessage('Saved. The updated total is live on the store.');
  }

  const entered = Number(historical);
  const preview = state && Number.isInteger(entered) && entered >= 0 ? entered + state.shopCompleted : state?.total;

  return <div className="page-heading"><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / TRADE COUNTER</p><h1>Completed trade counter</h1>
    <p className="notice">Add orders completed before this website to the public trust counter. The store automatically adds every order that Admin marks <strong>Complete</strong>; unpaid, cancelled and unfinished orders are not counted.</p>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}
    {!state ? !error && <LoadingRows label="Loading trade counter…"/> : <form className="card admin-panel" onSubmit={event => void save(event)}>
      <label>Completed orders before this website<input aria-label="Completed orders before this website" type="number" inputMode="numeric" min="0" max={MAX_HISTORICAL_TRADES} step="1" required value={historical} onChange={event => setHistorical(event.target.value)}/><small className="field-caption">Admin controls this number. Set it to 0 to show only orders completed on this shop.</small></label>
      <div className="admin-field-row trade-counter-summary" aria-label="Trade counter calculation">
        <div className="notice"><small>Previous orders</small><strong>{Number.isInteger(entered) && entered >= 0 ? entered.toLocaleString('en-US') : '—'}</strong></div>
        <div className="notice"><small>Completed on this shop</small><strong>+ {state.shopCompleted.toLocaleString('en-US')}</strong></div>
        <div className="notice"><small>Total shown to customers</small><strong>= {preview?.toLocaleString('en-US') ?? '—'}</strong></div>
      </div>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save trade counter'}</button>
    </form>}
  </div>;
}
