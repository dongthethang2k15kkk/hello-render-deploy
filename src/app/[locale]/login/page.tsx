'use client';
import {useState, type FormEvent} from 'react';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {demoCredentials} from '@/lib/demo-credentials';

export default function LoginPage() {
  const locale = useLocale();
  const vi = locale === 'vi';
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
    if (register && password !== confirm) {setError(vi ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.'); return;}
    setBusy(true);
    try {
      const response = await fetch(register ? '/api/auth/register' : '/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(register ? {username, name, password} : {username, password})});
      const data = await response.json();
      if (!response.ok) setError(data.error || (vi ? 'Không thể xử lý yêu cầu.' : 'Could not complete request.'));
      else {
        const next = new URLSearchParams(window.location.search).get('next');
        router.push(`/${locale}/${next === 'checkout' ? 'checkout' : 'workspace'}`);
        router.refresh();
      }
    } catch {setError(vi ? 'Không thể kết nối máy chủ.' : 'Could not connect to the server.');}
    finally {setBusy(false);}
  }

  return <div className="auth-page page-heading"><p className="eyebrow">ACCOUNT ACCESS / DEMO</p><h1>{register ? (vi ? 'Tạo tài khoản' : 'Create an account') : (vi ? 'Chào mừng trở lại' : 'Welcome back')}</h1><p className="muted">{vi ? 'Đăng nhập để trò chuyện với Admin và tiếp tục mua sắm.' : 'Sign in to chat with support and continue shopping.'}</p>
    <section className="auth-card card"><div className="auth-tabs" aria-label={vi ? 'Chọn phương thức' : 'Choose account action'}><button type="button" className={!register ? 'active' : ''} aria-pressed={!register} onClick={() => {setRegister(false); setError('');}}>{vi ? 'Đăng nhập' : 'Sign in'}</button><button type="button" className={register ? 'active' : ''} aria-pressed={register} onClick={() => {setRegister(true); setError('');}}>{vi ? 'Đăng ký' : 'Register'}</button></div>
      <form onSubmit={event => void submit(event)}>
        {register && <label>{vi ? 'Họ và tên' : 'Full name'}<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" required maxLength={80}/></label>}
        <label>{vi ? 'Tên đăng nhập' : 'Username'}<input value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required minLength={register ? 3 : undefined} maxLength={64} pattern={register ? '[a-zA-Z0-9._@-]+' : undefined}/></label>
        <label>{vi ? 'Mật khẩu' : 'Password'}<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : undefined} maxLength={128}/><button type="button" className="secondary" aria-label={showPassword ? (vi ? 'Ẩn mật khẩu' : 'Hide password') : (vi ? 'Hiện mật khẩu' : 'Show password')} onClick={() => setShowPassword(value => !value)}>{showPassword ? (vi ? 'Ẩn' : 'Hide') : (vi ? 'Hiện' : 'Show')}</button></span></label>
        {register && <><p className="field-caption">{vi ? 'Dùng 8–128 ký tự. Tài khoản demo sẽ mất khi server khởi động lại.' : 'Use 8–128 characters. Demo accounts reset when the server restarts.'}</p><label>{vi ? 'Xác nhận mật khẩu' : 'Confirm password'}<input type={showPassword ? 'text' : 'password'} value={confirm} onChange={event => setConfirm(event.target.value)} autoComplete="new-password" required/></label></>}
        {error && <p className="error-text" role="alert">{error}</p>}
        <button type="submit" className="full-width" disabled={busy}>{busy ? (vi ? 'Đang xử lý…' : 'Please wait…') : register ? (vi ? 'Tạo tài khoản' : 'Create account') : (vi ? 'Đăng nhập' : 'Sign in')}</button>
      </form>
      {!register && <details className="auth-demo"><summary>{vi ? 'Sử dụng tài khoản demo' : 'Use a demo account'}</summary>{demoCredentials.map(account => <button type="button" className="account-choice" key={account.username} onClick={() => {setUsername(account.username); setPassword(account.password); setError('');}}><strong>{account.name}</strong><span>{account.username} / {account.password}</span></button>)}</details>}
    </section><Link className="auth-back" href={`/${locale}`}>← {vi ? 'Quay lại cửa hàng' : 'Back to store'}</Link>
  </div>;
}