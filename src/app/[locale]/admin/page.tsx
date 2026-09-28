import {redirect} from 'next/navigation';

export default async function AdminHome({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  redirect(`/${locale}/admin/chat`);
}