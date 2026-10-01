'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import {catalogResponseSchema, fallbackProducts, fallbackVndPerUsd, type CatalogProduct, type CatalogSource} from '@/lib/catalog';

type CatalogState = {products: CatalogProduct[]; ready: boolean; source: CatalogSource; vndPerUsd: number; vndPerLtc: number | null};
const initial: CatalogState = {products: fallbackProducts, ready: false, source: 'demo', vndPerUsd: fallbackVndPerUsd, vndPerLtc: null};
const CatalogContext = createContext<CatalogState>(initial);

export function CatalogProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<CatalogState>(initial);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    fetch('/api/catalog', {cache: 'no-store', signal: controller.signal})
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Catalog unavailable')))
      .then(data => {
        const parsed = catalogResponseSchema.safeParse(data);
        setState(parsed.success ? {...parsed.data, ready: true} : {...initial, source: 'fallback', ready: true});
      })
      .catch(() => setState({...initial, source: 'fallback', ready: true}))
      .finally(() => window.clearTimeout(timer));
    return () => {window.clearTimeout(timer); controller.abort();};
  }, []);
  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {return useContext(CatalogContext);}
