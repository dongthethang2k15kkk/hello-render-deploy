import {notFound} from 'next/navigation';
import AccountDetail from '@/components/account-detail';
import {publicAccount} from '@/lib/account-public';
import {getVndPerUsd} from '@/lib/exchange-rates';

export default async function AccountPage({params}: {params: Promise<{locale: string; code: string}>}) {
  const {locale, code} = await params;
  if (locale !== 'en') notFound();
  const [account, vndPerUsd] = await Promise.all([publicAccount(code.toUpperCase()), getVndPerUsd()]);
  if (!account) notFound();
  return <AccountDetail account={account} vndPerUsd={vndPerUsd} locale={locale}/>;
}
