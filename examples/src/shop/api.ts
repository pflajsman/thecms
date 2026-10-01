import { config } from '../config';
import { request } from '../lib/cms';
import type { CustomerOrder, OrderRequest, PlacedOrder, Quote, QuoteRequest, ShopProduct, ShopSettings } from './types';

/** Product text and order emails follow the site's content language; empty means the CMS default. */
const language = () => config.contentLanguage || undefined;

export const shop = {
  async settings(): Promise<ShopSettings> {
    return (await request<{ data: ShopSettings }>('/shop/settings')).data;
  },

  async products(): Promise<ShopProduct[]> {
    return (await request<{ data: ShopProduct[] }>('/shop/products', { language: language(), limit: 100 })).data;
  },

  async product(id: string): Promise<ShopProduct> {
    return (await request<{ data: ShopProduct }>(`/shop/products/${encodeURIComponent(id)}`, { language: language() })).data;
  },

  async countries(): Promise<string[]> {
    return (await request<{ data: string[] }>('/shop/shipping-countries')).data;
  },

  async quote(body: QuoteRequest): Promise<Quote> {
    return (await request<{ data: Quote }>('/shop/quote', {}, { method: 'POST', body: { ...body, language: language() } })).data;
  },

  async placeOrder(body: OrderRequest, idempotencyKey: string): Promise<PlacedOrder> {
    const res = await request<{ data: PlacedOrder }>('/shop/orders', {}, {
      method: 'POST',
      body: { ...body, language: language() },
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return res.data;
  },

  async order(number: string, token: string): Promise<CustomerOrder> {
    return (await request<{ data: CustomerOrder }>(`/shop/orders/${encodeURIComponent(number)}`, { token })).data;
  },
};
