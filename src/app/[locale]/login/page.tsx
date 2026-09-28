'use client';
import {useState, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {demoCredentials} from '@/lib/demo-credentials';

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (register && password !== confirm) {setError('Passwords do not match.'); return;}
    setBusy(true);
    try {
      const response = await fetch(register ? '/api/auth/register' : '/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(register ? {username, name, password} : {username, password})});
      const data = await response.json();
      if (!response.ok) setError(data.error || ('Could not complete request.'));
      else {
        const next = new URLSearchParams(window.location.search).get('next');
        router.push(`/${locale}/${data.role === 'admin' ? 'admin/chat' : next === 'checkout' ? 'checkout' : 'workspace'}`);
        router.refresh();
      }
    } catch {setError('Could not connect to the server.');}
    finally {setBusy(false);}
  }

  return <div className="auth-page page-heading"><p className="eyebrow">ACCOUNT ACCESS / DEMO</p><h1>{register ? 'Create an account' : 'Welcome back'}</h1><p className="muted">{'Sign in to chat with support and continue shopping.'}</p>
    <section className="auth-card card"><div className="auth-tabs" aria-label={'Choose account action'}><button type="button" className={!register ? 'active' : ''} aria-pressed={!register} onClick={() => {setRegister(false); setError('');}}>{'Sign in'}</button><button type="button" className={register ? 'active' : ''} aria-pressed={register} onClick={() => {setRegister(true); setError('');}}>{'Register'}</button></div>
      <form onSubmit={event => void submit(event)}>
        {register && <label>{'Full name'}<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required maxLength={80}/></label>}
        <label>{'Username'}<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required minLength={register ? 3 : undefined} maxLength={64} pattern={register ? '[a-zA-Z0-9._@-]+' : undefined}/></label>
        <label>{'Password'}<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : undefined} maxLength={128}/><button type="button" className="secondary" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span></label>
        {register && <><p className="field-caption">{'Use 8–128 characters. Demo accounts reset when the server restarts.'}</p><label>{'Confirm password'}<input type={showPassword ? 'text' : 'password'} value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required/></label></>}
        {error && <p className="error-text" role="alert">{error}</p>}
        <button type="submit" className="full-width" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>
      {!register && <details className="auth-demo"><summary>{'Use a demo account'}</summary>{demoCredentials.map(account => <button type="button" className="account-choice" key={account.username} onClick={() => {setUsername(account.username); setPassword(account.password); setError('');}}><strong>{account.name}</strong><span>{account.username} / {account.password}</span></button>)}</details>}
    </section><Link className="auth-back" href={`/${locale}`}>← {'Back to store'}</Link>
  </div>;
}