'use client';
import {useEffect, useState, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import Link from 'next/link';

type Profile = {name: string; email: string; emailVerified: boolean; google: boolean; hasPassword: boolean; mustChangePassword: boolean; createdAt: string};

export default function AccountPage() {
  const locale = useLocale();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const response = await fetch('/api/account', {cache: 'no-store'}).catch(() => null);
    if (response?.status === 401) {router.replace(`/${locale}/login?next=account`); return;}
    const data = await response?.json().catch(() => null);
    if (response?.ok && data?.account) setProfile(data.account); else setError('Your account could not be loaded.');
  }
  useEffect(() => {void load();}, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function post(body: unknown) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/account', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Request failed.');
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); return false; }
    finally { setBusy(false); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {setError('New passwords do not match.'); return;}
    if (await post({action: 'change-password', current: current || undefined, password})) {
      setCurrent(''); setPassword(''); setConfirm('');
      setMessage('Password updated. Other devices were signed out.');
      await load(); router.refresh();
    }
  }

  async function signOutEverywhere() {
    if (!window.confirm('Sign out of every other device?')) return;
    if (await post({action: 'sign-out-everywhere'})) setMessage('Other devices were signed out.');
  }

  if (!profile) return <div className="page-heading"><p className="eyebrow">YOUR ACCOUNT</p><h1>Account</h1>{error ? <p className="error-text" role="alert">{error}</p> : <p aria-busy="true">Loading…</p>}</div>;
  const required = profile.mustChangePassword;
  return <div className="page-heading account-page"><p className="eyebrow">YOUR ACCOUNT</p><h1>Account</h1>
    {required && <p className="notice" role="alert"><strong>Please set a new password.</strong> The shop gave you a temporary password; choose your own before continuing.</p>}
    {message && <p className="account-feedback" role="status">{message}</p>}
    <section className="card account-card"><h2>Profile</h2>
      <dl className="account-details"><dt>Name</dt><dd>{profile.name}</dd><dt>Email</dt><dd>{profile.email} {profile.emailVerified ? <span className="badge ok">verified by Google</span> : <span className="badge">not verified</span>}</dd><dt>Sign-in methods</dt><dd>{[profile.google && 'Google', profile.hasPassword && 'Password'].filter(Boolean).join(' · ') || '—'}</dd><dt>Member since</dt><dd>{new Date(profile.createdAt).toLocaleDateString('en-GB')}</dd></dl>
      <p><Link href={`/${locale}/workspace`}>Open chat with support →</Link></p>
    </section>
    <section className="card account-card"><h2>{profile.hasPassword ? 'Change password' : 'Set a password'}</h2>
      {!profile.hasPassword && <p className="field-caption">You sign in with Google. Setting a password lets you also sign in with your email.</p>}
      <form onSubmit={event => void changePassword(event)}>
        {profile.hasPassword && <label>{required ? 'Temporary password' : 'Current password'}<input type={show ? 'text' : 'password'} value={current} onChange={event => setCurrent(event.target.value)} autoComplete="current-password" required maxLength={128}/></label>}
        <label>New password<input type={show ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" required minLength={8} maxLength={128}/></label>
        <label>Confirm new password<input type={show ? 'text' : 'password'} value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required/></label>
        <label className="account-show"><input type="checkbox" checked={show} onChange={event => setShow(event.target.checked)}/> Show passwords</label>
        {error && <p className="error-text" role="alert">{error}</p>}
        <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </section>
    <section className="card account-card"><h2>Devices</h2><p className="field-caption">Signed in on a shared or lost device? Sign out everywhere else. This device stays signed in.</p><button type="button" className="secondary" disabled={busy} onClick={() => void signOutEverywhere()}>Sign out of other devices</button></section>
  </div>;
}
