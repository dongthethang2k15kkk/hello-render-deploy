'use client';

import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {usePathname} from 'next/navigation';
import ChatPanel from './chat-panel';

type Session = {id: string; name: string; role: 'admin' | 'user'} | null;

export default function ChatWidget() {
  const locale = useLocale();
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
    {open && <div className="support-window" aria-label={'Live support'}>
      <div className="support-top"><strong>{'Chat with support'}</strong><button type="button" className="support-close" aria-label={'Close chat'} onClick={() => setOpen(false)}>×</button></div>
       {loading ? <div className="support-guest" role="status">{'Checking your account…'}</div> : account?.role === 'user' ? <ChatPanel key={account.id} role="user" compact/> : <div className="support-guest"><span aria-hidden="true">✦</span><h2>{'Hello!'}</h2><p>{account?.role === 'admin' ? 'Open your inbox to help customers.' : 'Sign in to start a private conversation with our team.'}</p><Link className="button" href={account?.role === 'admin' ? `/${locale}/admin/chat` : `/${locale}/login?next=workspace`}>{account?.role === 'admin' ? 'Open inbox' : 'Sign in / Register'}</Link></div>}
    </div>}
    <button type="button" className="support-launcher" aria-expanded={open} aria-label={open ? 'Close chat' : 'Open support chat'} onClick={() => setOpen(value => !value)}><span aria-hidden="true">{open ? '×' : '✉'}</span><span>{'Chat'}</span></button>
  </div>;
}