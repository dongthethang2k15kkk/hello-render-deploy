'use client';
import {useDeferredValue, useMemo, useState} from 'react';
import type {CatalogProduct} from '@/lib/catalog';
import type {Shelf} from '@/lib/accounts-shelf-rules';
import {ACCOUNT_SORTS, filterAccounts, type AccountSort} from '@/lib/account-view';
import {AccountCardTile} from './account-ui';

/** The "SkyBlock accounts" tab of the store: the Admin's heading and intro, then one card per account. */
export function AccountShelf({accounts, shelf, vndPerUsd, vndPerLtc, locale}: {accounts: CatalogProduct[]; shelf: Shelf; vndPerUsd: number; vndPerLtc: number | null; locale: string}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<AccountSort>('featured');
  const deferred = useDeferredValue(query);
  const shown = useMemo(() => filterAccounts(accounts, deferred, sort), [accounts, deferred, sort]);
  return <div className="shelf" role="tabpanel" aria-label={shelf.accountsTabLabel}>
    <div className="section-heading"><div><p className="eyebrow">ACCOUNTS</p><h2>{shelf.heading || shelf.accountsTabLabel}</h2>{shelf.intro && <p className="muted shelf-intro">{shelf.intro}</p>}</div><span className="pill">Prices in USD</span></div>
    {accounts.length > 4 && <div className="package-tools">
      <label className="package-search"><span className="sr-only">Search accounts</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search accounts..."/></label>
      <label className="package-sort"><span className="sr-only">Sort accounts</span><select aria-label="Sort accounts" value={sort} onChange={event => setSort(event.target.value as AccountSort)}>{ACCOUNT_SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <span className="package-count muted" role="status">{shown.length} of {accounts.length} accounts</span>
    </div>}
    {accounts.length > 0 && !shown.length && <div className="empty-state"><h3>No matching accounts</h3><p className="muted">Try another search.</p><button type="button" className="secondary" onClick={() => setQuery('')}>Clear search</button></div>}
    <div className="sb-grid">{shown.map(product => <AccountCardTile key={product.id} product={product} vndPerUsd={vndPerUsd} vndPerLtc={vndPerLtc} href={`/${locale}/accounts/${product.sku}`}/>)}</div>
  </div>;
}
