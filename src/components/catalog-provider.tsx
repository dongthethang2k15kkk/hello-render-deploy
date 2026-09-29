'use client';

import {createContext, useContext, useEffect, useState} from 'react';
import {catalogResponseSchema, fallbackProducts, type CatalogProduct, type CatalogSource} from '@/lib/catalog';

type CatalogState = {products: CatalogProduct[]; ready: boolean; source: CatalogSource};
const CatalogContext = createContext<CatalogState>({products: fallbackProducts, ready: false, source: 'demo'});

export function CatalogProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<CatalogState>({products: fallbackProducts, ready: false, source: 'demo'});
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 5000);
    fetch('/api/catalog', {cache: 'no-store', signal: controller.signal})
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Catalog unavailable')))
      .then(data => {
        const parsed = catalogResponseSchema.safeParse(data);
        setState(parsed.success ? {...parsed.data, ready: true} : {products: fallbackProducts, source: 'fallback', ready: true});
      })
      .catch(() => setState({products: fallbackProducts, source: 'fallback', ready: true}))
      .finally(() => window.clearTimeout(timer));
    return () => {window.clearTimeout(timer); controller.abort();};
  }, []);
  return <CatalogContext.Provider value={state}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {return useContext(CatalogContext);}
