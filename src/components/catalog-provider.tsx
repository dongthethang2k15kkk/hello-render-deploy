'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import {catalogResponseSchema, fallbackProducts, fallbackVndPerUsd, type CatalogProduct, type CatalogSource} from '@/lib/catalog';

type CatalogState = {products: CatalogProduct[]; ready: boolean; source: CatalogSource; vndPerUsd: number; vndPerLtc: number | null};
const initial: CatalogState = {products: fallbackProducts, ready: false, source: 'demo', vndPerUsd: fallbackVndPerUsd, vndPerLtc: null};
const CatalogContext = createContext<CatalogState>(initial);

export function CatalogProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<CatalogState>(initial);
  useEffect(() => {
    // The database can take several seconds to wake after an idle spell (the server itself waits up to 10 s), so wait
    // longer and retry before falling back: with the demo fallback, "Add to cart" would refuse real packages.
    let cancelled = false;
    let controller: AbortController | null = null;
    async function load(attempt: number): Promise<void> {
      controller = new AbortController();
      const timer = window.setTimeout(() => controller?.abort(), 12000);
      try {
        const response = await fetch('/api/catalog', {cache: 'no-store', signal: controller.signal});
        const parsed = catalogResponseSchema.safeParse(response.ok ? await response.json() : null);
        if (!parsed.success || parsed.data.source === 'fallback') throw new Error('Catalog unavailable');
        if (!cancelled) setState({...parsed.data, ready: true});
      } catch {
        if (cancelled) return;
        if (attempt < 2) { await new Promise(resolve => window.setTimeout(resolve, 1500)); return load(attempt + 1); }
        setState({...initial, source: 'fallback', ready: true});
      } finally { window.clearTimeout(timer); }
    }
    void load(0);
    return () => { cancelled = true; controller?.abort(); };
  }, []);
  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {return useContext(CatalogContext);}
