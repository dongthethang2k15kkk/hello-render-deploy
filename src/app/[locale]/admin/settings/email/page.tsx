'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {formatDateTime} from '@/lib/customer-labels';

type Log = {id: string; recipient: string; subject: string; kind: string; status: string; error: string | null; orderId: string | null; createdAt: string};
type State = {connection: {email: string; connectedAt: string; connectedBy: string} | null; logs: Log[]; adminRecipients: string[]};

const errors: Record<string, string> = {
  scope_missing: 'Google did not grant permission to send email. Try again and tick “Send email on your behalf”.',
  no_refresh_token: 'Google did not return a long-lived token. Remove the app’s access at myaccount.google.com/permissions, then connect again.',
  google_not_configured: 'Google sign-in is not configured on the server.'
};

export default function EmailSettings() {
  const locale = useLocale();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected')) setMessage('Gmail connected. Send a test email to check delivery.');
    const code = params.get('error');
    if (code) setError(errors[code] ?? 'Gmail could not be connected.');
    fetch('/api/admin/email', {cache: 'no-store'}).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setState(body); })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Email settings could not be loaded.'));
  }, []);

  async function call(method: 'POST' | 'DELETE', success: string) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/email', {method});
      const data = await response.json();
      if (data.logs) setState(data);
      if (!response.ok) throw new Error(data.result?.error ?? data.error ?? 'The request failed.');
      setMessage(success);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'The request failed.'); }
    finally { setBusy(false); }
  }

  return <div className="admin-email-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow"><Link href={`/${locale}/admin/settings`}>ADMIN / SETTINGS</Link> / EMAIL</p><h1>Email</h1><p className="admin-lede">Order emails are sent from the shop’s Gmail through the Gmail API. Customers also get every update in their Inbox on the site.</p></div></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {message && <p className="admin-feedback success" role="status">{message}</p>}
    {!state && !error && <p className="muted" role="status">Loading…</p>}
    {state && <>
      <section className="card admin-panel"><h2>Gmail sender</h2>
        {state.connection ? <><p>Connected: <strong>{state.connection.email}</strong> <span className="badge ok">active</span></p><p className="field-caption">Connected {formatDateTime(state.connection.connectedAt)} by {state.connection.connectedBy}.</p>
          <div className="form-actions"><button type="button" disabled={busy} onClick={() => void call('POST', 'Test email sent to all Admin emails.')}>Send test email</button><a className="button secondary" href="/api/admin/email/connect">Reconnect / change Gmail</a><button type="button" className="admin-remove-link" disabled={busy} onClick={() => { if (window.confirm('Disconnect Gmail? Order emails stop until you connect again.')) void call('DELETE', 'Gmail disconnected.'); }}>Disconnect</button></div></>
          : <><p>No Gmail is connected, so order emails are not sent. Inbox messages on the site still work.</p>
            <ol className="setup-steps"><li>In Google Cloud Console, open the project used for sign-in and enable the <strong>Gmail API</strong> (APIs &amp; Services → Library).</li><li>Click <strong>Connect Gmail</strong> below and sign in with the Gmail the shop should send from.</li><li>If Google warns that the app is unverified, choose <strong>Advanced → Go to the app</strong>: only this account grants sending.</li><li>Allow <strong>Send email on your behalf</strong>, then send a test email.</li></ol>
            <a className="button" href="/api/admin/email/connect">Connect Gmail</a></>}
        <p className="field-caption">Admin emails go to: {state.adminRecipients.join(', ') || 'no Admin emails configured (ADMIN_GOOGLE_EMAILS)'}.</p>
      </section>
      <section className="card admin-panel"><h2>Recent emails</h2>
        {state.logs.length === 0 ? <p className="admin-empty">No emails yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Time</th><th>To</th><th>Subject</th><th>Status</th></tr></thead><tbody>{state.logs.map(log => <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td>{log.recipient}</td><td>{log.orderId ? <Link href={`/${locale}/admin/orders/${log.orderId}`}>{log.subject}</Link> : log.subject}{log.error && <small className="error-text"><br/>{log.error}</small>}</td><td><span className={`badge ${log.status === 'sent' ? 'ok' : log.status === 'failed' ? 'danger' : 'warn'}`}>{log.status}</span></td></tr>)}</tbody></table></div>}
      </section>
    </>}
  </div>;
}
