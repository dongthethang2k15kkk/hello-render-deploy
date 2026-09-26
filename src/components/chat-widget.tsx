'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {usePathname} from 'next/navigation';
import ChatPanel from './chat-panel';

type Session = {id: string; name: string; role: 'admin' | 'user'} | null;

export default function ChatWidget() {
  const locale = useLocale();
  const vi = locale === 'vi';
  const path = usePathname();
  const [account, setAccount] = useState<Session>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch('/api/auth/session', {cache: 'no-store', signal: controller.signal})
      .then(response => response.json()).then(data => {setAccount(data.account); setLoading(false);})
      .catch(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [path]);

  if (/\/(workspace|login|admin|checkout)(\/|$)/.test(path)) return null;
  return <div className="support-widget">
    {open && <div className="support-window" aria-label={vi ? 'Hỗ trợ trực tuyến' : 'Live support'}>
      <div className="support-top"><strong>{vi ? 'Tư vấn với Admin' : 'Chat with support'}</strong><button type="button" className="support-close" aria-label={vi ? 'Đóng chat' : 'Close chat'} onClick={() => setOpen(false)}>×</button></div>
      {loading ? <div className="support-guest" role="status">{vi ? 'Đang kiểm tra tài khoản…' : 'Checking your account…'}</div> : account?.role === 'user' ? <ChatPanel key={account.id} role="user" compact/> : <div className="support-guest"><span aria-hidden="true">✦</span><h2>{vi ? 'Chào bạn!' : 'Hello!'}</h2><p>{account?.role === 'admin' ? (vi ? 'Mở hộp thư để hỗ trợ khách hàng.' : 'Open your inbox to help customers.') : (vi ? 'Đăng nhập để bắt đầu cuộc trò chuyện riêng với Admin.' : 'Sign in to start a private conversation with our team.')}</p><Link className="button" href={account?.role === 'admin' ? `/${locale}/workspace` : `/${locale}/login?next=workspace`}>{account?.role === 'admin' ? (vi ? 'Mở hộp thư' : 'Open inbox') : (vi ? 'Đăng nhập / Đăng ký' : 'Sign in / Register')}</Link></div>}
    </div>}
    <button type="button" className="support-launcher" aria-expanded={open} aria-label={open ? (vi ? 'Đóng chat' : 'Close chat') : (vi ? 'Mở tư vấn' : 'Open support chat')} onClick={() => setOpen(value => !value)}><span aria-hidden="true">{open ? '×' : '✉'}</span><span>{vi ? 'Tư vấn' : 'Chat'}</span></button>
  </div>;
}