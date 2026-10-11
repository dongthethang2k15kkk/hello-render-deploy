'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState} from 'react';
import {eliteUrl, skyCryptUrl, timeAgo} from '@/lib/account-view';
import {accountStatusLabels} from '@/lib/account-rules';
import type {PublicAccount} from '@/lib/account-public';
import {formatUsdFromVnd} from '@/lib/money';
import {GAME_MODES} from '@/lib/skyblock-stats';
import {useCart} from './cart-provider';
import {AccountStatsView} from './account-ui';
import Price from './price';

/** The page of one account: price and Buy button on top, then the stats the way a player expects to read them. */
export default function AccountDetail({account, vndPerUsd, locale}: {account: PublicAccount; vndPerUsd: number; locale: string}) {
  const router = useRouter();
  const {lines, ready, save} = useCart();
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);
  const reserved = account.status === 'reserved';
  const mode = account.stats?.profile.gameMode;

  function buy() {
    // The account goes into the cart as one unit, then checkout opens. Whatever else is in the cart stays there.
    if (lines.some(line => line.productId === account.id) || save([...lines, {productId: account.id, quantity: 1, delivery: {}}])) router.push(`/${locale}/checkout`);
    else setError('This account is not available right now. Please reload the page.');
  }

  return <div className="sb-page">
    <p className="eyebrow"><Link href={`/${locale}?shelf=accounts#catalog`}>SKYBLOCK ACCOUNTS</Link> / {account.code}</p>
    <div className="sb-top">
      <h1>{account.title}</h1>
      <div className="sb-badges">
        <span className={`badge ${reserved ? 'warn' : 'ok'}`}>{reserved ? 'Reserved' : accountStatusLabels.available}</span>
        {account.profileName && <span className="badge">Profile {account.profileName}</span>}
        {mode && mode !== 'normal' && <span className="badge info">{GAME_MODES[mode] ?? mode}</span>}
        {account.ign && <span className="badge">IGN {account.ign}</span>}
      </div>
      <div className="card sb-buy">
        <div>{account.salePriceVnd && <small className="muted"><del>{formatUsdFromVnd(account.basePriceVnd, vndPerUsd)}</del> </small>}<Price vnd={account.priceVnd} vndPerUsd={vndPerUsd}/></div>
        <button type="button" disabled={reserved || !ready} onClick={buy}>{reserved ? 'Reserved' : 'Buy this account →'}</button>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
      {account.ign && <div className="sb-links"><a href={skyCryptUrl(account.ign, account.profileName)} target="_blank" rel="noreferrer">View on SkyCrypt ↗</a><a href={eliteUrl(account.ign, account.profileName)} target="_blank" rel="noreferrer">Elite ↗</a></div>}
      {account.statsFetchedAt && <p className="sb-fresh">Stats updated {timeAgo(account.statsFetchedAt)}{account.statsSource === 'hypixel' ? ' · from Hypixel' : ''}</p>}
    </div>

    {account.stats ? <AccountStatsView stats={account.stats}/> : <section className="card sb-block"><p className="muted">The detailed stats for this account are coming soon. Ask us in Chat if you want to know more.</p></section>}

    {account.images.length > 0 && <section className="card sb-block" style={{marginTop: 16}}><h2>Screenshots</h2><div className="sb-shots">{account.images.map((path, index) => <button key={path} type="button" aria-label={`Open screenshot ${index + 1}`} onClick={() => setZoom(path)}><img loading="lazy" src={path} alt={`Screenshot ${index + 1} of ${account.title}`}/></button>)}</div></section>}
    {account.description && <section className="card sb-block" style={{marginTop: 16}}><h2>About this account</h2><p className="sb-description">{account.description}</p></section>}
    <p className="card sb-note muted" style={{marginTop: 16}}>Stats are a snapshot from the Hypixel API; the account is delivered with full login details right after payment.</p>
    {zoom && <div className="sb-lightbox" role="dialog" aria-modal="true" aria-label="Screenshot" onClick={() => setZoom(null)}><img src={zoom} alt="Screenshot"/><button type="button" onClick={() => setZoom(null)}>Close</button></div>}
  </div>;
}
