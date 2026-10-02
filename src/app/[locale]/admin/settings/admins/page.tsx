'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {LoadingRows} from '@/components/loading-state';

type State = {owners: string[]; admins: string[]};

export default function AdminTeam() {
  const locale = useLocale();
  const [state, setState] = useState<State | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/admin/settings/admins', {cache: 'no-store'}).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Admins could not be loaded.'));
  }, []);

  async function post(action: 'add' | 'remove', value: string, success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/settings/admins', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, email: value})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setState(body); setMessage(success);
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The change could not be saved.'); return false; }
    finally { setBusy(false); }
  }

  return <div className="admin-team-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / ADMINS</p><h1>Admins</h1><p className="admin-lede">People who can sign in to Admin with Google. Every Admin receives the order emails.</p></div></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}
    {!state && !error && <LoadingRows label="Loading…"/>}
    {state && <>
      <section className="card admin-panel"><h2>Add an Admin</h2>
        <p className="field-caption">Use the Gmail address they sign in with. They get access within a minute. While the Google sign-in app is in Testing, also add them as a test user in Google Cloud.</p>
        <form className="rate-form" onSubmit={event => {event.preventDefault(); void post('add', email, `${email.trim().toLowerCase()} can now sign in to Admin.`).then(ok => ok && setEmail(''));}}>
          <label>Gmail address<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="name@gmail.com" autoComplete="off"/></label>
          <button type="submit" disabled={busy}>Add Admin</button>
        </form>
      </section>
      <section className="card admin-panel"><h2>Current Admins</h2>
        <ul className="admin-list">
          {state.owners.map(owner => <li key={owner}><div><strong>{owner}</strong><span>Owner · set in Render (ADMIN_GOOGLE_EMAILS)</span></div><span className="badge ok">Owner</span></li>)}
          {state.admins.map(item => <li key={item}><div><strong>{item}</strong><span>Added in Admin</span></div><button type="button" className="admin-remove-link" disabled={busy} onClick={() => { if (window.confirm(`Remove Admin access for ${item}?`)) void post('remove', item, `${item} no longer has Admin access.`); }}>Remove</button></li>)}
          {state.owners.length + state.admins.length === 0 && <li className="admin-empty">No Admins configured.</li>}
        </ul>
      </section>
    </>}
  </div>;
}
