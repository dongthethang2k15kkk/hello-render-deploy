'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {useRouter} from 'next/navigation';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';
import {useCatalog} from '@/components/catalog-provider';
import {formatRange, statusLabels, statusTone, type OrderStatus} from '@/lib/order-rules';
import {LoadingRows} from '@/components/loading-state';

type OrderRow = {code: string; status: OrderStatus; totalVnd: number; createdAt: string; appointmentStart: string | null; appointmentEnd: string | null; items: {title: string; quantity: number}[]};

export default function MyOrders() {
  const locale = useLocale();
  const router = useRouter();
  const {vndPerUsd} = useCatalog();
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [error, setError] = useState('');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    fetch('/api/orders', {cache: 'no-store'}).then(async response => {
      if (response.status === 401) { router.replace(`/${locale}/login?next=account`); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setOrders(data.orders);
    }).catch(cause => setError(cause instanceof Error ? cause.message : 'Orders could not be loaded.'));
  }, [locale, router]);

  return <div className="page-heading orders-page"><p className="eyebrow">YOUR ACCOUNT</p><h1>My orders</h1>
    {error && <p className="error-text" role="alert">{error}</p>}
    {!orders && !error && <LoadingRows label="Loading orders…"/>}
    {orders && orders.length === 0 && <div className="empty-state"><h2>No orders yet</h2><Link className="button" href={`/${locale}#catalog`}>Explore packages →</Link></div>}
    {orders && orders.length > 0 && <div className="order-list">{orders.map(order => <Link className="card order-row" key={order.code} href={`/${locale}/orders/${order.code}`}>
      <div><strong>{order.code}</strong><small>{order.items.map(item => `${item.title} × ${item.quantity}`).join(', ')}</small>{order.appointmentStart && order.appointmentEnd && order.status === 'scheduled' && <small>Appointment: {formatRange(order.appointmentStart, order.appointmentEnd, timeZone)}</small>}</div>
      <div className="order-row-side"><span className={`badge ${statusTone[order.status]}`}>{statusLabels[order.status]}</span><strong>{formatUsdFromVnd(order.totalVnd, vndPerUsd)}</strong><small>{formatVnd(order.totalVnd)}</small><small>{new Date(order.createdAt).toLocaleDateString('en-GB')}</small></div>
    </Link>)}</div>}
  </div>;
}
