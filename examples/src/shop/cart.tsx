import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CartItem } from './types';

export const CART_KEY = 'flajsman.cart.v1';
export const MAX_QUANTITY = 99;
export const MAX_LINES = 50;

const clamp = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.floor(n)));

/** Reads the stored cart; anything unreadable starts an empty cart and bad lines are dropped. */
export function readCart(raw: string | null): CartItem[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .flatMap((value) => {
        const line = value as Partial<CartItem>;
        if (typeof line.variantId !== 'string' || typeof line.productId !== 'string' || !Number.isInteger(line.quantity)) return [];
        return [{ variantId: line.variantId, productId: line.productId, quantity: clamp(line.quantity as number) }];
      })
      .slice(0, MAX_LINES);
  } catch {
    return [];
  }
}

export function withAdded(items: CartItem[], item: CartItem): CartItem[] {
  if (items.some((i) => i.variantId === item.variantId)) {
    return items.map((i) => (i.variantId === item.variantId ? { ...i, quantity: clamp(i.quantity + item.quantity) } : i));
  }
  if (items.length >= MAX_LINES) return items;
  return [...items, { ...item, quantity: clamp(item.quantity) }];
}

export function withQuantity(items: CartItem[], variantId: string, quantity: number): CartItem[] {
  return items.map((i) => (i.variantId === variantId ? { ...i, quantity: clamp(quantity) } : i));
}

export function without(items: CartItem[], variantId: string): CartItem[] {
  return items.filter((i) => i.variantId !== variantId);
}

interface CartValue {
  items: CartItem[];
  /** Total pieces, for the header. */
  count: number;
  /** False when the cart already has 50 different lines. */
  add: (item: CartItem) => boolean;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

function load(): CartItem[] {
  try {
    return readCart(localStorage.getItem(CART_KEY));
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);

  const update = useCallback((change: (current: CartItem[]) => CartItem[]) => {
    setItems((current) => {
      const next = change(current);
      try {
        localStorage.setItem(CART_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked (private mode): the cart lasts for this visit.
      }
      return next;
    });
  }, []);

  // Another tab changed the cart.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_KEY) setItems(readCart(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<CartValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      add: (item) => {
        if (items.length >= MAX_LINES && !items.some((i) => i.variantId === item.variantId)) return false;
        update((current) => withAdded(current, item));
        return true;
      },
      setQuantity: (variantId, quantity) => update((current) => withQuantity(current, variantId, quantity)),
      remove: (variantId) => update((current) => without(current, variantId)),
      clear: () => update(() => []),
    }),
    [items, update],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used inside CartProvider');
  return value;
}
