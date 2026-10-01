import { mockApi, ok } from '../test/api-mock';
import { ApiError } from '../lib/cms';
import { shop } from './api';
import type { OrderRequest } from './types';

const order: OrderRequest = {
  items: [{ variantId: 'v1', quantity: 1 }],
  country: 'CZ',
  paymentMethod: 'BANK_TRANSFER',
  customer: { email: 'jana@example.test', name: 'Jana' },
  billingAddress: { name: 'Jana', street: 'Hlavní 1', city: 'Praha', postalCode: '110 00', country: 'CZ' },
  acceptTerms: true,
  expectedTotal: 1000,
};

it('asks for a quote with the site language and the API key', async () => {
  const api = mockApi({ 'POST /shop/quote': () => ok({ currency: 'CZK' }) });
  await shop.quote({ items: [{ variantId: 'v1', quantity: 2 }], country: 'CZ' });
  const call = api.calls.find((c) => c.key === 'POST /shop/quote')!;
  expect(call.body).toEqual({ items: [{ variantId: 'v1', quantity: 2 }], country: 'CZ', language: 'cs' });
  expect(call.headers.get('X-API-Key')).toBe('test-key');
  expect(call.headers.get('Content-Type')).toBe('application/json');
});

it('sends the idempotency key with an order and exposes the error reason and body', async () => {
  const api = mockApi({
    'POST /shop/orders': () => ({ status: 409, body: { success: false, error: 'Prices changed', reason: 'PRICE_CHANGED', quote: { totals: { total: 1 } } } }),
  });
  const error = await shop.placeOrder(order, 'key-1').catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({ status: 409, reason: 'PRICE_CHANGED', body: { quote: { totals: { total: 1 } } } });
  expect(api.calls[0].headers.get('Idempotency-Key')).toBe('key-1');
});

it('reads products in the site language and an order with its token', async () => {
  const api = mockApi({
    'GET /shop/products': () => ok([{ id: 'p1' }]),
    'GET /shop/orders/:number': () => ok({ number: '2026000001' }),
  });
  expect(await shop.products()).toEqual([{ id: 'p1' }]);
  expect(api.calls[0].url.searchParams.get('language')).toBe('cs');
  expect((await shop.order('2026000001', 'tok')).number).toBe('2026000001');
  expect(api.calls[1].url.searchParams.get('token')).toBe('tok');
});
