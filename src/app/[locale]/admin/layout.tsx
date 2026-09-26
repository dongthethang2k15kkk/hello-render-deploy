import {redirect} from 'next/navigation';
import {getSession} from '@/lib/demo-auth';

export default async function AdminLayout({children, params}: {children: React.ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if ((await getSession())?.role !== 'admin') redirect(`/${locale}/login`);
  return children;
}