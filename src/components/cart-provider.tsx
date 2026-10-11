'use client';
import {createContext, useContext, useEffect, useState} from 'react';
import {CartLine, createCartSchema} from '@/lib/cart';
import {useCatalog} from './catalog-provider';

const KEY = 'shop-demo-cart-v1';
const Context = createContext<{
  lines: CartLine[]; ready: boolean;
  save: (lines: CartLine[]) => boolean;
} | null>(null);

export function CartProvider({children}: {children: React.ReactNode}) {
  const catalog = useCatalog();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!catalog.ready) return;
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      const parsed = createCartSchema(catalog.purchasable).safeParse(raw);
      if (parsed.success) setLines(parsed.data);
      else {localStorage.removeItem(KEY); setLines([]);}
    } catch {
      localStorage.removeItem(KEY);
      setLines([]);
    }
    setReady(true);
  }, [catalog.ready, catalog.purchasable]);
  function save(next: CartLine[]) {
    const parsed = createCartSchema(catalog.purchasable).safeParse(next);
    if (!parsed.success) return false;
    try {localStorage.setItem(KEY, JSON.stringify(parsed.data));}
    catch {return false;}
    setLines(parsed.data);
    return true;
  }
  return <Context.Provider value={{lines, ready, save}}>{children}</Context.Provider>;
}
export function useCart() {
  const context = useContext(Context);
  if (!context) throw new Error('CartProvider required');
  return context;
}
