'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {REFRESH_HOURS, type Shelf} from '@/lib/accounts-shelf-rules';
import {LoadingRows} from '@/components/loading-state';

type Hypixel = {hasKey: boolean; keyTail: string | null; autoRefreshHours: 0 | 6 | 12 | 24; fairySoulsTotal: number};
type State = {shelf: Shelf; hypixel: Hypixel};

export default function AccountSettings() {
  const locale = useLocale();
  const [state, setState] = useState<State | null>(null);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [hours, setHours] = useState('12');
  const [souls, setSouls] = useState('289');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const adopt = (data: State) => { setState(data); setShelf(data.shelf); setHours(String(data.hypixel.autoRefreshHours)); setSouls(String(data.hypixel.fairySoulsTotal)); };
  useEffect(() => {
    fetch('/api/admin/settings/accounts', {cache: 'no-store'}).then(async response => {
      if (response.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
      const body = await response.json(); if (!response.ok) throw new Error(body.error); adopt(body);
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'The settings could not be loaded.'));
  }, [locale]);

  async function post(body: Record<string, unknown>, success: (data: any) => string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/accounts', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      adopt(data); setMessage(success(data));
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The settings could not be saved.'); return false; }
    finally { setBusy(false); }
  }

  if (!state || !shelf) return <div className="page-heading"><Link href={`/${locale}/admin/settings`}>← Settings</Link>{error ? <p className="admin-feedback error" role="alert">{error}</p> : <LoadingRows label="Loading…"/>}</div>;
  const text = (key: 'packagesTabLabel' | 'accountsTabLabel' | 'heading', label: string, max: number) => <label>{label}<input value={shelf[key]} maxLength={max} onChange={event => setShelf({...shelf, [key]: event.target.value})}/></label>;
  return <div className="admin-payments-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / SKYBLOCK ACCOUNTS</p><h1>SkyBlock accounts</h1><p className="admin-lede">The accounts shelf on the store, and the Hypixel connection that fills in each account’s stats.</p></div><Link className="button secondary" href={`/${locale}/admin/accounts`}>Manage accounts</Link></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}

    <section className="card admin-panel"><h2>Store shelf</h2>
      <form className="bank-form" onSubmit={event => {event.preventDefault(); void post({action: 'save-shelf', shelf}, () => 'Shelf saved. The store shows it within a minute.');}}>
        <label className="admin-compact-check"><input type="checkbox" checked={shelf.enabled} onChange={event => setShelf({...shelf, enabled: event.target.checked})}/> Show the accounts tab on the store (it is hidden anyway while no account is on sale)</label>
        <div className="admin-field-row">{text('packagesTabLabel', 'Packages tab label', 30)}{text('accountsTabLabel', 'Accounts tab label', 30)}</div>
        {text('heading', 'Heading above the accounts', 80)}
        <label>Intro text<textarea rows={3} maxLength={400} value={shelf.intro} onChange={event => setShelf({...shelf, intro: event.target.value})}/><small>{shelf.intro.length}/400</small></label>
        <label className="admin-compact-check"><input type="checkbox" checked={shelf.showIgnByDefault} onChange={event => setShelf({...shelf, showIgnByDefault: event.target.checked})}/> New accounts start with “Show IGN” switched on</label>
        <div className="form-actions"><button type="submit" disabled={busy}>Save shelf</button></div>
      </form>
    </section>

    <section className="card admin-panel"><h2>Hypixel API key</h2>
      <p className="field-caption">With a key, typing a player’s name fills in level, skills, purse, bank, fairy souls, networth and gear. Without one you can still enter everything by hand. <strong>The key is stored encrypted and is never sent back to your browser.</strong></p>
      <ol className="field-caption"><li>Open <a href="https://developer.hypixel.net" target="_blank" rel="noreferrer">developer.hypixel.net</a> and sign in with your Hypixel account.</li><li>Choose <strong>Create App</strong> and request a <strong>Personal API Key</strong>. Wait for it to be approved.</li><li>Do not use “Create API Key”: that key expires after 3 days.</li><li>Paste the key below and press Save, then Test.</li></ol>
      <p className="notice">Hypixel does not allow buying and selling accounts for real money, and the key belongs to your Hypixel account. If Hypixel removes the key, adding accounts by hand still works.</p>
      {state.hypixel.hasKey ? <p>Saved key: <strong className="admin-mono">••••-••••-{state.hypixel.keyTail}</strong></p> : <p className="admin-empty">No key saved yet.</p>}
      <form className="bank-form" onSubmit={event => {event.preventDefault(); void post({action: 'save-key', apiKey}, () => 'Key saved. Press Test to check it.').then(ok => ok && setApiKey(''));}}>
        <label>{state.hypixel.hasKey ? 'Replace the key' : 'API key'}<input className="admin-mono" type="password" autoComplete="off" spellCheck={false} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value={apiKey} onChange={event => setApiKey(event.target.value)} required/></label>
        <div className="form-actions"><button type="submit" disabled={busy || !apiKey.trim()}>Save key</button>
          <button type="button" className="secondary" disabled={busy || !state.hypixel.hasKey} onClick={() => void post({action: 'test-key'}, data => `The key works. Hypixel allows ${data.remaining ?? 'some'} more requests in the current window.`)}>Test</button>
          <button type="button" className="admin-remove-link" disabled={busy || !state.hypixel.hasKey} onClick={() => { if (window.confirm('Remove the saved Hypixel key?')) void post({action: 'remove-key'}, () => 'Key removed.'); }}>Remove</button></div>
      </form>
    </section>

    <section className="card admin-panel"><h2>Stats refresh</h2>
      <form className="bank-form" onSubmit={event => {event.preventDefault(); void post({action: 'save-hypixel', autoRefreshHours: Number(hours), fairySoulsTotal: Number(souls)}, () => 'Saved.');}}>
        <div className="admin-field-row">
          <label>Refresh stats automatically<select value={hours} onChange={event => setHours(event.target.value)}>{REFRESH_HOURS.map(value => <option key={value} value={value}>{value === 0 ? 'Never (only when I press Refresh)' : `Every ${value} hours`}</option>)}</select><small>Only accounts that are drafts, on sale or reserved, a few at a time. Sold accounts keep the stats they were sold with, and so do accounts whose numbers you edited by hand.</small></label>
          <label>Fairy souls in the game (total)<input type="number" min="1" max="2000" value={souls} onChange={event => setSouls(event.target.value)}/><small>Used for “241 / 289”. Change it when Hypixel adds more.</small></label>
        </div>
        <div className="form-actions"><button type="submit" disabled={busy}>Save</button></div>
      </form>
    </section>

    <section className="card admin-panel"><h2>Before you list an account</h2>
      <ul className="field-caption"><li>In the game, switch on <strong>Settings → API Settings</strong> (Inventory, Banking, Collections…) for that account; otherwise gear and bank cannot be read.</li><li><strong>Never change AUTH_SECRET</strong> on the server while accounts are stored: the saved login details and this key could no longer be opened. Reveal and copy them first.</li></ul>
    </section>
  </div>;
}
