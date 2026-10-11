'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import {defaultShelf, type Shelf} from '@/lib/accounts-shelf-rules';
import {catalogResponseSchema, fallbackProducts, fallbackVndPerUsd, type CatalogProduct, type CatalogSource} from '@/lib/catalog';
import {loadJson} from '@/lib/client-data-cache';

// `products` are the packages. A cart can also hold a game account, so anything that looks up cart lines uses `purchasable`.
type CatalogState = {products: CatalogProduct[]; accounts: CatalogProduct[]; purchasable: CatalogProduct[]; shelf: Shelf; ready: boolean; source: CatalogSource; vndPerUsd: number; vndPerLtc: number | null};
const initial: CatalogState = {products: fallbackProducts, accounts: [], purchasable: fallbackProducts, shelf: defaultShelf, ready: false, source: 'demo', vndPerUsd: fallbackVndPerUsd, vndPerLtc: null};
const CatalogContext = createContext<CatalogState>(initial);

export function CatalogProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<CatalogState>(initial);
  useEffect(() => {
    // The database can take several seconds to wake after an idle spell (the server itself waits up to 10 s), so wait
    // longer and retry before falling back: with the demo fallback, "Add to cart" would refuse real packages.
    let cancelled = false;
    async function load(attempt: number): Promise<void> {
      try {
        const response = await loadJson<unknown>('/api/catalog', {maxAgeMs: 60_000, force: attempt > 0, timeoutMs: 12_000});
        const parsed = catalogResponseSchema.safeParse(response.ok ? response.data : null);
        if (!parsed.success || parsed.data.source === 'fallback') throw new Error('Catalog unavailable');
        if (!cancelled) setState({...parsed.data, purchasable: [...parsed.data.products, ...parsed.data.accounts], ready: true});
      } catch {
        if (cancelled) return;
        if (attempt < 2) { await new Promise(resolve => window.setTimeout(resolve, 1500)); return load(attempt + 1); }
        setState({...initial, source: 'fallback', ready: true});
      } finally { /* the shared request owns its timeout */ }
    }
    void load(0);
    return () => { cancelled = true; };
  }, []);
  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {return useContext(CatalogContext);}
