'use client';

import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {usePathname} from 'next/navigation';
import ChatPanel from './chat-panel';
import {watchChat} from '@/lib/chat-client';
import {loadJson} from '@/lib/client-data-cache';

type Session = {id: string; name: string; role: 'admin' | 'user'; chatUnread?: number} | null;
/** Phones get a full-screen chat; matches the CSS breakpoint for the sheet. */
const PHONE = '(max-width: 480px)';

export default function ChatWidget() {
  const locale = useLocale();
  const path = usePathname();
  // Undefined until the first check. Later checks (every page change) refresh quietly, so an open chat is never torn down.
  const [account, setAccount] = useState<Session | undefined>(undefined);
  const [open, setOpen] = useState(false);
  // Once opened, the conversation stays mounted while hidden: reopening is instant and keeps its scroll position.
  const [opened, setOpened] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    loadJson<{account: Session}>('/api/auth/session', {maxAgeMs: 15_000})
      .then(({data}) => {if (active) setAccount(data.account);})
      .catch(() => {if (active) setAccount(current => current === undefined ? null : current);});
    return () => {active = false;};
  }, [path]);

  useEffect(() => {
    if (!account) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = watchChat(event => {
      if (event.kind === 'disconnected') return;
      if (!timer) timer = setTimeout(() => {timer = undefined; void loadJson<{account: Session}>('/api/auth/session', {force: true}).then(({data}) => setAccount(data.account)).catch(() => {});}, 300);
    });
    return () => {stop(); clearTimeout(timer);};
  }, [account?.id]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    loadJson<{online?: number}>('/api/availability', {maxAgeMs: 15_000}).then(({data}) => {if (active) setOnline((data?.online ?? 0) > 0);}).catch(() => {});
    return () => {active = false;};
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const phone = window.matchMedia(PHONE).matches;
    // A mouse user can type straight away; on a phone the keyboard only opens when the reply box is tapped.
    const reply = dialog.current?.querySelector<HTMLTextAreaElement>('textarea:not(:disabled)');
    if (reply && !phone && window.matchMedia('(pointer: fine)').matches) reply.focus({preventScroll: true});
    else closeButton.current?.focus({preventScroll: true});
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {setOpen(false); launcher.current?.focus(); return;}
      if (event.key !== 'Tab' || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),textarea:not(:disabled),input:not(:disabled)')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
    };
    window.addEventListener('keydown', onKeyDown);
    if (!phone) return () => window.removeEventListener('keydown', onKeyDown);
    // Full screen on a phone: freeze the page behind and stop painting its animated background.
    const root = document.documentElement;
    document.body.style.overflow = 'hidden';
    root.classList.add('chat-sheet-open');
    // iOS keeps the page height when the keyboard opens, so the sheet follows the visible area to keep the reply box above it.
    const viewport = window.visualViewport;
    const element = dialog.current;
    const sync = () => {
      if (!viewport || !element) return;
      element.style.setProperty('--sheet-height', `${Math.round(viewport.height)}px`);
      element.style.setProperty('--sheet-top', `${Math.round(viewport.offsetTop)}px`);
      // With the keyboard up, the home-indicator padding under the reply box is wasted space.
      element.classList.toggle('keyboard-open', window.innerHeight - viewport.height > 120);
    };
    sync();
    viewport?.addEventListener('resize', sync);
    viewport?.addEventListener('scroll', sync);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      root.classList.remove('chat-sheet-open');
      viewport?.removeEventListener('resize', sync);
      viewport?.removeEventListener('scroll', sync);
      element?.classList.remove('keyboard-open');
    };
  }, [open]);

  if (/\/(workspace|login|forgot-password|admin|checkout|orders)(\/|$)/.test(path)) return null;
  const close = () => {setOpen(false); launcher.current?.focus({preventScroll: true});};
  return <div className={`support-widget ${open ? 'is-open' : ''}`}>
    {opened && <div ref={dialog} className="support-window" role="dialog" aria-modal="true" aria-label={'Live support'} hidden={!open}>
      <div className="support-top">
        <span className={`support-avatar ${online ? 'online' : ''}`} aria-hidden="true">JH</span>
        <div className="support-title"><strong>{'Chat with support'}</strong><small>{online === null ? 'Jewish Horse team' : online ? 'Active now' : 'Away · we reply as soon as we are back'}</small></div>
        <button ref={closeButton} type="button" className="support-close" aria-label={'Close chat'} onClick={close}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      {account === undefined ? <div className="support-guest" role="status">{'Checking your account…'}</div> : account?.role === 'user' ? <ChatPanel accountId={account.id} key={account.id} role="user" compact active={open}/> : <div className="support-guest"><span aria-hidden="true">✦</span><h2>{'Hello!'}</h2><p>{account?.role === 'admin' ? 'Open your inbox to help customers.' : 'Sign in to start a private conversation with our team.'}</p><Link className="button" href={account?.role === 'admin' ? `/${locale}/admin/chat` : `/${locale}/login?next=workspace`}>{account?.role === 'admin' ? 'Open inbox' : 'Sign in / Register'}</Link></div>}
    </div>}
    <button ref={launcher} type="button" className="support-launcher" aria-expanded={open} aria-label={open ? 'Close chat' : 'Open support chat'} onClick={() => {setOpened(true); setOpen(value => !value);}}><span aria-hidden="true">{open ? '×' : '✉'}</span><span>{'Chat'}</span>{!open && account?.chatUnread ? <b className="pill-badge launcher-badge" aria-label={`${account.chatUnread} unread`}>{account.chatUnread}</b> : null}</button>
  </div>;
}
