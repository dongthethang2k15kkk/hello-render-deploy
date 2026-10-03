'use client';
import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';

/** Big header switch: an Admin tells customers they are online and can trade right now (only turned off by hand). */
export function AvailabilityToggle() {
  const [state, setState] = useState<{online: boolean; onlineAdmins: {email: string}[]} | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => fetch('/api/admin/availability', {cache: 'no-store'}).then(response => response.ok ? response.json() : null).then(data => { if (data) setState(data); }).catch(() => undefined), []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function toggle() {
    if (!state) return;
    setBusy(true);
    const response = await fetch('/api/admin/availability', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({online: !state.online})}).catch(() => null);
    const data = await response?.json().catch(() => null);
    if (response?.ok && data) setState(data);
    setBusy(false);
  }
  if (!state) return <span className="availability-toggle loading" aria-hidden="true"/>;
  const others = state.onlineAdmins.length - (state.online ? 1 : 0);
  return <button type="button" className={`availability-toggle ${state.online ? 'on' : 'off'}`} aria-pressed={state.online} disabled={busy} onClick={() => void toggle()}
    title={state.online ? 'Customers see that you can trade now. Tap to go offline.' : 'Tap when you are ready to trade: customers can then choose “Trade now”.'}>
    <span className="availability-dot" aria-hidden="true"/>
    <span className="availability-text"><strong>{state.online ? 'Online — trading' : 'Go online'}</strong><small>{state.online ? 'Tap to go offline' : others > 0 ? `${others} other Admin${others === 1 ? '' : 's'} online` : 'Customers see you are away'}</small></span>
  </button>;
}

/** How many Admins are online to trade, polled for the store. */
export function useOnlineAdmins() {
  const [online, setOnline] = useState<number | null>(null);
  useEffect(() => {
    const load = () => fetch('/api/availability', {cache: 'no-store'}).then(response => response.json()).then(data => setOnline(typeof data.online === 'number' ? data.online : 0)).catch(() => setOnline(current => current ?? 0));
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 30000);
    return () => window.clearInterval(timer);
  }, []);
  return online;
}

/** Big status pill in the store header on every page: green and glowing while a trader is online, quiet when away. */
export function HeaderLiveStatus({locale}: {locale: string}) {
  const online = useOnlineAdmins();
  if (online === null) return <span className="header-live pending" aria-hidden="true"/>;
  return <Link className={`header-live ${online > 0 ? 'online' : 'offline'}`} href={`/${locale}#buy`} role="status"
    title={online > 0 ? 'A trader is online: choose “Trade now” at checkout and trade in minutes.' : 'Nobody is online right now: order any time and pick a time to trade.'}>
    <span className="live-status-dot" aria-hidden="true"/>
    {online > 0
      ? <span className="header-live-text"><strong>Online now</strong><small>{online} trader{online === 1 ? '' : 's'} ready · Trade now →</small></span>
      : <span className="header-live-text"><strong>Away</strong><small>Order now · pick a time</small></span>}
  </Link>;
}
