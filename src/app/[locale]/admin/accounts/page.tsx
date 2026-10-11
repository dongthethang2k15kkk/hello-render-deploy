'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {useLocale} from 'next-intl';
import {accountStatusLabels, accountStatusTone, ACCOUNT_STATUSES, effectivePrice, type AccountStatus} from '@/lib/account-rules';
import {timeAgo} from '@/lib/account-view';
import {formatUsdFromVnd, formatVnd} from '@/lib/money';
import {formatCompact, type AccountStats} from '@/lib/skyblock-stats';
import {LoadingRows} from '@/components/loading-state';

type Row = {id: string; code: string; ign: string; showIgn: boolean; title: string; priceVnd: number; salePriceVnd: number | null; status: AccountStatus; imagePaths: string[]; stats: AccountStats | null; statsFetchedAt: string | null; statsError: string | null; statsSource: string};
type Data = {accounts: Row[]; counts: Record<string, number>; vndPerUsd: number; hypixel: {hasKey: boolean}};

export default function AdminAccounts() {
  const locale = useLocale();
  const [status, setStatus] = useState('all');
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/accounts?status=${status}`, {cache: 'no-store', signal: controller.signal})
      .then(async response => {
        if (response.status === 403) { window.location.assign(`/${locale}/login?next=${encodeURIComponent(window.location.pathname)}`); return; }
        const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setError('');
      })
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Accounts could not be loaded.'); });
    return () => controller.abort();
  }, [status, locale]);

  return <div className="admin-accounts-page">
    <div className="page-heading admin-page-heading"><div><p className="eyebrow">ADMIN / ACCOUNTS</p><h1>SkyBlock accounts</h1><p className="admin-lede">Accounts for sale. Each one is a single item with its own price, screenshots and stats; the login details are delivered automatically once a payment is confirmed.</p></div><Link className="button" href={`/${locale}/admin/accounts/new`}>Add account</Link></div>
    {error && <p className="admin-feedback error" role="alert">{error}</p>}
    {data && !data.hypixel.hasKey && <p className="notice">No Hypixel API key yet, so stats cannot be fetched: you can still enter them by hand. <Link href={`/${locale}/admin/settings/accounts`}>Add a key in Settings</Link>.</p>}
    <div className="admin-tabs" role="tablist" aria-label="Account status">
      {['all', ...ACCOUNT_STATUSES].map(value => <button type="button" key={value} role="tab" aria-selected={status === value} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{value === 'all' ? 'All' : accountStatusLabels[value as AccountStatus]}{data ? ` (${data.counts[value] ?? 0})` : ''}</button>)}
    </div>
    <section className="card admin-panel">
      {!data ? !error && <LoadingRows label="Loading accounts…"/> : data.accounts.length === 0 ? <p className="admin-empty">No accounts here yet. Press “Add account”.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th/><th>Code</th><th>Title</th><th>IGN</th><th>Level</th><th>Farming</th><th>Networth</th><th>Price</th><th>Status</th><th>Stats</th></tr></thead><tbody>{data.accounts.map(account => {
        const farming = account.stats?.skills.find(skill => skill.key === 'FARMING');
        const price = effectivePrice(account);
        return <tr key={account.id}>
          <td>{account.imagePaths[0] ? <img className="admin-thumb" src={account.imagePaths[0]} alt=""/> : <span className="admin-thumb blank" aria-hidden="true"/>}</td>
          <td className="admin-mono"><Link href={`/${locale}/admin/accounts/${account.id}`}>{account.code}</Link></td>
          <td>{account.title}</td>
          <td>{account.ign} <small className="admin-subtle" title={account.showIgn ? 'Shown to customers' : 'Hidden until delivery'}>{account.showIgn ? '👁' : '🚫'}</small></td>
          <td>{account.stats?.level.level ?? '—'}</td><td>{farming?.level ?? '—'}</td><td>{account.stats?.summary.networth ? formatCompact(account.stats.summary.networth) : '—'}</td>
          <td>{formatUsdFromVnd(price, data.vndPerUsd)}<small className="admin-subtle"> · {formatVnd(price)}</small></td>
          <td><span className={`badge ${accountStatusTone[account.status]}`}>{accountStatusLabels[account.status]}</span></td>
          <td><small className="admin-subtle">{account.statsFetchedAt ? `Updated ${timeAgo(account.statsFetchedAt)}` : 'No stats'}{account.statsSource === 'manual' ? ' · by hand' : ''}</small>{account.statsError && <small className="error-text" title={account.statsError}> ⚠ refresh failed</small>}</td>
        </tr>;
      })}</tbody></table></div>}
    </section>
  </div>;
}
