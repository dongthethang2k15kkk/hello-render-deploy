'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const POLL_MS = 20000;

/** Admin navigation with live badges (orders needing action, unread customer messages). */
export default function AdminNav({locale, initialOrders}: {locale: string; initialOrders: number}) {
  const pathname = usePathname();
  const [counts, setCounts] = useState({orders: initialOrders, chat: 0});

  useEffect(() => {
    const controller = new AbortController();
    const load = () => fetch('/api/admin/counts', {cache: 'no-store', signal: controller.signal})
      .then(response => {
        // An expired Admin session: sign in again and come back to this page.
        if (response.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return null; }
        return response.ok ? response.json() : null;
      })
      .then(data => { if (data) setCounts({orders: data.orders ?? 0, chat: data.chat ?? 0}); })
      .catch(() => undefined);
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, POLL_MS);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [locale, pathname]);

  const links: [string, string, number][] = [['overview', 'Overview', 0], ['orders', 'Orders', counts.orders], ['chat', 'Chat', counts.chat], ['customers', 'Customers', 0], ['activity', 'Activity', 0], ['settings', 'Settings', 0]];
  return <nav aria-label="Admin navigation">{links.map(([slug, label, count]) => {
    const active = pathname.startsWith(`/${locale}/admin/${slug}`);
    return <Link key={slug} href={`/${locale}/admin/${slug}`} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>{label}{count > 0 && <b className="nav-badge" aria-label={`${count} ${slug === 'chat' ? 'unread' : 'need action'}`}>{count}</b>}</Link>;
  })}</nav>;
}
