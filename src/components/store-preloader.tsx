'use client';

import {useEffect} from 'react';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {invalidateJson, loadJson, type JsonResult} from '@/lib/client-data-cache';

type SessionBody = {account?: {role?: string} | null};
type CatalogBody = {products?: {id: string}[]};
type OrdersBody = {orders?: {code: string}[]};

async function limited(tasks: Array<() => Promise<unknown>>, concurrency = 2) {
  let next = 0;
  await Promise.all(Array.from({length: Math.min(concurrency, tasks.length)}, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      await task().catch(() => undefined);
    }
  }));
}

/** Warms likely next screens after first paint, without turning one visit into an unbounded database burst. */
export default function StorePreloader() {
  const locale = useLocale();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
    const constrained = Boolean(connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g');

    async function warm() {
      const routes = ['account', 'orders', 'inbox', 'workspace', 'cart', 'checkout'];
      for (const route of routes) router.prefetch(`/${locale}/${route}`);
      if (constrained || cancelled) return;

      const fallbackSession: JsonResult<SessionBody> = {ok: false, status: 0, data: {}};
      const fallbackCatalog: JsonResult<CatalogBody> = {ok: false, status: 0, data: {}};
      const [session, catalog] = await Promise.all([
        loadJson<SessionBody>('/api/auth/session', {maxAgeMs: 15_000}),
        loadJson<CatalogBody>('/api/catalog', {maxAgeMs: 60_000})
      ]).catch(() => [fallbackSession, fallbackCatalog] as const);
      if (cancelled) return;
      for (const product of catalog.data.products?.slice(0, 4) ?? []) router.prefetch(`/${locale}/products/${product.id}`);

      const tasks: Array<() => Promise<unknown>> = [
        () => loadJson('/api/availability', {maxAgeMs: 15_000}),
        () => loadJson('/api/payment-methods', {maxAgeMs: 60_000})
      ];
      if (session.data.account?.role === 'user') {
        tasks.push(
          async () => {
            const orders = await loadJson<OrdersBody>('/api/orders', {maxAgeMs: 30_000});
            for (const order of orders.data.orders?.slice(0, 3) ?? []) router.prefetch(`/${locale}/orders/${order.code}`);
          },
          () => loadJson('/api/notifications', {maxAgeMs: 20_000}),
          () => loadJson('/api/account', {maxAgeMs: 30_000}),
          () => loadJson('/api/lucky-wheel', {maxAgeMs: 30_000}),
          () => loadJson('/api/chat?rooms=0&read=0', {maxAgeMs: 20_000})
        );
      }
      await limited(tasks, 2);
    }

    const idleWindow = window as Window & {requestIdleCallback?: (callback: () => void, options?: {timeout: number}) => number; cancelIdleCallback?: (id: number) => void};
    const idle: number = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(() => void warm(), {timeout: 1500})
      : Number(globalThis.setTimeout(() => void warm(), 500));
    const accountChanged = () => {
      invalidateJson('/api/auth/session', '/api/orders', '/api/notifications', '/api/account', '/api/lucky-wheel', '/api/chat');
      window.setTimeout(() => void warm(), 50);
    };
    window.addEventListener('jh-account-changed', accountChanged);
    return () => {
      cancelled = true;
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idle);
      else globalThis.clearTimeout(idle);
      window.removeEventListener('jh-account-changed', accountChanged);
    };
  }, [locale, router]);

  return null;
}
