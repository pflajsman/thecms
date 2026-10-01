import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isConfigured } from '../config';
import { shop } from './api';
import { formatPrice } from './money';
import type { QuoteRequest } from './types';

export const quoteKey = (request: QuoteRequest | null) => ['shop', 'quote', request] as const;

export function useShopSettings() {
  return useQuery({ queryKey: ['shop', 'settings'], queryFn: () => shop.settings(), staleTime: 5 * 60_000, enabled: isConfigured });
}

/** Formats minor units with the currency's decimals from the shop settings (2 until they load). */
export function useMoney(): (minor: number, currency: string) => string {
  const settings = useShopSettings();
  return useCallback(
    (minor: number, currency: string) => formatPrice(minor, currency, settings.data?.currencies.find((c) => c.code === currency)?.decimals ?? 2),
    [settings.data],
  );
}

export function useProducts() {
  return useQuery({ queryKey: ['shop', 'products'], queryFn: () => shop.products(), enabled: isConfigured });
}

export function useProduct(id: string | undefined) {
  return useQuery({ queryKey: ['shop', 'product', id], queryFn: () => shop.product(id!), enabled: isConfigured && !!id });
}

export function useCountries() {
  return useQuery({ queryKey: ['shop', 'countries'], queryFn: () => shop.countries(), staleTime: 5 * 60_000, enabled: isConfigured });
}

/** Prices for the cart and the current choices; keeps the previous answer on screen while a new one loads. */
export function useQuote(request: QuoteRequest | null) {
  return useQuery({
    queryKey: quoteKey(request),
    queryFn: () => shop.quote(request!),
    enabled: isConfigured && !!request && request.items.length > 0,
    placeholderData: keepPreviousData,
  });
}

export function useCustomerOrder(number: string, token: string) {
  return useQuery({
    queryKey: ['shop', 'order', number, token],
    queryFn: () => shop.order(number, token),
    enabled: isConfigured && !!number && !!token,
    retry: false,
  });
}

/** The value after it stopped changing for `ms` milliseconds. */
export function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
