'use client';
import {useEffect, useState, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import Link from 'next/link';

const oauthErrors: Record<string, string> = {
  google_not_configured: 'Google sign-in is not configured yet.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_invalid_state: 'Google sign-in expired. Please try again.',
  google_failed: 'Could not complete Google sign-in. Please try again.',
  google_unverified: 'This Google email is not verified.',
  google_conflict: 'This email is already linked to a different Google account. Contact the shop on Zalo.',
  account_locked: 'This account is locked. Contact the shop on Zalo.',
  accounts_unavailable: 'Accounts are unavailable right now. Please try again shortly.'
};

export default function LoginPage() {
  const locale = useLocale();
  const router = useRouter();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState('');
  const [providers, setProviders] = useState<{google: boolean; devAdmin: boolean} | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (code) setError(oauthErrors[code] ?? 'Sign-in failed.');
    setNext(params.get('next') ?? '');
    fetch('/api/auth/providers', {cache: 'no-store'}).then(r => r.json()).then(setProviders).catch(() => setProviders({google: false, devAdmin: false}));
  }, []);

  async function devAdmin() {
    setBusy(true);
    const response = await fetch('/api/auth/dev-admin', {method: 'POST'}).catch(() => null);
    setBusy(false);
    if (response?.ok) {router.push(next.startsWith('/en/admin') ? next : `/${locale}/admin`); router.refresh();} else setError('Dev admin login is disabled.');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (register && password !== confirm) {setError('Passwords do not match.'); return;}
    setBusy(true);
    try {
      const response = await fetch(register ? '/api/auth/register' : '/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(register ? {email, name, password} : {email, password})});
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Could not complete request.');
      else {
        router.push(`/${locale}/${data.mustChangePassword ? 'account?required=1' : next === 'checkout' ? 'checkout' : 'workspace'}`);
        router.refresh();
      }
    } catch {setError('Could not connect to the server.');}
    finally {setBusy(false);}
  }

  const googleHref = `/api/auth/google/start${next === 'checkout' || next.startsWith('/en/admin') ? `?next=${encodeURIComponent(next)}` : ''}`;
  return <div className="auth-page page-heading"><p className="eyebrow">ACCOUNT ACCESS</p><h1>{register ? 'Create an account' : 'Welcome back'}</h1><p className="muted">Sign in to chat with support and continue shopping.</p>
    <section className="auth-card card"><div className="auth-tabs" aria-label="Choose account action"><button type="button" className={!register ? 'active' : ''} aria-pressed={!register} onClick={() => {setRegister(false); setError('');}}>Sign in</button><button type="button" className={register ? 'active' : ''} aria-pressed={register} onClick={() => {setRegister(true); setError('');}}>Register</button></div>
      {/* Plain link: OAuth needs a full-page navigation, not client routing. */}
      {providers?.google && <><a className="button secondary full-width google-signin" href={googleHref}>Continue with Google</a><p className="auth-divider"><span>or use your email</span></p></>}
      <form onSubmit={event => void submit(event)}>
        {register && <label>Full name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required maxLength={80}/></label>}
        <label>Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" required maxLength={254}/></label>
        <label>Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : undefined} maxLength={128}/><button type="button" className="secondary" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide' : 'Show'}</button></span></label>
        {register && <><p className="field-caption">Use 8–128 characters.</p><label>Confirm password<input type={showPassword ? 'text' : 'password'} value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required/></label><p className="field-caption">By creating an account you agree to our <Link href={`/${locale}/privacy`}>Privacy Policy</Link>.</p></>}
        {error && <p className="error-text" role="alert">{error}</p>}
        <button type="submit" className="full-width" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>
      {!register && <p className="auth-forgot"><Link href={`/${locale}/forgot-password`}>Forgot your password?</Link></p>}
      {!register && (providers?.google || providers?.devAdmin) && <div className="auth-admin">{providers?.google && <p className="field-caption">Store staff: use Continue with Google with your allowlisted account.</p>}
        {providers?.devAdmin && <button type="button" className="secondary full-width" disabled={busy} onClick={() => void devAdmin()}>Dev admin (local only)</button>}
      </div>}
    </section><Link className="auth-back" href={`/${locale}`}>← Back to store</Link>
  </div>;
}
