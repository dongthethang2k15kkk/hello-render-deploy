'use client';
import {useEffect, useState, type FormEvent} from 'react';
import Link from 'next/link';

/** Sign in or create an account inside checkout, so the order (and the chosen time) is not lost on another page. */
export function CheckoutSignIn({locale, onSignedIn}: {locale: string; onSignedIn: () => void}) {
  const [providers, setProviders] = useState<{google: boolean; discord?: boolean} | null>(null);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/auth/providers', {cache: 'no-store'}).then(response => response.json()).then(setProviders).catch(() => setProviders({google: false}));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    const fresh = mode === 'new';
    const response = await fetch(fresh ? '/api/auth/register' : '/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(fresh ? {name, email, password} : {email, password})}).catch(() => null);
    const data = await response?.json().catch(() => null);
    setBusy(false);
    if (!response?.ok) { setError(data?.error ?? 'Could not connect to the server.'); return; }
    if (data?.role === 'admin') { setError('Admin accounts cannot buy.'); return; }
    // A password set by an Admin must be changed first; the sign-in page handles that and comes back here.
    if (data?.mustChangePassword) { window.location.assign(`/${locale}/login?next=checkout`); return; }
    window.dispatchEvent(new Event('jh-account-changed'));
    onSignedIn();
  }

  return <div className="checkout-sign-in">
    <h2>Sign in to place your order</h2>
    <p className="muted">Your trade time and order updates go to your email. One click with Discord or Google, or use your email.</p>
    {(providers?.discord || providers?.google) && <div className="oauth-buttons">
      {providers.discord && <a className="button full-width discord-signin" href="/api/auth/discord/start?next=checkout">Continue with Discord</a>}
      {providers.google && <a className="button secondary full-width google-signin" href="/api/auth/google/start?next=checkout">Continue with Google</a>}
      <p className="auth-divider"><span>or use your email</span></p>
    </div>}
    <div className="auth-tabs" aria-label="Choose account action">
      <button type="button" className={mode === 'new' ? 'active' : ''} aria-pressed={mode === 'new'} onClick={() => { setMode('new'); setError(''); }}>New here</button>
      <button type="button" className={mode === 'existing' ? 'active' : ''} aria-pressed={mode === 'existing'} onClick={() => { setMode('existing'); setError(''); }}>I have an account</button>
    </div>
    <form onSubmit={event => void submit(event)}>
      {mode === 'new' && <label>Name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required maxLength={80}/></label>}
      <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254}/></label>
      <label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete={mode === 'new' ? 'new-password' : 'current-password'} required minLength={mode === 'new' ? 8 : undefined} maxLength={128}/></label>
      {mode === 'new' && <p className="field-caption">At least 8 characters. By creating an account you agree to our <Link href={`/${locale}/privacy`}>Privacy Policy</Link>.</p>}
      {mode === 'existing' && <p className="field-caption"><Link href={`/${locale}/forgot-password`}>Forgot your password?</Link></p>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <button type="submit" className="full-width" disabled={busy}>{busy ? 'Please wait…' : mode === 'new' ? 'Create account and continue' : 'Sign in and continue'}</button>
    </form>
  </div>;
}
