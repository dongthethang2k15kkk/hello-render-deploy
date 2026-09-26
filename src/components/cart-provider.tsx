'use client';
import {createContext, useContext, useEffect, useState} from 'react';
import {CartLine, cartSchema} from '@/lib/cart';

const KEY = 'shop-demo-cart-v1';
const Context = createContext<{
  lines: CartLine[]; ready: boolean;
  save: (lines: CartLine[]) => boolean;
} | null>(null);

export function CartProvider({children}: {children: React.ReactNode}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const parsed = cartSchema.safeParse(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
      if (parsed.success) setLines(parsed.data);
    } catch { /* Invalid or unavailable local storage must not break rendering. */ }
    setReady(true);
  }, []);
  function save(next: CartLine[]) {
    const parsed = cartSchema.safeParse(next);
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