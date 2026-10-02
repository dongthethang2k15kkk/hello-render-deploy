'use client';
import {useEffect, useRef, useState} from 'react';
import {usePathname} from 'next/navigation';

/**
 * Immediate feedback for client-side navigation: a thin top bar from the click on an internal link until the new page
 * renders, then a short fade of the page content. Search-only and same-page links are ignored (no route change).
 */
export default function RouteFeedback() {
  const pathname = usePathname();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const first = useRef(true);

  useEffect(() => {
    // Capture phase: runs before Next's <Link> handler calls preventDefault.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin === window.location.origin && url.pathname !== window.location.pathname) setState('loading');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setState(current => current === 'loading' ? 'done' : current);
    const main = document.querySelector('main');
    if (main && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) main.animate([{opacity: 0.35}, {opacity: 1}], {duration: 220, easing: 'ease-out'});
    const timer = window.setTimeout(() => setState('idle'), 600);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  // A cancelled navigation never changes the path; do not leave the bar running.
  useEffect(() => {
    if (state !== 'loading') return;
    const timer = window.setTimeout(() => setState('idle'), 12000);
    return () => window.clearTimeout(timer);
  }, [state]);

  return <div className="route-progress" data-state={state} aria-hidden="true"/>;
}
