'use client';
import {use} from 'react';
import AdminOrderView from '@/components/admin-order-view';

export default function AdminOrderDetail({params}: {params: Promise<{locale: string; id: string}>}) {
  const {locale, id} = use(params);
  return <AdminOrderView locale={locale} id={id}/>;
}
