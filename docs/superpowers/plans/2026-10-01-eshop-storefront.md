# E-shop Storefront on flajsman.cz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers can buy on flajsman.cz: product list and detail, a browser cart, a one-page checkout against the TheCMS public shop API, and an order page with bank transfer details and a payment QR code.

**Architecture:** A `src/shop` area inside the existing `examples` site (package `blog-flajsman`): a typed API client on the site's `request` helper, pure helpers (money, cart operations, product rules, checkout form), a cart context saved to localStorage, React Query hooks, and pages wired into the existing router and layout. The example site gets its first tests (Vitest, Testing Library, jsdom) with a fetch mock keyed by route.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, plain CSS in `src/styles/global.css`, `qrcode`, Vitest 5, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-10-01-eshop-storefront-design.md`

## Global Constraints

- Scope is `examples` only: no backend or admin changes.
- All customer-facing copy is Czech; product text comes in the site's `contentLanguage`; no currency parameter is sent (the shop's default currency is used).
- Public API: base `config.apiUrl`, header `X-API-Key: config.apiKey`; endpoints `GET /shop/settings`, `GET /shop/products`, `GET /shop/products/:id`, `GET /shop/shipping-countries`, `POST /shop/quote`, `POST /shop/orders` (header `Idempotency-Key`), `GET /shop/orders/:number?token=`; error bodies are `{ success: false, error, reason?, ... }`.
- API limits: 1 to 50 items, quantity 1 to 99; customer email up to 200, name up to 100, phone up to 30; address name up to 100, company up to 100, street up to 200, city up to 100, postal code up to 20, VAT ID up to 30; note up to 1000.
- Cart key `flajsman.cart.v1`; checkout key `flajsman.checkout.key` in sessionStorage.
- Every page works at 360px with no horizontal scroll; form fields have labels; errors are tied to their fields with `aria-describedby` and `aria-invalid`.
- Code style of the site: TypeScript strict with `erasableSyntaxOnly` (no parameter properties, no enums), semicolons, single quotes, 2-space indent.
- Run `pnpm --filter blog-flajsman test` and `pnpm --filter blog-flajsman build` at the end of every task.
- Never use an em dash in code, copy or docs.

## Decisions (for the reviewer)

1. **Prices never live in the cart.** Every price on screen comes from a quote; the order sends the last quote's total as `expectedTotal`, so the server catches any change.
2. **Shipping and payment auto-select the first valid option** whenever the current choice stops being valid (a new country, a shipping method without cash on delivery). The summary always shows what will be charged.
3. **Countries come from `/shop/shipping-countries`; when the list is empty (a digital-only shop) the site offers CZ.**
4. **One `Idempotency-Key` per checkout attempt**, kept in sessionStorage (in memory when storage is blocked) and dropped only after success or a `422 IDEMPOTENCY_KEY_REUSED`.
5. **The terms checkbox is always shown and required**, because the public settings do not expose `termsUrl` (spec decision).

## Review Focus

1. **A double click on "Objednat s povinností platby", or a retry after the network dropped**: exactly one order; both requests carry the same `Idempotency-Key`. Tested in Task 5.
2. **Prices change between the cart and the order**: the summary switches to the new prices with a Czech message, nothing is ordered, and the next click sends the new total. Tested in Task 5.
3. **Stock drops below the cart quantity**: the cart shows "Skladem jen N ks" with "Snížit na N" and blocks checkout until fixed; checkout shows the same block. Tested in Tasks 4 and 5.
4. **The stored cart is broken JSON, from an older format, or changed in another tab**: the site starts empty or follows the other tab, never crashes. Tested in Task 2.
5. **The order page opened with a wrong or missing token**: "Objednávka nenalezena" and no order details. Tested in Task 6.

---

## File Structure

All paths relative to `examples/`.

| File | Responsibility |
|---|---|
| `package.json`, `vite.config.ts`, `tsconfig.app.json` | Test tooling, `qrcode` |
| `src/test/setup.ts`, `src/test/api-mock.ts`, `src/test/render.tsx`, `src/test/shop-fixtures.ts` | Test setup, fetch mock, render helper, shop fixtures |
| `src/lib/cms.ts` | `request` gains POST and headers; `ApiError` with status, body and reason |
| `src/lib/format.ts` | `plural` |
| `src/shop/types.ts` | Public shop API shapes |
| `src/shop/api.ts` | Shop client |
| `src/shop/money.ts` | `formatPrice` |
| `src/shop/errors.ts` | Server answers to Czech checkout messages |
| `src/shop/cart.tsx` | Cart operations, storage, context |
| `src/shop/product.ts` | Name, images, variant choice, limits |
| `src/shop/hooks.ts` | React Query hooks, `useMoney`, `useDebounced` |
| `src/shop/checkout-form.ts` | Form state, validation, quote and order bodies, idempotency key |
| `src/shop/components/CartLink.tsx`, `ProductImage.tsx`, `Summary.tsx`, `PaymentQr.tsx` | Shared parts |
| `src/shop/pages/ShopPage.tsx`, `ProductPage.tsx`, `CartPage.tsx`, `CheckoutPage.tsx`, `OrderPage.tsx`, `TermsPage.tsx` | Pages |
| `src/App.tsx`, `src/main.tsx`, `src/components/Header.tsx` | Routes, cart provider, nav |
| `src/styles/global.css` | Shop styles |
| `../.github/workflows/example-website-ci-cd.yml`, `README.md` | Tests in CI, docs |

---

### Task 1: Test tooling, API client and money

**Files:**
- Modify: `examples/package.json`, `examples/vite.config.ts`, `examples/tsconfig.app.json`, `examples/src/lib/cms.ts`
- Create: `examples/src/test/setup.ts`, `examples/src/test/api-mock.ts`, `examples/src/shop/types.ts`, `examples/src/shop/api.ts`, `examples/src/shop/money.ts`, `examples/src/shop/errors.ts`
- Test: `examples/src/shop/api.test.ts`, `examples/src/shop/money.test.ts`, `examples/src/shop/errors.test.ts`

**Interfaces:**
- Produces: `ApiError` (`status: number`, `body: Record<string, unknown>`, getter `reason`), `request<T>(endpoint, params?, options?: { method?, body?, headers? })`; `mockApi(routes)` returning `{ calls: { key, url, body, headers }[] }`, `ok(data, status?)`; all types in `src/shop/types.ts`; `shop.settings()`, `shop.products()`, `shop.product(id)`, `shop.countries()`, `shop.quote(body)`, `shop.placeOrder(body, key)`, `shop.order(number, token)`; `formatPrice(minor, currency, decimals?)`; `checkoutProblem(error): CheckoutProblem` with `section: 'cart' | 'shipping' | 'payment' | 'terms' | 'form'`, `text`, `retryWithNewKey?`.

- [ ] **Step 1: Add the test tooling**

Run: `pnpm --filter blog-flajsman add -D vitest@^5.0.2 jsdom@^30.1.1 @testing-library/react@^16.3.3 @testing-library/user-event@^14.6.7 @testing-library/jest-dom@^7.0.1`
Expected: installs without errors.

In `examples/package.json` scripts, add `"test": "vitest run"`.

Replace `examples/vite.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
```

In `examples/tsconfig.app.json`, change `"types": ["vite/client"]` to `"types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]`.

Create `examples/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// config.ts reads this when it is first imported, so it is set before any test imports the app.
window.__CMS_CONFIG__ = { apiUrl: 'http://cms.test/api/v1/public', apiKey: 'test-key', contentLanguage: 'cs' };

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});
```

Create `examples/src/test/api-mock.ts`:

```ts
import { vi } from 'vitest';

export interface MockResult {
  status?: number;
  body: unknown;
}
type Handler = (body: never, url: URL) => MockResult | Promise<MockResult>;

export const ok = (data: unknown, status = 200): MockResult => ({ status, body: { success: true, data } });

const defaults: Record<string, Handler> = {
  'GET /shop/settings': () => ok({ currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK' }),
};

function matches(pattern: string, key: string): boolean {
  return new RegExp(`^${pattern.replace(/:[^/\s]+/g, '[^/]+')}$`).test(key);
}

/** Replaces fetch with handlers keyed by "METHOD /path" (the path after the public API prefix). A handler may throw to simulate a network failure. */
export function mockApi(routes: Record<string, Handler>) {
  const all = { ...defaults, ...routes };
  const calls: { key: string; url: URL; body: unknown; headers: Headers }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    const key = `${(init.method ?? 'GET').toUpperCase()} ${url.pathname.replace('/api/v1/public', '')}`;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, url, body, headers: new Headers(init.headers) });
    const handler = all[key] ?? Object.entries(all).find(([pattern]) => matches(pattern, key))?.[1];
    if (!handler) return new Response(JSON.stringify({ success: false, error: `no mock for ${key}` }), { status: 500 });
    const result = await handler(body as never, url);
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { calls };
}
```

- [ ] **Step 2: Write the failing tests**

Create `examples/src/shop/money.test.ts`:

```ts
import { formatPrice } from './money';

const plain = (s: string) => s.replace(/\s/g, ' ');

it('shows whole crowns without decimals and hundredths when there are some', () => {
  expect(plain(formatPrice(129000, 'CZK'))).toBe('1 290 Kč');
  expect(plain(formatPrice(12950, 'CZK'))).toBe('129,50 Kč');
  expect(plain(formatPrice(0, 'CZK'))).toBe('0 Kč');
});

it('uses the currency decimals', () => {
  expect(plain(formatPrice(1290, 'CZK', 0))).toBe('1 290 Kč');
  expect(plain(formatPrice(2050, 'EUR'))).toBe('20,50 €');
});
```

Create `examples/src/shop/api.test.ts`:

```ts
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
```

Create `examples/src/shop/errors.test.ts`:

```ts
import { ApiError } from '../lib/cms';
import { checkoutProblem } from './errors';

const apiError = (status: number, reason?: string) => new ApiError('x', status, reason ? { reason } : {});

it('maps server reasons to Czech messages at the right section', () => {
  expect(checkoutProblem(apiError(409, 'PRICE_CHANGED'))).toMatchObject({ section: 'form', text: expect.stringContaining('Ceny se mezitím změnily') });
  expect(checkoutProblem(apiError(409, 'OUT_OF_STOCK')).section).toBe('cart');
  expect(checkoutProblem(apiError(400, 'NO_SHIPPING')).section).toBe('shipping');
  expect(checkoutProblem(apiError(400, 'PAYMENT_NOT_ALLOWED')).section).toBe('payment');
  expect(checkoutProblem(apiError(400, 'TERMS')).section).toBe('terms');
  expect(checkoutProblem(apiError(422, 'IDEMPOTENCY_KEY_REUSED'))).toMatchObject({ retryWithNewKey: true });
});

it('explains rate limits, unknown errors and network failures', () => {
  expect(checkoutProblem(apiError(429)).text).toContain('za minutu');
  expect(checkoutProblem(apiError(500)).text).toContain('Objednávku se nepodařilo odeslat');
  expect(checkoutProblem(new TypeError('Failed to fetch')).text).toContain('Nepodařilo se spojit se serverem');
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter blog-flajsman test`
Expected: FAIL, the modules `./money`, `./api`, `./errors` and the `ApiError` export do not exist.

- [ ] **Step 4: Implement the client, types, money and messages**

In `examples/src/lib/cms.ts`, replace the `request` function (from its doc comment `/** Low-level fetch against the TheCMS public API. */` to its closing brace) with:

```ts
/** A non-2xx answer from the API, with the error body (for example `reason: 'PRICE_CHANGED'`). */
export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(message: string, status: number, body: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }

  get reason(): string | undefined {
    return typeof this.body.reason === 'string' ? this.body.reason : undefined;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  headers?: Record<string, string>;
}

/** Low-level fetch against the TheCMS public API. */
export async function request<T>(endpoint: string, params: Record<string, unknown> = {}, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${config.apiUrl}${endpoint}`);
  // Content requests ask for the configured language; the CMS falls back to its default language.
  const all = endpoint.startsWith('/content/') ? { language: config.contentLanguage, ...params } : params;
  for (const [k, v] of Object.entries(all)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }

  const headers: Record<string, string> = { 'X-API-Key': config.apiKey, ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new ApiError(typeof body.error === 'string' ? body.error : `API error ${res.status}`, res.status, body);
  }
  return res.json() as Promise<T>;
}
```

Create `examples/src/shop/types.ts`:

```ts
/** Shapes of the TheCMS public shop API (/public/shop/*). Money is in minor units. */

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_DELIVERY';
export type ProductType = 'PHYSICAL' | 'DIGITAL';

export interface ShopSettings {
  currencies: { code: string; decimals: number }[];
  defaultCurrency?: string;
}

export interface ShopVariant {
  id: string;
  sku: string;
  optionValues: Record<string, string>;
  price: number;
  vatRate: number;
  available: boolean;
  /** null when stock is not tracked. */
  availableQuantity: number | null;
}

export interface ShopProduct {
  id: string;
  type: ProductType;
  itemId: string;
  currency: string;
  /** The linked content entry; `data` has name, description and images. */
  content: { data: Record<string, unknown> };
  options: { key: string; label: string; values: { key: string; label: string }[] }[];
  variants: ShopVariant[];
  priceRange: { min: number; max: number } | null;
}

export interface CartItem {
  variantId: string;
  productId: string;
  quantity: number;
}

export type LineProblem = 'NOT_FOR_SALE' | 'NO_PRICE' | 'OUT_OF_STOCK' | 'NOT_ENOUGH_STOCK';

export interface OptionLabel {
  option: string;
  value: string;
}

export interface QuoteLine {
  variantId: string;
  productId: string;
  type: ProductType;
  name: string;
  optionLabels: OptionLabel[];
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  problem?: LineProblem;
  availableQuantity?: number | null;
}

export interface ShippingOption {
  id: string;
  name: string;
  price: number;
  paymentMethods: { method: PaymentMethod; fee: number }[];
}

export interface Totals {
  items: number;
  shipping: number;
  paymentFee: number;
  total: number;
  vat: { rate: number; base: number; amount: number }[];
}

export interface Quote {
  currency: string;
  lines: QuoteLine[];
  hasPhysical: boolean;
  hasDigital: boolean;
  shippingOptions: ShippingOption[];
  shipping: { methodId: string; name: string; price: number } | null;
  payment: { method: PaymentMethod; fee: number } | null;
  totals: Totals;
  /** 'LINES', 'NO_SHIPPING', 'SHIPPING_REQUIRED', 'PAYMENT_NOT_ALLOWED' */
  problems: string[];
}

export interface QuoteRequest {
  items: { variantId: string; quantity: number }[];
  country?: string;
  shippingMethodId?: string;
  paymentMethod?: PaymentMethod;
}

export interface Address {
  name: string;
  company?: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  vatId?: string;
}

export interface OrderRequest extends QuoteRequest {
  customer: { email: string; name: string; phone?: string };
  billingAddress: Address;
  shippingAddress?: Address;
  note?: string;
  acceptTerms: boolean;
  expectedTotal: number;
}

export interface PaymentInstructions {
  holder: string;
  accountNumber?: string;
  iban?: string;
  bic?: string;
  amount: number;
  currency: string;
  reference: string;
  /** SPD payment string for the QR code; present when the account has an IBAN. */
  qr?: string;
}

export interface PlacedOrder {
  number: string;
  accessToken: string;
  total: number;
  currency: string;
  payment: { method: PaymentMethod; instructions?: PaymentInstructions };
}

export interface CustomerOrder {
  number: string;
  createdAt: string;
  status: 'PLACED' | 'COMPLETED' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PAID' | 'REFUNDED';
  fulfilmentStatus: 'UNFULFILLED' | 'SHIPPED';
  currency: string;
  lines: { name: string; optionLabels: OptionLabel[]; quantity: number; unitPrice: number; lineTotal: number; type: ProductType }[];
  shipping: { name: string; price: number } | null;
  payment: { method: PaymentMethod; fee: number; instructions?: PaymentInstructions };
  totals: Totals;
  tracking?: { number?: string; url?: string };
}
```

Create `examples/src/shop/api.ts`:

```ts
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
```

Create `examples/src/shop/money.ts`:

```ts
/** Minor units to Czech money text: "1 290 Kč", or "129,50 Kč" when there are hundredths. */
export function formatPrice(minor: number, currency: string, decimals = 2): string {
  const value = minor / 10 ** decimals;
  const fraction = Number.isInteger(value) ? 0 : decimals;
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(value);
}
```

Create `examples/src/shop/errors.ts`:

```ts
import { ApiError } from '../lib/cms';

export type CheckoutSection = 'cart' | 'shipping' | 'payment' | 'terms' | 'form';

export interface CheckoutProblem {
  section: CheckoutSection;
  text: string;
  /** The idempotency key was used for a different order: start over with a new one. */
  retryWithNewKey?: boolean;
}

// The server's messages are English; known reasons get Czech text.
const BY_REASON: Record<string, CheckoutProblem> = {
  PRICE_CHANGED: { section: 'form', text: 'Ceny se mezitím změnily. Zkontrolujte prosím souhrn a objednejte znovu.' },
  OUT_OF_STOCK: { section: 'cart', text: 'Některé zboží už není skladem v požadovaném množství.' },
  LINES: { section: 'cart', text: 'Některé zboží už nelze objednat.' },
  NO_SHIPPING: { section: 'shipping', text: 'Do této země bohužel nedoručujeme.' },
  SHIPPING_REQUIRED: { section: 'shipping', text: 'Vyberte prosím dopravu.' },
  PAYMENT_NOT_ALLOWED: { section: 'payment', text: 'Tento způsob platby není pro vybranou dopravu dostupný.' },
  PAYMENT_REQUIRED: { section: 'payment', text: 'Vyberte prosím způsob platby.' },
  TERMS: { section: 'terms', text: 'Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.' },
  IDEMPOTENCY_KEY_REUSED: { section: 'form', text: 'Zkuste to prosím znovu.', retryWithNewKey: true },
};

/** What the checkout shows for a failed order request. */
export function checkoutProblem(error: unknown): CheckoutProblem {
  if (error instanceof ApiError) {
    const known = error.reason ? BY_REASON[error.reason] : undefined;
    if (known) return known;
    if (error.status === 429) return { section: 'form', text: 'Příliš mnoho pokusů, zkuste to prosím za minutu.' };
    return { section: 'form', text: 'Objednávku se nepodařilo odeslat. Zkuste to prosím znovu.' };
  }
  return { section: 'form', text: 'Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.' };
}
```

- [ ] **Step 5: Run the tests and the build**

Run: `pnpm --filter blog-flajsman test && pnpm --filter blog-flajsman build`
Expected: 7 tests pass; the build succeeds (the blog pages still compile with the new `request`).

- [ ] **Step 6: Commit**

```bash
git add examples pnpm-lock.yaml
git commit -m "feat(examples): test tooling, shop API client and money format"
```

---

### Task 2: Cart

**Files:**
- Create: `examples/src/shop/cart.tsx`, `examples/src/shop/components/CartLink.tsx`, `examples/src/test/render.tsx`
- Modify: `examples/src/lib/format.ts`, `examples/src/main.tsx`, `examples/src/components/Header.tsx`, `examples/src/styles/global.css`
- Test: `examples/src/shop/cart.test.tsx`

**Interfaces:**
- Consumes: `CartItem` (Task 1).
- Produces: `CART_KEY`, `MAX_QUANTITY` (99), `MAX_LINES` (50), `readCart(raw)`, `withAdded(items, item)`, `withQuantity(items, variantId, quantity)`, `without(items, variantId)`; `CartProvider`; `useCart()` returning `{ items, count, add(item): boolean, setQuantity(variantId, quantity), remove(variantId), clear() }`; `CartLink`; `plural(n, one, few, many)`; `renderRoutes(routes, route)` (QueryClient with `retry: false`, `CartProvider`, memory router).

- [ ] **Step 1: Write the failing tests**

Create `examples/src/shop/cart.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CART_KEY, CartProvider, MAX_LINES, readCart, useCart, withAdded, withQuantity, without } from './cart';
import { CartLink } from './components/CartLink';

const item = (variantId: string, quantity = 1) => ({ variantId, productId: 'p1', quantity });

it('merges a repeated variant and keeps quantities within 1 to 99', () => {
  expect(withAdded([item('a', 2)], item('a', 3))).toEqual([item('a', 5)]);
  expect(withAdded([item('a', 98)], item('a', 5))).toEqual([item('a', 99)]);
  expect(withQuantity([item('a', 2)], 'a', 0)).toEqual([item('a', 1)]);
  expect(without([item('a'), item('b')], 'a')).toEqual([item('b')]);
});

it('refuses a 51st line', () => {
  const full = Array.from({ length: MAX_LINES }, (_, i) => item(`v${i}`));
  expect(withAdded(full, item('extra'))).toBe(full);
});

it('starts empty from broken or foreign storage and drops bad lines', () => {
  expect(readCart('{oops')).toEqual([]);
  expect(readCart('{"a":1}')).toEqual([]);
  expect(readCart(null)).toEqual([]);
  expect(readCart(JSON.stringify([item('a', 500), { variantId: 'b' }, item('c', 0)]))).toEqual([item('a', 99), item('c', 1)]);
});

function Probe() {
  const cart = useCart();
  return (
    <>
      <MemoryRouter>
        <CartLink />
      </MemoryRouter>
      <button onClick={() => cart.add(item('a', 2))}>add</button>
    </>
  );
}

it('saves the cart, shows the count and follows changes from another tab', async () => {
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
  expect(screen.getByRole('link', { name: 'Košík, prázdný' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'add' }));
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([item('a', 2)]);
  expect(screen.getByRole('link', { name: 'Košík, 2 položky' })).toBeInTheDocument();
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: CART_KEY, newValue: JSON.stringify([item('a', 2), item('b', 3)]) }));
  });
  expect(screen.getByRole('link', { name: 'Košík, 5 položek' })).toBeInTheDocument();
});

it('reads a cart saved earlier', () => {
  localStorage.setItem(CART_KEY, JSON.stringify([item('a', 1)]));
  render(
    <CartProvider>
      <Probe />
    </CartProvider>,
  );
  expect(screen.getByRole('link', { name: 'Košík, 1 položka' })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter blog-flajsman test -- src/shop/cart.test.tsx`
Expected: FAIL, `./cart` does not exist.

- [ ] **Step 3: Implement the cart, the link and the render helper**

Append to `examples/src/lib/format.ts`:

```ts
/** Czech plural: 1 položka, 2 to 4 položky, 0 or 5 and more položek. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
```

Create `examples/src/shop/cart.tsx`:

```tsx
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
```

Create `examples/src/shop/components/CartLink.tsx`:

```tsx
import { NavLink } from 'react-router-dom';
import { plural } from '../../lib/format';
import { useCart } from '../cart';

export function CartLink() {
  const { count } = useCart();
  const label = count ? `Košík, ${count} ${plural(count, 'položka', 'položky', 'položek')}` : 'Košík, prázdný';
  return (
    <NavLink to="/kosik" className="cart-link" aria-label={label}>
      košík
      {count > 0 && (
        <span className="cart-count" aria-hidden="true">
          {count}
        </span>
      )}
    </NavLink>
  );
}
```

Create `examples/src/test/render.tsx`:

```tsx
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { CartProvider } from '../shop/cart';

/** Renders routes with a fresh query client (no retries) and a cart read from localStorage. */
export function renderRoutes(routes: RouteObject[], route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </QueryClientProvider>,
  );
  return { ...result, router, queryClient };
}
```

In `examples/src/main.tsx`, import `CartProvider` from `./shop/cart` and wrap `<App />`:

```tsx
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        <App />
      </CartProvider>
    </QueryClientProvider>
```

In `examples/src/components/Header.tsx`, import `CartLink` from `../shop/components/CartLink`; in the nav add `<NavLink to="/obchod">obchod</NavLink>` after the "na kole" link; and put `<CartLink />` between the closing `</nav>` and the toggle `<button>`.

Append to `examples/src/styles/global.css`:

```css
/* =====================================================================
   Shop
   ===================================================================== */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.cart-link {
  font-family: var(--font-mono);
  font-size: 0.82rem;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cart-link:hover,
.cart-link.active {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 3px;
}
.cart-count {
  background: var(--accent);
  color: var(--accent-ink);
  border-radius: 999px;
  min-width: 22px;
  padding: 0 6px;
  text-align: center;
  font-size: 0.75rem;
  line-height: 22px;
}
@media (max-width: 820px) {
  .cart-link {
    margin-left: auto;
    margin-right: 12px;
  }
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `pnpm --filter blog-flajsman test && pnpm --filter blog-flajsman build`
Expected: all tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add examples
git commit -m "feat(examples): cart with storage, tab sync and header link"
```

---

### Task 3: Product list and detail

**Files:**
- Create: `examples/src/shop/product.ts`, `examples/src/shop/hooks.ts`, `examples/src/shop/components/ProductImage.tsx`, `examples/src/shop/pages/ShopPage.tsx`, `examples/src/shop/pages/ProductPage.tsx`, `examples/src/test/shop-fixtures.ts`
- Modify: `examples/src/App.tsx`, `examples/src/styles/global.css`
- Test: `examples/src/shop/pages/ShopPage.test.tsx`, `examples/src/shop/pages/ProductPage.test.tsx`

**Interfaces:**
- Consumes: `shop` (Task 1), `useCart` (Task 2), `useMedia` from `src/hooks/usePosts`, `RichText`, `Spinner`, `ErrorState`.
- Produces: `productName`, `productDescription`, `productImages`, `isSoldOut`, `findVariant`, `initialChoice`, `maxQuantity`; hooks `useShopSettings`, `useMoney(): (minor, currency) => string`, `useProducts`, `useProduct(id)`, `useCountries`, `useQuote(request | null)`, `quoteKey(request)`, `useCustomerOrder(number, token)`, `useDebounced(value, ms)`; `ProductImage({ mediaRef?, alt, className? })`; fixtures `tee`, `guide` (`ShopProduct`).

- [ ] **Step 1: Write the failing tests**

Create `examples/src/test/shop-fixtures.ts`:

```ts
import type { ShopProduct } from '../shop/types';

export const tee: ShopProduct = {
  id: 'p-tee',
  type: 'PHYSICAL',
  itemId: 'i-tee',
  currency: 'CZK',
  content: { data: { name: 'Cyklistické tričko', description: '<p>Merino vlna</p>', images: [] } },
  options: [{ key: 'size', label: 'Velikost', values: [{ key: 's', label: 'S' }, { key: 'm', label: 'M' }] }],
  variants: [
    { id: 'v-tee-s', sku: 'TEE-S', optionValues: { size: 's' }, price: 49000, vatRate: 2100, available: true, availableQuantity: 3 },
    { id: 'v-tee-m', sku: 'TEE-M', optionValues: { size: 'm' }, price: 52000, vatRate: 2100, available: false, availableQuantity: 0 },
  ],
  priceRange: { min: 49000, max: 52000 },
};

export const guide: ShopProduct = {
  id: 'p-guide',
  type: 'DIGITAL',
  itemId: 'i-guide',
  currency: 'CZK',
  content: { data: { name: 'Průvodce Šumavou', description: '', images: [] } },
  options: [],
  variants: [{ id: 'v-guide', sku: 'GUIDE', optionValues: {}, price: 29900, vatRate: 1200, available: true, availableQuantity: null }],
  priceRange: { min: 29900, max: 29900 },
};
```

Create `examples/src/shop/pages/ShopPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { guide, tee } from '../../test/shop-fixtures';
import { ShopPage } from './ShopPage';

const routes = [{ path: '/obchod', element: <ShopPage /> }];

it('lists products with a price range and marks sold-out ones', async () => {
  const soldOutGuide = { ...guide, variants: [{ ...guide.variants[0], available: false }] };
  mockApi({ 'GET /shop/products': () => ok([tee, soldOutGuide]) });
  renderRoutes(routes, '/obchod');
  const teeLink = await screen.findByRole('link', { name: /Cyklistické tričko/ });
  expect(teeLink).toHaveAttribute('href', '/obchod/p-tee');
  expect(teeLink).toHaveTextContent(/od 490\sKč/);
  const guideLink = screen.getByRole('link', { name: /Průvodce Šumavou/ });
  expect(guideLink).toHaveTextContent(/299\sKč/);
  expect(guideLink).toHaveTextContent('vyprodáno');
  expect(teeLink).not.toHaveTextContent('vyprodáno');
});

it('says when there is nothing for sale', async () => {
  mockApi({ 'GET /shop/products': () => ok([]) });
  renderRoutes(routes, '/obchod');
  expect(await screen.findByText('Zatím tu nic není.')).toBeInTheDocument();
});
```

Create `examples/src/shop/pages/ProductPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { guide, tee } from '../../test/shop-fixtures';
import { CART_KEY } from '../cart';
import { ProductPage } from './ProductPage';

const routes = [{ path: '/obchod/:id', element: <ProductPage /> }];

it('opens on an available size and shows price and stock for the chosen one', async () => {
  mockApi({ 'GET /shop/products/:id': () => ok(tee) });
  renderRoutes(routes, '/obchod/p-tee');
  expect(await screen.findByRole('heading', { name: 'Cyklistické tričko' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'S' })).toBeChecked();
  expect(screen.getByText(/^490\sKč$/)).toBeInTheDocument();
  expect(screen.getByText('Skladem posledních 3 ks')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'M' }));
  expect(screen.getByText(/^520\sKč$/)).toBeInTheDocument();
  expect(screen.getByText('Vyprodáno')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Do košíku' })).toBeDisabled();
});

it('adds the chosen quantity to the cart and refuses more than the stock', async () => {
  mockApi({ 'GET /shop/products/:id': () => ok(tee) });
  renderRoutes(routes, '/obchod/p-tee');
  const quantity = await screen.findByLabelText('Počet');
  await userEvent.clear(quantity);
  await userEvent.type(quantity, '4');
  expect(screen.getByText('Zadejte počet od 1 do 3.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Do košíku' })).toBeDisabled();
  await userEvent.clear(quantity);
  await userEvent.type(quantity, '2');
  await userEvent.click(screen.getByRole('button', { name: 'Do košíku' }));
  expect(screen.getByRole('status')).toHaveTextContent('Přidáno do košíku.');
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 2 }]);
});

it('tells that a digital product is downloaded after payment', async () => {
  mockApi({ 'GET /shop/products/:id': () => ok(guide) });
  renderRoutes(routes, '/obchod/p-guide');
  expect(await screen.findByText('Ke stažení po zaplacení')).toBeInTheDocument();
});

it('says when the product does not exist', async () => {
  mockApi({ 'GET /shop/products/:id': () => ({ status: 404, body: { success: false, error: 'Product not found' } }) });
  renderRoutes(routes, '/obchod/nope');
  expect(await screen.findByText('Produkt nenalezen.')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter blog-flajsman test -- src/shop/pages`
Expected: FAIL, the pages do not exist.

- [ ] **Step 3: Implement the helpers and hooks**

Create `examples/src/shop/product.ts`:

```ts
import type { ShopProduct, ShopVariant } from './types';

const text = (v: unknown) => (typeof v === 'string' ? v : '');

export function productName(p: ShopProduct): string {
  return text(p.content?.data?.name) || 'Bez názvu';
}

export function productDescription(p: ShopProduct): string {
  return text(p.content?.data?.description);
}

/** Media ids (or URLs) of the product's images, in order. */
export function productImages(p: ShopProduct): string[] {
  const value = p.content?.data?.images;
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return typeof value === 'string' && value ? [value] : [];
}

export function isSoldOut(p: ShopProduct): boolean {
  return p.variants.every((v) => !v.available);
}

/** The variant matching every chosen option value. */
export function findVariant(p: ShopProduct, chosen: Record<string, string>): ShopVariant | undefined {
  return p.variants.find((v) => p.options.every((o) => v.optionValues[o.key] === chosen[o.key]));
}

/** Opens the page on the first variant that can be bought. */
export function initialChoice(p: ShopProduct): Record<string, string> {
  const variant = p.variants.find((v) => v.available) ?? p.variants[0];
  return variant ? { ...variant.optionValues } : {};
}

/** Most pieces that can go in the cart at once: 99, or the stock when it is tracked. */
export function maxQuantity(v: ShopVariant): number {
  return Math.max(0, Math.min(99, v.availableQuantity ?? 99));
}
```

Create `examples/src/shop/hooks.ts`:

```ts
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
```

Create `examples/src/shop/components/ProductImage.tsx`:

```tsx
import { useMedia } from '../../hooks/usePosts';

/** A product image from a media id or URL; a grey box until it loads or when there is none. */
export function ProductImage({ mediaRef, alt, className = '' }: { mediaRef?: string; alt: string; className?: string }) {
  const media = useMedia(mediaRef);
  if (!mediaRef || !media.data) return <div className={`product-image placeholder ${className}`} aria-hidden="true" />;
  return <img className={`product-image ${className}`} src={media.data.url} alt={alt} loading="lazy" />;
}
```

- [ ] **Step 4: Implement the pages and routes**

Create `examples/src/shop/pages/ShopPage.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { useMoney, useProducts } from '../hooks';
import { isSoldOut, productImages, productName } from '../product';
import { ProductImage } from '../components/ProductImage';
import type { ShopProduct } from '../types';

export function ShopPage() {
  const products = useProducts();
  const money = useMoney();
  const price = (p: ShopProduct) => {
    if (!p.priceRange) return '';
    const { min, max } = p.priceRange;
    return min === max ? money(min, p.currency) : `od ${money(min, p.currency)}`;
  };

  return (
    <section className="article">
      <div className="container-wide">
        <div className="kicker">obchod</div>
        <h1>Obchod</h1>
        {products.isLoading && <Spinner />}
        {products.isError && <ErrorState message="Obchod se nepodařilo načíst." />}
        {products.data && products.data.length === 0 && <ErrorState message="Zatím tu nic není." />}
        {products.data && products.data.length > 0 && (
          <ul className="product-grid">
            {products.data.map((p) => (
              <li key={p.id}>
                <Link to={`/obchod/${p.id}`} className="product-card">
                  <ProductImage mediaRef={productImages(p)[0]} alt="" />
                  <span className="product-name">{productName(p)}</span>
                  <span className="product-price">{price(p)}</span>
                  {isSoldOut(p) && <span className="badge">vyprodáno</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
```

Create `examples/src/shop/pages/ProductPage.tsx`:

```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { RichText } from '../../components/RichText';
import { ApiError } from '../../lib/cms';
import { useCart } from '../cart';
import { useMoney, useProduct } from '../hooks';
import { findVariant, initialChoice, maxQuantity, productDescription, productImages, productName } from '../product';
import { ProductImage } from '../components/ProductImage';
import type { ShopProduct, ShopVariant } from '../types';

export function ProductPage() {
  const { id } = useParams();
  const product = useProduct(id);

  if (product.isLoading) {
    return (
      <section className="article">
        <div className="container">
          <Spinner />
        </div>
      </section>
    );
  }
  if (product.isError || !product.data) {
    const missing = product.error instanceof ApiError && product.error.status === 404;
    return (
      <section className="article">
        <div className="container">
          <Link to="/obchod" className="back">
            ← obchod
          </Link>
          <ErrorState message={missing ? 'Produkt nenalezen.' : 'Produkt se nepodařilo načíst.'} />
        </div>
      </section>
    );
  }
  return <ProductDetail key={product.data.id} product={product.data} />;
}

function availability(product: ShopProduct, variant: ShopVariant | undefined): string {
  if (!variant) return 'Tato kombinace není v nabídce.';
  if (!variant.available) return 'Vyprodáno';
  if (product.type === 'DIGITAL') return 'Ke stažení po zaplacení';
  if (variant.availableQuantity !== null && variant.availableQuantity <= 5) return `Skladem posledních ${variant.availableQuantity} ks`;
  return 'Skladem';
}

function ProductDetail({ product }: { product: ShopProduct }) {
  const cart = useCart();
  const money = useMoney();
  const [chosen, setChosen] = useState(() => initialChoice(product));
  const [quantity, setQuantity] = useState('1');
  const [image, setImage] = useState(0);
  const [status, setStatus] = useState<'added' | 'full' | null>(null);

  const variant = findVariant(product, chosen);
  const images = productImages(product);
  const name = productName(product);
  const description = productDescription(product);
  const max = variant ? maxQuantity(variant) : 0;
  const pieces = Number(quantity);
  const quantityOk = Number.isInteger(pieces) && pieces >= 1 && pieces <= max;
  const canAdd = !!variant && variant.available && quantityOk;

  const add = () => {
    if (!variant || !canAdd) return;
    setStatus(cart.add({ variantId: variant.id, productId: product.id, quantity: pieces }) ? 'added' : 'full');
  };

  return (
    <section className="article">
      <div className="container-wide">
        <Link to="/obchod" className="back">
          ← obchod
        </Link>
        <div className="product-layout">
          <div className="product-gallery">
            <ProductImage mediaRef={images[image]} alt={name} className="large" />
            {images.length > 1 && (
              <div className="product-thumbs">
                {images.map((ref, i) => (
                  <button key={ref} type="button" className={i === image ? 'is-active' : ''} aria-label={`Obrázek ${i + 1}`} aria-pressed={i === image} onClick={() => setImage(i)}>
                    <ProductImage mediaRef={ref} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="product-info">
            <h1>{name}</h1>
            <p className="product-price">{variant ? money(variant.price, product.currency) : ''}</p>
            {product.options.map((o) => (
              <fieldset key={o.key} className="option-group">
                <legend>{o.label}</legend>
                <div className="option-values">
                  {o.values.map((v) => (
                    <label key={v.key} className={`option-chip ${chosen[o.key] === v.key ? 'is-active' : ''}`}>
                      <input
                        type="radio"
                        name={`option-${o.key}`}
                        value={v.key}
                        checked={chosen[o.key] === v.key}
                        onChange={() => {
                          setChosen({ ...chosen, [o.key]: v.key });
                          setStatus(null);
                        }}
                      />
                      {v.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className="availability">{availability(product, variant)}</p>
            {variant?.available && (
              <div className="form-group quantity">
                <label htmlFor="quantity">Počet</label>
                <input
                  id="quantity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={max}
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setStatus(null);
                  }}
                  aria-invalid={quantityOk ? undefined : true}
                  aria-describedby={quantityOk ? undefined : 'quantity-error'}
                />
                {!quantityOk && (
                  <p id="quantity-error" className="field-error">
                    {`Zadejte počet od 1 do ${max}.`}
                  </p>
                )}
              </div>
            )}
            <button type="button" className="btn" disabled={!canAdd} onClick={add}>
              Do košíku
            </button>
            <p role="status" className="add-status">
              {status === 'added' && (
                <>
                  Přidáno do košíku.{' '}
                  <Link to="/kosik" className="text-link">
                    Zobrazit košík
                  </Link>
                </>
              )}
              {status === 'full' && 'Košík je plný, může obsahovat nejvýše 50 různých položek.'}
            </p>
            {description && (
              <div className="product-description">
                <RichText html={description} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
```

In `examples/src/App.tsx`, import `ShopPage` and `ProductPage` from `./shop/pages/...` and add before the `about` route:

```tsx
          <Route path="obchod" element={<ShopPage />} />
          <Route path="obchod/:id" element={<ProductPage />} />
```

Append to `examples/src/styles/global.css`:

```css
.badge {
  display: inline-block;
  align-self: flex-start;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border: 1px solid var(--fg);
  padding: 1px 6px;
}
.muted {
  color: var(--muted);
}
.field-error {
  color: #b00020;
  font-size: 0.9rem;
  margin-top: 6px;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--bg);
  border-color: var(--fg);
}
.product-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 28px;
  margin-top: 32px;
}
.product-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.product-card:hover .product-name {
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 3px;
}
.product-image {
  width: 100%;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  background: var(--line);
  display: block;
}
.product-name {
  font-weight: 700;
}
.product-price {
  font-family: var(--font-mono);
}
.product-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 48px;
}
.product-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.product-thumbs button {
  width: 64px;
  padding: 0;
  border: 2px solid transparent;
  background: none;
  cursor: pointer;
}
.product-thumbs button.is-active {
  border-color: var(--fg);
}
.product-info h1 {
  margin-bottom: 8px;
}
.product-info .product-price {
  font-size: 1.3rem;
  margin-bottom: 20px;
}
.option-group {
  border: none;
  margin-bottom: 18px;
}
.option-group legend {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 8px;
}
.option-values {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.option-chip {
  position: relative;
  border: 2px solid var(--line);
  padding: 6px 14px;
  cursor: pointer;
  font-family: var(--font-mono);
}
.option-chip input {
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
}
.option-chip.is-active {
  border-color: var(--fg);
  background: var(--accent);
}
.option-chip:focus-within {
  outline: 2px solid var(--fg);
  outline-offset: 2px;
}
.availability {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  margin-bottom: 16px;
}
.quantity input {
  max-width: 120px;
}
.add-status {
  min-height: 1.6em;
  margin-top: 12px;
}
.product-description {
  margin-top: 32px;
}
@media (max-width: 720px) {
  .product-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
```

- [ ] **Step 5: Run the tests and the build**

Run: `pnpm --filter blog-flajsman test && pnpm --filter blog-flajsman build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add examples
git commit -m "feat(examples): shop product list and detail"
```

---

### Task 4: Cart page

**Files:**
- Create: `examples/src/shop/pages/CartPage.tsx`
- Modify: `examples/src/test/shop-fixtures.ts`, `examples/src/App.tsx`, `examples/src/styles/global.css`
- Test: `examples/src/shop/pages/CartPage.test.tsx`

**Interfaces:**
- Consumes: `useCart` (Task 2); `useQuote`, `useMoney` (Task 3); `Quote`, `QuoteLine` (Task 1).
- Produces: route `/kosik`; fixture `quoteFor(body, options?: { stock?: Record<string, number>; bump?: number }): Quote` and `COURIER` (shipping method id) used by Task 5.

- [ ] **Step 1: Write the failing tests**

Append to `examples/src/test/shop-fixtures.ts`:

```ts
import type { Quote, QuoteLine, QuoteRequest } from '../shop/types';

export const COURIER = 'aaaaaaaaaaaaaaaaaaaaaaaa';

const catalog: Record<string, Omit<QuoteLine, 'quantity' | 'lineTotal'>> = {
  'v-tee-s': { variantId: 'v-tee-s', productId: 'p-tee', type: 'PHYSICAL', name: 'Cyklistické tričko', optionLabels: [{ option: 'Velikost', value: 'S' }], unitPrice: 49000 },
  'v-guide': { variantId: 'v-guide', productId: 'p-guide', type: 'DIGITAL', name: 'Průvodce Šumavou', optionLabels: [], unitPrice: 29900 },
};

/** A quote like the backend's: courier to CZ only (129 Kč), cash on delivery +39 Kč without digital items. `bump` raises every unit price. */
export function quoteFor(body: QuoteRequest, options: { stock?: Record<string, number>; bump?: number } = {}): Quote {
  const lines: QuoteLine[] = body.items.map((i) => {
    const base = catalog[i.variantId];
    const unitPrice = base.unitPrice + (options.bump ?? 0);
    const stock = options.stock?.[i.variantId];
    const short = stock !== undefined && stock < i.quantity;
    return {
      ...base,
      unitPrice,
      quantity: i.quantity,
      lineTotal: short ? 0 : unitPrice * i.quantity,
      ...(short ? { problem: stock === 0 ? ('OUT_OF_STOCK' as const) : ('NOT_ENOUGH_STOCK' as const), availableQuantity: stock } : {}),
    };
  });
  const hasPhysical = lines.some((l) => l.type === 'PHYSICAL');
  const hasDigital = lines.some((l) => l.type === 'DIGITAL');
  const items = lines.reduce((n, l) => n + l.lineTotal, 0);
  const ships = hasPhysical && body.country === 'CZ';
  const shippingOptions = ships
    ? [{ id: COURIER, name: 'Kurýr', price: 12900, paymentMethods: [{ method: 'BANK_TRANSFER' as const, fee: 0 }, ...(hasDigital ? [] : [{ method: 'CASH_ON_DELIVERY' as const, fee: 3900 }])] }]
    : [];
  const shipping = ships && body.shippingMethodId === COURIER ? { methodId: COURIER, name: 'Kurýr', price: 12900 } : null;
  const fee = body.paymentMethod === 'CASH_ON_DELIVERY' ? 3900 : 0;
  const total = items + (shipping?.price ?? 0) + fee;
  const vat = Math.round((total * 2100) / 12100);
  return {
    currency: 'CZK',
    lines,
    hasPhysical,
    hasDigital,
    shippingOptions,
    shipping,
    payment: body.paymentMethod ? { method: body.paymentMethod, fee } : null,
    totals: { items, shipping: shipping?.price ?? 0, paymentFee: fee, total, vat: [{ rate: 2100, base: total - vat, amount: vat }] },
    problems: [...(lines.some((l) => l.problem) ? ['LINES'] : []), ...(hasPhysical && body.country && !ships ? ['NO_SHIPPING'] : [])],
  };
}
```

Move the new `import type` line to the top of the file next to the existing import (one combined `import type { Quote, QuoteLine, QuoteRequest, ShopProduct } from '../shop/types';`).

Create `examples/src/shop/pages/CartPage.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { quoteFor } from '../../test/shop-fixtures';
import { CART_KEY } from '../cart';
import type { QuoteRequest } from '../types';
import { CartPage } from './CartPage';

const routes = [{ path: '/kosik', element: <CartPage /> }];
const setCart = (items: { variantId: string; productId: string; quantity: number }[]) => localStorage.setItem(CART_KEY, JSON.stringify(items));

it('shows the lines with prices from the quote and the subtotal', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 2 }]);
  mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok(quoteFor(body)) });
  renderRoutes(routes, '/kosik');
  expect(await screen.findByRole('link', { name: 'Cyklistické tričko' })).toHaveAttribute('href', '/obchod/p-tee');
  expect(screen.getByText('Velikost: S')).toBeInTheDocument();
  expect(screen.getByText('Mezisoučet').parentElement).toHaveTextContent(/980\sKč/);
  expect(screen.getByRole('link', { name: 'K pokladně' })).toHaveAttribute('href', '/pokladna');
});

it('offers to lower a quantity above the stock and blocks checkout until then', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 3 }]);
  const api = mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok(quoteFor(body, { stock: { 'v-tee-s': 1 } })) });
  renderRoutes(routes, '/kosik');
  expect(await screen.findByText('Skladem jen 1 ks.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'K pokladně' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Snížit na 1' }));
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }]);
  await waitFor(() => expect(screen.getByRole('link', { name: 'K pokladně' })).toBeInTheDocument());
  expect(api.calls.filter((c) => c.key === 'POST /shop/quote').at(-1)?.body).toMatchObject({ items: [{ variantId: 'v-tee-s', quantity: 1 }] });
});

it('changes quantities and removes lines', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }]);
  mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok(quoteFor(body)) });
  renderRoutes(routes, '/kosik');
  await userEvent.click(await screen.findByRole('button', { name: 'Přidat kus: Cyklistické tričko' }));
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)[0].quantity).toBe(2);
  await userEvent.click(screen.getByRole('button', { name: 'Odebrat Cyklistické tričko' }));
  expect(await screen.findByText('Košík je prázdný.')).toBeInTheDocument();
});

it('marks an item that is no longer sold', async () => {
  setCart([{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }]);
  mockApi({ 'POST /shop/quote': (body: QuoteRequest) => ok({ ...quoteFor(body), lines: [{ ...quoteFor(body).lines[0], problem: 'NOT_FOR_SALE', lineTotal: 0 }] }) });
  renderRoutes(routes, '/kosik');
  expect(await screen.findByText('Už není v prodeji')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter blog-flajsman test -- src/shop/pages/CartPage.test.tsx`
Expected: FAIL, `./CartPage` does not exist.

- [ ] **Step 3: Implement the page and route**

Create `examples/src/shop/pages/CartPage.tsx`:

```tsx
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { useCart } from '../cart';
import { useMoney, useQuote } from '../hooks';
import type { QuoteLine } from '../types';

function ProblemNote({ line, onReduce }: { line: QuoteLine; onReduce: (quantity: number) => void }) {
  if (line.problem === 'NOT_ENOUGH_STOCK' && line.availableQuantity) {
    const available = line.availableQuantity;
    return (
      <p className="line-problem">
        {`Skladem jen ${available} ks.`}{' '}
        <button type="button" className="text-link" onClick={() => onReduce(available)}>
          {`Snížit na ${available}`}
        </button>
      </p>
    );
  }
  if (line.problem === 'OUT_OF_STOCK' || line.problem === 'NOT_ENOUGH_STOCK') return <p className="line-problem">Vyprodáno</p>;
  return <p className="line-problem">Už není v prodeji</p>;
}

export function CartPage() {
  const cart = useCart();
  const money = useMoney();
  const request = useMemo(
    () => (cart.items.length ? { items: cart.items.map(({ variantId, quantity }) => ({ variantId, quantity })) } : null),
    [cart.items],
  );
  const quote = useQuote(request);
  const hasProblem = quote.data?.lines.some((l) => l.problem) ?? false;

  return (
    <section className="article">
      <div className="container-wide">
        <div className="kicker">košík</div>
        <h1>Košík</h1>
        {cart.items.length === 0 && (
          <>
            <ErrorState message="Košík je prázdný." />
            <p>
              <Link to="/obchod" className="btn">
                Do obchodu
              </Link>
            </p>
          </>
        )}
        {cart.items.length > 0 && quote.isLoading && <Spinner />}
        {cart.items.length > 0 && quote.isError && !quote.data && (
          <>
            <ErrorState message="Košík se nepodařilo načíst." />
            <button type="button" className="btn" onClick={() => void quote.refetch()}>
              Zkusit znovu
            </button>
          </>
        )}
        {cart.items.length > 0 && quote.data && (
          <>
            <ul className="cart-lines">
              {cart.items.map((item) => {
                const line = quote.data.lines.find((l) => l.variantId === item.variantId);
                const name = line?.name || 'Neznámé zboží';
                return (
                  <li key={item.variantId} className="cart-line">
                    <div className="cart-line-main">
                      <Link to={`/obchod/${item.productId}`} className="cart-line-name">
                        {name}
                      </Link>
                      {line && line.optionLabels.length > 0 && <span className="muted">{line.optionLabels.map((o) => `${o.option}: ${o.value}`).join(', ')}</span>}
                      {line?.problem && <ProblemNote line={line} onReduce={(n) => cart.setQuantity(item.variantId, n)} />}
                    </div>
                    <div className="cart-line-qty">
                      <button type="button" aria-label={`Ubrat kus: ${name}`} disabled={item.quantity <= 1} onClick={() => cart.setQuantity(item.variantId, item.quantity - 1)}>
                        −
                      </button>
                      <span aria-label={`Počet kusů: ${name}`}>{item.quantity}</span>
                      <button type="button" aria-label={`Přidat kus: ${name}`} disabled={item.quantity >= 99} onClick={() => cart.setQuantity(item.variantId, item.quantity + 1)}>
                        +
                      </button>
                    </div>
                    <div className="cart-line-total">{line && !line.problem ? money(line.lineTotal, quote.data.currency) : ''}</div>
                    <button type="button" className="text-link cart-remove" aria-label={`Odebrat ${name}`} onClick={() => cart.remove(item.variantId)}>
                      Odebrat
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="cart-footer">
              <p className="cart-subtotal">
                <span>Mezisoučet</span> <strong>{money(quote.data.totals.items, quote.data.currency)}</strong>
              </p>
              <p className="muted">Dopravu a platbu vyberete v pokladně.</p>
              {hasProblem && (
                <p className="line-problem" role="alert">
                  Než budete pokračovat, upravte prosím označené položky.
                </p>
              )}
              {hasProblem ? (
                <button type="button" className="btn" disabled>
                  K pokladně
                </button>
              ) : (
                <Link to="/pokladna" className="btn">
                  K pokladně
                </Link>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
```

In `examples/src/App.tsx`, import `CartPage` and add `<Route path="kosik" element={<CartPage />} />` after the product routes.

Append to `examples/src/styles/global.css`:

```css
.cart-lines {
  list-style: none;
  margin-top: 24px;
  border-top: 1px solid var(--line);
}
.cart-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  gap: 16px;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
}
.cart-line-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cart-line-name {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.cart-line-qty {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
}
.cart-line-qty button {
  width: 32px;
  height: 32px;
  border: 2px solid var(--fg);
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
  font-size: 1rem;
}
.cart-line-qty button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.cart-line-total {
  font-family: var(--font-mono);
  min-width: 90px;
  text-align: right;
}
.cart-remove,
.line-problem button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 0.85rem;
}
.line-problem {
  color: #b00020;
  font-size: 0.9rem;
}
.cart-footer {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  text-align: right;
}
.cart-subtotal {
  font-size: 1.1rem;
}
@media (max-width: 560px) {
  .cart-line {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .cart-line-total {
    text-align: left;
    min-width: 0;
  }
  .cart-footer {
    align-items: stretch;
    text-align: left;
  }
}
```

- [ ] **Step 4: Run the tests and the build**

Run: `pnpm --filter blog-flajsman test && pnpm --filter blog-flajsman build`
Expected: all tests pass; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add examples
git commit -m "feat(examples): cart page with stock problems from the quote"
```

---

### Task 5: Checkout

**Files:**
- Create: `examples/src/shop/checkout-form.ts`, `examples/src/shop/components/Summary.tsx`, `examples/src/shop/pages/CheckoutPage.tsx`
- Modify: `examples/src/App.tsx`, `examples/src/styles/global.css`
- Test: `examples/src/shop/checkout-form.test.ts`, `examples/src/shop/pages/CheckoutPage.test.tsx`

**Interfaces:**
- Consumes: `shop.placeOrder`, `ApiError`, `checkoutProblem` (Task 1); `useCart` (Task 2); `useQuote`, `quoteKey`, `useCountries`, `useMoney`, `useDebounced` (Task 3); fixtures `quoteFor`, `COURIER` (Task 4).
- Produces: `CheckoutForm`, `emptyForm`, `FieldErrors`, `validateCheckout(form, { hasPhysical })`, `quoteRequest(choices, items)`, `orderRequest(form, items, quote)`, `paymentOptions(quote, shippingMethodId)`, `checkoutKey()`, `forgetCheckoutKey()`, `PAYMENT_LABEL`; `SummaryLines({ lines, currency })`, `SummaryTotals({ totals, shippingName, currency })` (used by Task 6); route `/pokladna`; navigation to `/objednavka/:number?t=<token>` with state `{ placed: true }`.

- [ ] **Step 1: Write the failing tests**

Create `examples/src/shop/checkout-form.test.ts`:

```ts
import { quoteFor } from '../test/shop-fixtures';
import { checkoutKey, emptyForm, forgetCheckoutKey, orderRequest, paymentOptions, validateCheckout } from './checkout-form';

const filled = { ...emptyForm, email: 'jana@example.test', name: 'Jana', street: 'Hlavní 1', city: 'Praha', postalCode: '110 00', shippingMethodId: 'x', paymentMethod: 'BANK_TRANSFER' as const, acceptTerms: true };
const items = [{ variantId: 'v-tee-s', productId: 'p-tee', quantity: 1 }];

it('names every missing or invalid field in Czech', () => {
  expect(validateCheckout(emptyForm, { hasPhysical: true })).toEqual({
    email: 'Zadejte platný e-mail.',
    name: 'Vyplňte jméno a příjmení.',
    street: 'Vyplňte ulici a číslo popisné.',
    city: 'Vyplňte město.',
    postalCode: 'Vyplňte PSČ.',
    shipping: 'Vyberte dopravu.',
    payment: 'Vyberte způsob platby.',
    terms: 'Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.',
  });
  expect(validateCheckout({ ...filled, postalCode: '1100' }, { hasPhysical: true })).toEqual({ postalCode: 'Zadejte PSČ ve tvaru 110 00.' });
  expect(validateCheckout({ ...filled, country: 'DE', postalCode: '10115' }, { hasPhysical: true })).toEqual({});
  expect(validateCheckout({ ...filled, isCompany: true }, { hasPhysical: true })).toEqual({ company: 'Vyplňte název firmy.' });
  expect(validateCheckout({ ...filled, shipElsewhere: true }, { hasPhysical: true })).toMatchObject({ shipName: 'Vyplňte jméno příjemce.' });
  expect(validateCheckout({ ...filled, shippingMethodId: '' }, { hasPhysical: false })).toEqual({});
});

it('builds the order with a separate delivery address and company details', () => {
  const quote = quoteFor({ items: [{ variantId: 'v-tee-s', quantity: 1 }], country: 'CZ' });
  const body = orderRequest(
    { ...filled, isCompany: true, company: 'Kola s.r.o.', vatId: 'CZ123', shipElsewhere: true, shipName: 'Petr', shipStreet: 'Dlouhá 2', shipCity: 'Brno', shipPostalCode: '602 00', note: '  ' },
    items,
    quote,
  );
  expect(body.billingAddress).toEqual({ name: 'Jana', company: 'Kola s.r.o.', vatId: 'CZ123', street: 'Hlavní 1', city: 'Praha', postalCode: '110 00', country: 'CZ' });
  expect(body.shippingAddress).toEqual({ name: 'Petr', street: 'Dlouhá 2', city: 'Brno', postalCode: '602 00', country: 'CZ' });
  expect(body.note).toBeUndefined();
  expect(body.expectedTotal).toBe(quote.totals.total);
});

it('sends no delivery address for a digital-only cart and offers bank transfer only', () => {
  const quote = quoteFor({ items: [{ variantId: 'v-guide', quantity: 1 }], country: 'CZ' });
  expect(orderRequest(filled, [{ variantId: 'v-guide', productId: 'p-guide', quantity: 1 }], quote).shippingAddress).toBeUndefined();
  expect(paymentOptions(quote, '')).toEqual([{ method: 'BANK_TRANSFER', fee: 0 }]);
});

it('keeps one idempotency key until it is dropped', () => {
  const first = checkoutKey();
  expect(checkoutKey()).toBe(first);
  forgetCheckoutKey();
  expect(checkoutKey()).not.toBe(first);
});
```

Create `examples/src/shop/pages/CheckoutPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router-dom';
import { mockApi, ok, type MockResult } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { COURIER, quoteFor } from '../../test/shop-fixtures';
import { CART_KEY } from '../cart';
import type { OrderRequest, QuoteRequest } from '../types';
import { CheckoutPage } from './CheckoutPage';

function OrderProbe() {
  const location = useLocation();
  return <p>{`order ${location.pathname}${location.search}`}</p>;
}

const routes = [
  { path: '/pokladna', element: <CheckoutPage /> },
  { path: '/objednavka/:number', element: <OrderProbe /> },
];
const address = { name: 'Jana Nováková', street: 'Hlavní 1', city: 'Praha', postalCode: '110 00', country: 'CZ' };
const placed = (status = 201): MockResult => ({ status, body: { success: true, data: { number: '2026000001', accessToken: 'tok', total: 0, currency: 'CZK', payment: { method: 'BANK_TRANSFER' } } } });
const setCart = (variantId: string, productId: string) => localStorage.setItem(CART_KEY, JSON.stringify([{ variantId, productId, quantity: 1 }]));
const orderButton = () => screen.getByRole('button', { name: 'Objednat s povinností platby' });

function serve(order: (body: OrderRequest) => MockResult | Promise<MockResult>, quote = (body: QuoteRequest) => ok(quoteFor(body))) {
  return mockApi({ 'GET /shop/shipping-countries': () => ok(['CZ', 'SK']), 'POST /shop/quote': quote, 'POST /shop/orders': order });
}

async function fillForm() {
  await userEvent.type(await screen.findByLabelText(/E-mail/), 'jana@example.test');
  await userEvent.type(screen.getByLabelText(/Jméno a příjmení/), 'Jana Nováková');
  await userEvent.type(screen.getByLabelText(/Ulice a číslo/), 'Hlavní 1');
  await userEvent.type(screen.getByLabelText(/^Město/), 'Praha');
  await userEvent.type(screen.getByLabelText(/^PSČ/), '110 00');
  await userEvent.click(screen.getByRole('checkbox', { name: /obchodními podmínkami/ }));
}

const ordersOf = (api: ReturnType<typeof serve>) => api.calls.filter((c) => c.key === 'POST /shop/orders');

it('places a cash on delivery order and opens the order page', async () => {
  setCart('v-tee-s', 'p-tee');
  const api = serve(() => placed());
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await userEvent.click(await screen.findByRole('radio', { name: /Dobírka/ }));
  await waitFor(() => expect(screen.getByText('Celkem').nextElementSibling).toHaveTextContent(/658\sKč/));
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(await screen.findByText('order /objednavka/2026000001?t=tok')).toBeInTheDocument();
  const [call] = ordersOf(api);
  expect(call.body).toEqual({
    items: [{ variantId: 'v-tee-s', quantity: 1 }],
    country: 'CZ',
    shippingMethodId: COURIER,
    paymentMethod: 'CASH_ON_DELIVERY',
    language: 'cs',
    customer: { email: 'jana@example.test', name: 'Jana Nováková' },
    billingAddress: address,
    shippingAddress: address,
    acceptTerms: true,
    expectedTotal: 65800,
  });
  expect(call.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.parse(localStorage.getItem(CART_KEY)!)).toEqual([]);
});

it('shows field errors and sends nothing', async () => {
  setCart('v-tee-s', 'p-tee');
  const api = serve(() => placed());
  renderRoutes(routes, '/pokladna');
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(screen.getByText('Zadejte platný e-mail.')).toBeInTheDocument();
  expect(screen.getByLabelText(/E-mail/)).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByLabelText(/E-mail/)).toHaveFocus();
  expect(screen.getByText('Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.')).toBeInTheDocument();
  expect(ordersOf(api)).toHaveLength(0);
});

it('shows new prices after a price change and sends the new total on the next click', async () => {
  setCart('v-tee-s', 'p-tee');
  let bumped = false;
  const api = serve(
    (body) => {
      if (!bumped) {
        bumped = true;
        return { status: 409, body: { success: false, error: 'Prices changed', reason: 'PRICE_CHANGED', quote: quoteFor(body, { bump: 1000 }) } };
      }
      return placed();
    },
    (body) => ok(quoteFor(body, { bump: bumped ? 1000 : 0 })),
  );
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(await screen.findByText(/Ceny se mezitím změnily/)).toBeInTheDocument();
  expect(screen.getByText('Celkem').nextElementSibling).toHaveTextContent(/629\sKč/);
  expect(screen.queryByText(/order \//)).not.toBeInTheDocument();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  await screen.findByText('order /objednavka/2026000001?t=tok');
  expect(ordersOf(api).map((c) => (c.body as OrderRequest).expectedTotal)).toEqual([61900, 62900]);
});

it('points to the cart when stock ran out', async () => {
  setCart('v-tee-s', 'p-tee');
  serve(() => ({ status: 409, body: { success: false, error: 'Out of stock', reason: 'OUT_OF_STOCK' } }));
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent('Některé zboží už není skladem');
  expect(within(alert).getByRole('link', { name: 'Upravit košík' })).toHaveAttribute('href', '/kosik');
});

it('keeps the form after a network failure and retries with the same key', async () => {
  setCart('v-tee-s', 'p-tee');
  let fail = true;
  const api = serve(() => {
    if (fail) {
      fail = false;
      throw new TypeError('Failed to fetch');
    }
    return placed();
  });
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.click(orderButton());
  expect(await screen.findByText(/Nepodařilo se spojit se serverem/)).toBeInTheDocument();
  expect(screen.getByLabelText(/E-mail/)).toHaveValue('jana@example.test');
  await userEvent.click(orderButton());
  await screen.findByText('order /objednavka/2026000001?t=tok');
  const keys = ordersOf(api).map((c) => c.headers.get('Idempotency-Key'));
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

it('sends one order for a double click', async () => {
  setCart('v-tee-s', 'p-tee');
  const api = serve(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return placed();
  });
  renderRoutes(routes, '/pokladna');
  await fillForm();
  await waitFor(() => expect(orderButton()).toBeEnabled());
  await userEvent.dblClick(orderButton());
  await screen.findByText('order /objednavka/2026000001?t=tok');
  expect(ordersOf(api)).toHaveLength(1);
});

it('offers only bank transfer and no delivery for a digital-only cart', async () => {
  setCart('v-guide', 'p-guide');
  serve(() => placed());
  renderRoutes(routes, '/pokladna');
  expect(await screen.findByRole('radio', { name: /Bankovní převod/ })).toBeChecked();
  expect(screen.queryByRole('radio', { name: /Dobírka/ })).not.toBeInTheDocument();
  expect(screen.queryByText('3. Doprava')).not.toBeInTheDocument();
  expect(screen.queryByRole('checkbox', { name: 'Doručit na jinou adresu' })).not.toBeInTheDocument();
});

it('says when the country cannot be shipped to and blocks the order', async () => {
  setCart('v-tee-s', 'p-tee');
  serve(() => placed());
  renderRoutes(routes, '/pokladna');
  await userEvent.selectOptions(await screen.findByLabelText(/Země/), 'SK');
  expect(await screen.findByText('Do této země bohužel nedoručujeme.')).toBeInTheDocument();
  expect(orderButton()).toBeDisabled();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter blog-flajsman test -- src/shop/checkout-form.test.ts src/shop/pages/CheckoutPage.test.tsx`
Expected: FAIL, `./checkout-form` and `./CheckoutPage` do not exist.

- [ ] **Step 3: Implement the form helpers and the summary**

Create `examples/src/shop/checkout-form.ts`:

```ts
import type { Address, CartItem, OrderRequest, PaymentMethod, Quote, QuoteRequest } from './types';

export interface CheckoutForm {
  email: string;
  name: string;
  phone: string;
  country: string;
  street: string;
  city: string;
  postalCode: string;
  isCompany: boolean;
  company: string;
  vatId: string;
  shipElsewhere: boolean;
  shipName: string;
  shipStreet: string;
  shipCity: string;
  shipPostalCode: string;
  shippingMethodId: string;
  paymentMethod: PaymentMethod | '';
  note: string;
  acceptTerms: boolean;
}

export const emptyForm: CheckoutForm = {
  email: '',
  name: '',
  phone: '',
  country: 'CZ',
  street: '',
  city: '',
  postalCode: '',
  isCompany: false,
  company: '',
  vatId: '',
  shipElsewhere: false,
  shipName: '',
  shipStreet: '',
  shipCity: '',
  shipPostalCode: '',
  shippingMethodId: '',
  paymentMethod: '',
  note: '',
  acceptTerms: false,
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Bankovní převod',
  CASH_ON_DELIVERY: 'Dobírka',
};

export type FieldKey =
  | 'email'
  | 'name'
  | 'phone'
  | 'street'
  | 'city'
  | 'postalCode'
  | 'company'
  | 'vatId'
  | 'shipName'
  | 'shipStreet'
  | 'shipCity'
  | 'shipPostalCode'
  | 'shipping'
  | 'payment'
  | 'note'
  | 'terms';
export type FieldErrors = Partial<Record<FieldKey, string>>;

/** Order of the fields on the page, for focusing the first error. */
export const FIELD_ORDER: FieldKey[] = ['email', 'name', 'phone', 'street', 'city', 'postalCode', 'company', 'vatId', 'shipName', 'shipStreet', 'shipCity', 'shipPostalCode', 'shipping', 'payment', 'note', 'terms'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CZ_SK_POSTAL = /^\d{3}\s?\d{2}$/;

function required(value: string, max: number, missing: string, tooLong: string): string | undefined {
  const v = value.trim();
  if (!v) return missing;
  return v.length > max ? tooLong : undefined;
}

function postal(value: string, country: string): string | undefined {
  const v = value.trim();
  if (!v) return 'Vyplňte PSČ.';
  if ((country === 'CZ' || country === 'SK') && !CZ_SK_POSTAL.test(v)) return 'Zadejte PSČ ve tvaru 110 00.';
  return v.length > 20 ? 'PSČ může mít nejvýše 20 znaků.' : undefined;
}

/** Field errors in Czech, checked before anything is sent; the limits match the API. */
export function validateCheckout(form: CheckoutForm, opts: { hasPhysical: boolean }): FieldErrors {
  const e: FieldErrors = {};
  const email = form.email.trim();
  if (!EMAIL.test(email) || email.length > 200) e.email = 'Zadejte platný e-mail.';
  e.name = required(form.name, 100, 'Vyplňte jméno a příjmení.', 'Jméno může mít nejvýše 100 znaků.');
  if (form.phone.trim().length > 30) e.phone = 'Telefon může mít nejvýše 30 znaků.';
  e.street = required(form.street, 200, 'Vyplňte ulici a číslo popisné.', 'Ulice může mít nejvýše 200 znaků.');
  e.city = required(form.city, 100, 'Vyplňte město.', 'Město může mít nejvýše 100 znaků.');
  e.postalCode = postal(form.postalCode, form.country);
  if (form.isCompany) {
    e.company = required(form.company, 100, 'Vyplňte název firmy.', 'Název firmy může mít nejvýše 100 znaků.');
    if (form.vatId.trim().length > 30) e.vatId = 'DIČ může mít nejvýše 30 znaků.';
  }
  if (opts.hasPhysical && form.shipElsewhere) {
    e.shipName = required(form.shipName, 100, 'Vyplňte jméno příjemce.', 'Jméno může mít nejvýše 100 znaků.');
    e.shipStreet = required(form.shipStreet, 200, 'Vyplňte ulici a číslo popisné.', 'Ulice může mít nejvýše 200 znaků.');
    e.shipCity = required(form.shipCity, 100, 'Vyplňte město.', 'Město může mít nejvýše 100 znaků.');
    e.shipPostalCode = postal(form.shipPostalCode, form.country);
  }
  if (opts.hasPhysical && !form.shippingMethodId) e.shipping = 'Vyberte dopravu.';
  if (!form.paymentMethod) e.payment = 'Vyberte způsob platby.';
  if (form.note.trim().length > 1000) e.note = 'Poznámka může mít nejvýše 1000 znaků.';
  if (!form.acceptTerms) e.terms = 'Pro odeslání objednávky je potřeba souhlasit s obchodními podmínkami.';
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as FieldErrors;
}

const optional = (v: string) => (v.trim() ? v.trim() : undefined);

/** The quote request for the cart and the current choices. */
export function quoteRequest(choices: Pick<CheckoutForm, 'country' | 'shippingMethodId' | 'paymentMethod'>, items: CartItem[]): QuoteRequest {
  return {
    items: items.map(({ variantId, quantity }) => ({ variantId, quantity })),
    country: choices.country,
    shippingMethodId: choices.shippingMethodId || undefined,
    paymentMethod: choices.paymentMethod || undefined,
  };
}

/** The order body: delivery goes to the billing address unless "Doručit na jinou adresu" is ticked. */
export function orderRequest(form: CheckoutForm, items: CartItem[], quote: Quote): OrderRequest {
  const billing: Address = {
    name: form.name.trim(),
    company: form.isCompany ? optional(form.company) : undefined,
    vatId: form.isCompany ? optional(form.vatId) : undefined,
    street: form.street.trim(),
    city: form.city.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country,
  };
  let shipping: Address | undefined;
  if (quote.hasPhysical) {
    shipping = form.shipElsewhere
      ? { name: form.shipName.trim(), street: form.shipStreet.trim(), city: form.shipCity.trim(), postalCode: form.shipPostalCode.trim(), country: form.country }
      : { ...billing };
  }
  return {
    ...quoteRequest(form, items),
    customer: { email: form.email.trim(), name: form.name.trim(), phone: optional(form.phone) },
    billingAddress: billing,
    shippingAddress: shipping,
    note: optional(form.note),
    acceptTerms: form.acceptTerms,
    expectedTotal: quote.totals.total,
  };
}

/** Payment choices: those of the chosen shipping method; a digital-only cart pays by bank transfer. */
export function paymentOptions(quote: Quote | undefined, shippingMethodId: string): { method: PaymentMethod; fee: number }[] {
  if (!quote) return [];
  if (!quote.hasPhysical) return [{ method: 'BANK_TRANSFER', fee: 0 }];
  return quote.shippingOptions.find((o) => o.id === shippingMethodId)?.paymentMethods ?? [];
}

const KEY = 'flajsman.checkout.key';
let memoryKey: string | null = null;

/** One key per checkout attempt, so a double click or a retry returns the same order. */
export function checkoutKey(): string {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return stored;
    const key = crypto.randomUUID();
    sessionStorage.setItem(KEY, key);
    return key;
  } catch {
    // Storage blocked: keep the key for this page.
    memoryKey ??= crypto.randomUUID();
    return memoryKey;
  }
}

export function forgetCheckoutKey(): void {
  memoryKey = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}
```

Create `examples/src/shop/components/Summary.tsx`:

```tsx
import { useMoney } from '../hooks';
import type { OptionLabel, Totals } from '../types';

interface SummaryLine {
  name: string;
  optionLabels: OptionLabel[];
  quantity: number;
  lineTotal: number;
}

export function SummaryLines({ lines, currency }: { lines: SummaryLine[]; currency: string }) {
  const money = useMoney();
  return (
    <ul className="summary-lines">
      {lines.map((l, i) => (
        <li key={i}>
          <span className="summary-name">{`${l.quantity} × ${l.name}${l.optionLabels.length ? ` (${l.optionLabels.map((o) => o.value).join(', ')})` : ''}`}</span>
          <span>{money(l.lineTotal, currency)}</span>
        </li>
      ))}
    </ul>
  );
}

export function SummaryTotals({ totals, shippingName, currency }: { totals: Totals; shippingName: string | null; currency: string }) {
  const money = useMoney();
  const vat = totals.vat.map((v) => `${(v.rate / 100).toLocaleString('cs-CZ')} % ${money(v.amount, currency)}`).join(', ');
  return (
    <>
      <dl className="summary-totals">
        <div>
          <dt>Zboží</dt>
          <dd>{money(totals.items, currency)}</dd>
        </div>
        {shippingName && (
          <div>
            <dt>{`Doprava (${shippingName})`}</dt>
            <dd>{totals.shipping ? money(totals.shipping, currency) : 'zdarma'}</dd>
          </div>
        )}
        {totals.paymentFee > 0 && (
          <div>
            <dt>Poplatek za platbu</dt>
            <dd>{money(totals.paymentFee, currency)}</dd>
          </div>
        )}
        <div className="summary-total">
          <dt>Celkem</dt>
          <dd>{money(totals.total, currency)}</dd>
        </div>
      </dl>
      {vat && <p className="muted vat-note">{`Včetně DPH ${vat}`}</p>}
    </>
  );
}
```

- [ ] **Step 4: Implement the checkout page and route**

Create `examples/src/shop/pages/CheckoutPage.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorState, Spinner } from '../../components/Spinner';
import { ApiError } from '../../lib/cms';
import { shop } from '../api';
import { useCart } from '../cart';
import {
  FIELD_ORDER,
  PAYMENT_LABEL,
  checkoutKey,
  emptyForm,
  forgetCheckoutKey,
  orderRequest,
  paymentOptions,
  quoteRequest,
  validateCheckout,
  type CheckoutForm,
  type FieldErrors,
  type FieldKey,
} from '../checkout-form';
import { checkoutProblem, type CheckoutProblem } from '../errors';
import { quoteKey, useCountries, useDebounced, useMoney, useQuote } from '../hooks';
import { SummaryLines, SummaryTotals } from '../components/Summary';
import type { Quote } from '../types';

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(['cs'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

/** Element ids for focusing the first invalid field. */
const FIELD_ID: Record<FieldKey, string> = {
  email: 'email',
  name: 'name',
  phone: 'phone',
  street: 'street',
  city: 'city',
  postalCode: 'postalCode',
  company: 'company',
  vatId: 'vatId',
  shipName: 'shipName',
  shipStreet: 'shipStreet',
  shipCity: 'shipCity',
  shipPostalCode: 'shipPostalCode',
  shipping: 'shipping-0',
  payment: 'payment-0',
  note: 'note',
  terms: 'terms',
};

interface TextFieldProps {
  id: FieldKey;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  optional?: boolean;
}

function TextField({ id, label, value, onChange, error, type = 'text', autoComplete, optional = false }: TextFieldProps) {
  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label}
        {optional ? <span className="optional"> (nepovinné)</span> : <span className="req"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const cart = useCart();
  const money = useMoney();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const countries = useCountries();
  const [form, setForm] = useState<CheckoutForm>(emptyForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState<CheckoutProblem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const request = useMemo(
    () => quoteRequest({ country: form.country, shippingMethodId: form.shippingMethodId, paymentMethod: form.paymentMethod }, cart.items),
    [form.country, form.shippingMethodId, form.paymentMethod, cart.items],
  );
  const debounced = useDebounced(request, 300);
  const quote = useQuote(cart.items.length ? debounced : null);
  const current = quote.data;
  const settled = debounced === request && !quote.isFetching;

  const countryList = useMemo(() => (countries.data && countries.data.length ? countries.data : ['CZ']), [countries.data]);
  useEffect(() => {
    if (!countryList.includes(form.country)) setForm((f) => ({ ...f, country: countryList.includes('CZ') ? 'CZ' : countryList[0] }));
  }, [countryList, form.country]);

  // Keep shipping and payment valid for the current quote: take the first option when the choice no longer fits.
  useEffect(() => {
    if (!current) return;
    const ids = current.hasPhysical ? current.shippingOptions.map((o) => o.id) : [];
    if (!ids.includes(form.shippingMethodId) && (form.shippingMethodId || ids.length)) setForm((f) => ({ ...f, shippingMethodId: ids[0] ?? '' }));
  }, [current, form.shippingMethodId]);
  const payments = paymentOptions(current, form.shippingMethodId);
  useEffect(() => {
    if (!current) return;
    const methods = paymentOptions(current, form.shippingMethodId).map((p) => p.method);
    if (methods.length && !methods.some((m) => m === form.paymentMethod)) setForm((f) => ({ ...f, paymentMethod: methods[0] }));
  }, [current, form.shippingMethodId, form.paymentMethod]);

  const set = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setProblem(null);
  };

  const hasLineProblem = current?.lines.some((l) => l.problem) ?? false;
  const noShipping = !!current && current.hasPhysical && current.shippingOptions.length === 0;
  const canOrder = !!current && settled && !hasLineProblem && !noShipping && !submitting;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (inFlight.current || !current || !canOrder) return;
    const found = validateCheckout(form, { hasPhysical: current.hasPhysical });
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      document.getElementById(FIELD_ID[first])?.focus();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const placed = await shop.placeOrder(orderRequest(form, cart.items, current), checkoutKey());
      forgetCheckoutKey();
      cart.clear();
      navigate(`/objednavka/${placed.number}?t=${encodeURIComponent(placed.accessToken)}`, { replace: true, state: { placed: true } });
    } catch (error) {
      const found = checkoutProblem(error);
      if (error instanceof ApiError && error.reason === 'PRICE_CHANGED' && error.body.quote) {
        queryClient.setQueryData(quoteKey(debounced), error.body.quote as Quote);
      }
      if (found.retryWithNewKey) forgetCheckoutKey();
      setProblem(found);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <section className="article">
        <div className="container">
          <div className="kicker">pokladna</div>
          <ErrorState message="Košík je prázdný." />
          <p>
            <Link to="/obchod" className="btn">
              Do obchodu
            </Link>
          </p>
        </div>
      </section>
    );
  }

  const physical = current?.hasPhysical ?? false;
  const sectionError = (section: CheckoutProblem['section']) =>
    problem?.section === section ? (
      <p className="field-error" role="alert">
        {problem.text}
      </p>
    ) : null;

  return (
    <section className="article">
      <div className="container-wide">
        <div className="kicker">pokladna</div>
        <h1>Pokladna</h1>
        <form className="checkout" noValidate onSubmit={(e) => void submit(e)}>
          <div className="checkout-main">
            <fieldset className="checkout-section">
              <legend>1. Kontakt</legend>
              <TextField id="email" type="email" autoComplete="email" label="E-mail" value={form.email} onChange={(v) => set('email', v)} error={errors.email} />
              <TextField id="name" autoComplete="name" label="Jméno a příjmení" value={form.name} onChange={(v) => set('name', v)} error={errors.name} />
              <TextField id="phone" type="tel" autoComplete="tel" label="Telefon" optional value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone} />
            </fieldset>

            <fieldset className="checkout-section">
              <legend>2. Adresa</legend>
              <div className="form-group">
                <label htmlFor="country">
                  Země<span className="req"> *</span>
                </label>
                <select id="country" autoComplete="country" value={form.country} onChange={(e) => set('country', e.target.value)}>
                  {countryList.map((code) => (
                    <option key={code} value={code}>
                      {countryName(code)}
                    </option>
                  ))}
                </select>
              </div>
              <TextField id="street" autoComplete="street-address" label="Ulice a číslo popisné" value={form.street} onChange={(v) => set('street', v)} error={errors.street} />
              <TextField id="city" autoComplete="address-level2" label="Město" value={form.city} onChange={(v) => set('city', v)} error={errors.city} />
              <TextField id="postalCode" autoComplete="postal-code" label="PSČ" value={form.postalCode} onChange={(v) => set('postalCode', v)} error={errors.postalCode} />
              <div className="form-group checkbox-row">
                <input id="isCompany" type="checkbox" checked={form.isCompany} onChange={(e) => set('isCompany', e.target.checked)} />
                <label htmlFor="isCompany">Nakupuji na firmu</label>
              </div>
              {form.isCompany && (
                <>
                  <TextField id="company" autoComplete="organization" label="Název firmy" value={form.company} onChange={(v) => set('company', v)} error={errors.company} />
                  <TextField id="vatId" label="DIČ" optional value={form.vatId} onChange={(v) => set('vatId', v)} error={errors.vatId} />
                </>
              )}
              {physical && (
                <div className="form-group checkbox-row">
                  <input id="shipElsewhere" type="checkbox" checked={form.shipElsewhere} onChange={(e) => set('shipElsewhere', e.target.checked)} />
                  <label htmlFor="shipElsewhere">Doručit na jinou adresu</label>
                </div>
              )}
              {physical && form.shipElsewhere && (
                <>
                  <TextField id="shipName" autoComplete="shipping name" label="Jméno příjemce" value={form.shipName} onChange={(v) => set('shipName', v)} error={errors.shipName} />
                  <TextField id="shipStreet" autoComplete="shipping street-address" label="Ulice a číslo popisné (doručení)" value={form.shipStreet} onChange={(v) => set('shipStreet', v)} error={errors.shipStreet} />
                  <TextField id="shipCity" autoComplete="shipping address-level2" label="Město (doručení)" value={form.shipCity} onChange={(v) => set('shipCity', v)} error={errors.shipCity} />
                  <TextField id="shipPostalCode" autoComplete="shipping postal-code" label="PSČ (doručení)" value={form.shipPostalCode} onChange={(v) => set('shipPostalCode', v)} error={errors.shipPostalCode} />
                </>
              )}
            </fieldset>

            {physical && current && (
              <fieldset className="checkout-section">
                <legend>3. Doprava</legend>
                {noShipping ? (
                  <p className="field-error">Do této země bohužel nedoručujeme.</p>
                ) : (
                  current.shippingOptions.map((o, i) => (
                    <label key={o.id} className="choice">
                      <input id={`shipping-${i}`} type="radio" name="shipping" checked={form.shippingMethodId === o.id} onChange={() => set('shippingMethodId', o.id)} />
                      <span>{o.name}</span>
                      <span className="choice-price">{o.price ? money(o.price, current.currency) : 'zdarma'}</span>
                    </label>
                  ))
                )}
                {errors.shipping && <p className="field-error">{errors.shipping}</p>}
                {sectionError('shipping')}
              </fieldset>
            )}

            <fieldset className="checkout-section">
              <legend>{physical ? '4. Platba' : '3. Platba'}</legend>
              {current &&
                payments.map((p, i) => (
                  <label key={p.method} className="choice">
                    <input id={`payment-${i}`} type="radio" name="payment" checked={form.paymentMethod === p.method} onChange={() => set('paymentMethod', p.method)} />
                    <span>{PAYMENT_LABEL[p.method]}</span>
                    {p.fee > 0 && <span className="choice-price">{`+${money(p.fee, current.currency)}`}</span>}
                  </label>
                ))}
              {errors.payment && <p className="field-error">{errors.payment}</p>}
              {sectionError('payment')}
            </fieldset>

            <div className="form-group">
              <label htmlFor="note">
                Poznámka pro prodejce<span className="optional"> (nepovinné)</span>
              </label>
              <textarea
                id="note"
                value={form.note}
                maxLength={1000}
                onChange={(e) => set('note', e.target.value)}
                aria-invalid={errors.note ? true : undefined}
                aria-describedby={errors.note ? 'note-error' : undefined}
              />
              {errors.note && (
                <p id="note-error" className="field-error">
                  {errors.note}
                </p>
              )}
            </div>
          </div>

          <aside className="checkout-summary" aria-labelledby="summary-title">
            <h2 id="summary-title">Souhrn</h2>
            {current ? (
              <>
                <SummaryLines lines={current.lines} currency={current.currency} />
                <SummaryTotals totals={current.totals} shippingName={current.shipping?.name ?? null} currency={current.currency} />
              </>
            ) : quote.isError ? (
              <p className="field-error">Ceny se nepodařilo načíst.</p>
            ) : (
              <Spinner />
            )}
            {hasLineProblem && (
              <p className="field-error">
                Některé zboží v košíku je potřeba upravit.{' '}
                <Link to="/kosik" className="text-link">
                  Upravit košík
                </Link>
              </p>
            )}
            <div className="form-group checkbox-row terms">
              <input
                id="terms"
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => set('acceptTerms', e.target.checked)}
                aria-invalid={errors.terms ? true : undefined}
                aria-describedby={errors.terms ? 'terms-error' : undefined}
              />
              <label htmlFor="terms">
                Souhlasím s{' '}
                <Link to="/obchodni-podminky" target="_blank" className="text-link">
                  obchodními podmínkami
                </Link>
              </label>
            </div>
            {errors.terms && (
              <p id="terms-error" className="field-error">
                {errors.terms}
              </p>
            )}
            {sectionError('terms')}
            {problem && (problem.section === 'form' || problem.section === 'cart') && (
              <div className="banner-error" role="alert">
                {problem.text}
                {problem.section === 'cart' && (
                  <>
                    {' '}
                    <Link to="/kosik" className="text-link">
                      Upravit košík
                    </Link>
                  </>
                )}
              </div>
            )}
            <button type="submit" className="btn btn-block" disabled={!canOrder}>
              Objednat s povinností platby
            </button>
          </aside>
        </form>
      </div>
    </section>
  );
}
```

In `examples/src/App.tsx`, import `CheckoutPage` and add `<Route path="pokladna" element={<CheckoutPage />} />` after the cart route.

Append to `examples/src/styles/global.css`:

```css
.checkout {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 48px;
  margin-top: 32px;
  align-items: start;
}
.checkout-section {
  border: none;
  margin-bottom: 32px;
  min-width: 0;
}
.checkout-section legend {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 1.3rem;
  margin-bottom: 16px;
}
.form-group .optional {
  color: var(--muted);
  text-transform: none;
  letter-spacing: 0;
}
.form-group.checkbox-row label {
  margin-bottom: 0;
  text-transform: none;
  letter-spacing: 0;
  font-family: var(--font-body);
  font-size: 1rem;
}
.choice {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 2px solid var(--line);
  padding: 12px 14px;
  margin-bottom: 8px;
  cursor: pointer;
}
.choice:has(input:checked) {
  border-color: var(--fg);
}
.choice-price {
  margin-left: auto;
  font-family: var(--font-mono);
  white-space: nowrap;
}
.checkout-summary {
  position: sticky;
  top: 96px;
  border: 2px solid var(--fg);
  padding: 20px;
  min-width: 0;
}
.checkout-summary h2 {
  font-size: 1.3rem;
  margin-bottom: 12px;
}
.summary-lines {
  list-style: none;
  margin-bottom: 12px;
}
.summary-lines li {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}
.summary-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.summary-totals div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
}
.summary-totals dd {
  font-family: var(--font-mono);
  white-space: nowrap;
}
.summary-totals .summary-total {
  font-weight: 700;
  font-size: 1.1rem;
  border-top: 2px solid var(--fg);
  margin-top: 6px;
  padding-top: 8px;
}
.vat-note {
  font-size: 0.85rem;
  margin: 8px 0 16px;
}
.terms {
  margin: 16px 0 8px;
}
@media (max-width: 820px) {
  .checkout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  .checkout-summary {
    position: static;
  }
}
```

- [ ] **Step 5: Run the tests and the build**

Run: `pnpm --filter blog-flajsman test && pnpm --filter blog-flajsman build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add examples
git commit -m "feat(examples): one-page checkout with quote refresh and safe retries"
```

---

### Task 6: Order page and terms page

**Files:**
- Create: `examples/src/shop/components/PaymentQr.tsx`, `examples/src/shop/pages/OrderPage.tsx`, `examples/src/shop/pages/TermsPage.tsx`
- Modify: `examples/package.json` (add `qrcode`), `examples/src/App.tsx`, `examples/src/styles/global.css`
- Test: `examples/src/shop/pages/OrderPage.test.tsx`, `examples/src/shop/pages/TermsPage.test.tsx`

**Interfaces:**
- Consumes: `useCustomerOrder`, `useMoney` (Task 3); `SummaryLines`, `SummaryTotals` (Task 5); `usePage` from `src/hooks/usePosts`; `formatDate`; `ApiError`.
- Produces: routes `/objednavka/:number` and `/obchodni-podminky`; `PaymentQr({ text })`.

- [ ] **Step 1: Add the QR package**

Run: `pnpm --filter blog-flajsman add qrcode@^1.5.4 && pnpm --filter blog-flajsman add -D @types/qrcode@^1.5.6`
Expected: installs without errors.

- [ ] **Step 2: Write the failing tests**

Create `examples/src/shop/pages/OrderPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import type { CustomerOrder } from '../types';
import { OrderPage } from './OrderPage';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

const routes = [{ path: '/objednavka/:number', element: <OrderPage /> }];
const base: CustomerOrder = {
  number: '2026000001',
  createdAt: '2026-10-01T10:00:00.000Z',
  status: 'PLACED',
  paymentStatus: 'UNPAID',
  fulfilmentStatus: 'UNFULFILLED',
  currency: 'CZK',
  lines: [
    { name: 'Cyklistické tričko', optionLabels: [{ option: 'Velikost', value: 'S' }], quantity: 1, unitPrice: 49000, lineTotal: 49000, type: 'PHYSICAL' },
    { name: 'Průvodce Šumavou', optionLabels: [], quantity: 1, unitPrice: 29900, lineTotal: 29900, type: 'DIGITAL' },
  ],
  shipping: { name: 'Kurýr', price: 12900 },
  payment: {
    method: 'BANK_TRANSFER',
    fee: 0,
    instructions: { holder: 'Test Shop', iban: 'CZ6508000000192000145399', amount: 91800, currency: 'CZK', reference: '2026000001', qr: 'SPD*1.0*ACC:CZ6508000000192000145399*AM:918.00' },
  },
  totals: { items: 78900, shipping: 12900, paymentFee: 0, total: 91800, vat: [{ rate: 2100, base: 51314, amount: 10776 }, { rate: 1200, base: 26696, amount: 3204 }] },
};

function open(order: CustomerOrder | null, route = '/objednavka/2026000001?t=tok') {
  const api = mockApi({
    'GET /shop/orders/:number': () => (order ? ok(order) : { status: 404, body: { success: false, error: 'Order not found' } }),
  });
  renderRoutes(routes, route);
  return api;
}

it('shows bank transfer details with the variable symbol and the payment QR code', async () => {
  const api = open(base);
  expect(await screen.findByRole('heading', { name: 'Objednávka 2026000001' })).toBeInTheDocument();
  expect(screen.getByText('Variabilní symbol').nextElementSibling).toHaveTextContent('2026000001');
  expect(screen.getByText('IBAN').nextElementSibling).toHaveTextContent('CZ65 0800 0000 1920 0014 5399');
  expect(screen.getByText('Částka').nextElementSibling).toHaveTextContent(/918\sKč/);
  expect(await screen.findByRole('img', { name: 'QR kód pro platbu' })).toHaveAttribute('src', 'data:image/png;base64,QR');
  expect(screen.getByText(/1 × Cyklistické tričko \(S\)/)).toBeInTheDocument();
  expect(api.calls[0].url.searchParams.get('token')).toBe('tok');
});

it('tells a cash on delivery customer to pay on delivery', async () => {
  open({ ...base, lines: [base.lines[0]], payment: { method: 'CASH_ON_DELIVERY', fee: 3900 } });
  expect(await screen.findByText('Zaplatíte při převzetí zásilky.')).toBeInTheDocument();
});

it('says download links were emailed once a digital order is paid', async () => {
  open({ ...base, paymentStatus: 'PAID', payment: { method: 'BANK_TRANSFER', fee: 0 } });
  expect(await screen.findByText('Odkazy ke stažení jsme poslali na váš e-mail.')).toBeInTheDocument();
  expect(screen.queryByText('Variabilní symbol')).not.toBeInTheDocument();
});

it('shows the tracking link once shipped', async () => {
  open({ ...base, status: 'COMPLETED', paymentStatus: 'PAID', fulfilmentStatus: 'SHIPPED', payment: { method: 'BANK_TRANSFER', fee: 0 }, tracking: { number: 'DR123', url: 'https://track.test/DR123' } });
  expect(await screen.findByRole('link', { name: 'Sledovat zásilku' })).toHaveAttribute('href', 'https://track.test/DR123');
  expect(screen.getByText(/DR123/)).toBeInTheDocument();
});

it('says a cancelled order was cancelled', async () => {
  open({ ...base, status: 'CANCELLED', payment: { method: 'BANK_TRANSFER', fee: 0 } });
  expect(await screen.findByText('Objednávka byla zrušena.')).toBeInTheDocument();
});

it('shows nothing of the order for a wrong or missing token', async () => {
  open(null);
  expect(await screen.findByText('Objednávka nenalezena. Zkontrolujte prosím odkaz.')).toBeInTheDocument();
  expect(screen.queryByText('Cyklistické tričko')).not.toBeInTheDocument();
});

it('does not ask the API without a token', async () => {
  const api = open(base, '/objednavka/2026000001');
  expect(await screen.findByText('Objednávka nenalezena. Zkontrolujte prosím odkaz.')).toBeInTheDocument();
  expect(api.calls.filter((c) => c.key.startsWith('GET /shop/orders'))).toHaveLength(0);
});
```

Create `examples/src/shop/pages/TermsPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import { mockApi, ok } from '../../test/api-mock';
import { renderRoutes } from '../../test/render';
import { TermsPage } from './TermsPage';

const routes = [{ path: '/obchodni-podminky', element: <TermsPage /> }];

it('renders the terms page from the CMS', async () => {
  mockApi({
    'GET /content/page': () => ({
      body: { data: [{ id: 'e1', data: { key: 'obchodni-podminky', title: 'Obchodní podmínky', body: '<p>Prodávající: Pavel</p>' } }], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } },
    }),
  });
  renderRoutes(routes, '/obchodni-podminky');
  expect(await screen.findByRole('heading', { name: 'Obchodní podmínky' })).toBeInTheDocument();
  expect(screen.getByText('Prodávající: Pavel')).toBeInTheDocument();
});

it('says when the terms are not written yet', async () => {
  mockApi({ 'GET /content/page': () => ({ body: { data: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } }) });
  renderRoutes(routes, '/obchodni-podminky');
  expect(await screen.findByText('Obchodní podmínky zatím nejsou k dispozici.')).toBeInTheDocument();
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter blog-flajsman test -- src/shop/pages/OrderPage.test.tsx src/shop/pages/TermsPage.test.tsx`
Expected: FAIL, the pages do not exist.

- [ ] **Step 4: Implement the QR, the pages and the routes**

Create `examples/src/shop/components/PaymentQr.tsx`:

```tsx
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** The bank's payment QR code (SPD) drawn in the browser; nothing when it cannot be drawn. */
export function PaymentQr({ text }: { text: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { margin: 2, width: 240 })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setSrc(null);
      });
    return () => {
      live = false;
    };
  }, [text]);
  if (!src) return null;
  return <img className="payment-qr" src={src} width={240} height={240} alt="QR kód pro platbu" />;
}
```

Create `examples/src/shop/pages/OrderPage.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ErrorState, Spinner } from '../../components/Spinner';
import { ApiError } from '../../lib/cms';
import { formatDate } from '../../lib/format';
import { useCustomerOrder, useMoney } from '../hooks';
import { PaymentQr } from '../components/PaymentQr';
import { SummaryLines, SummaryTotals } from '../components/Summary';
import type { CustomerOrder, PaymentInstructions } from '../types';

const NOT_FOUND = 'Objednávka nenalezena. Zkontrolujte prosím odkaz.';

function statusText(o: CustomerOrder): string {
  if (o.status === 'CANCELLED') return 'zrušená';
  if (o.status === 'COMPLETED') return 'vyřízená';
  if (o.fulfilmentStatus === 'SHIPPED') return 'odeslaná';
  return o.paymentStatus === 'PAID' ? 'zaplacená' : 'přijatá';
}

const formatIban = (iban: string) => iban.replace(/(.{4})/g, '$1 ').trim();

function PaymentBox({ instructions }: { instructions: PaymentInstructions }) {
  const money = useMoney();
  return (
    <div className="payment-box">
      <h2>Platba převodem</h2>
      <dl>
        {instructions.accountNumber && (
          <div>
            <dt>Číslo účtu</dt>
            <dd>{instructions.accountNumber}</dd>
          </div>
        )}
        {instructions.iban && (
          <div>
            <dt>IBAN</dt>
            <dd>{formatIban(instructions.iban)}</dd>
          </div>
        )}
        {instructions.bic && (
          <div>
            <dt>BIC</dt>
            <dd>{instructions.bic}</dd>
          </div>
        )}
        <div>
          <dt>Částka</dt>
          <dd>{money(instructions.amount, instructions.currency)}</dd>
        </div>
        <div>
          <dt>Variabilní symbol</dt>
          <dd>{instructions.reference}</dd>
        </div>
        <div>
          <dt>Příjemce</dt>
          <dd>{instructions.holder}</dd>
        </div>
      </dl>
      {instructions.qr && <PaymentQr text={instructions.qr} />}
      <p className="muted">Platbu spárujeme ručně, potvrzení vám přijde e-mailem.</p>
    </div>
  );
}

function StateBlocks({ order }: { order: CustomerOrder }) {
  if (order.status === 'CANCELLED') return <div className="order-state">Objednávka byla zrušena.</div>;
  const blocks: ReactNode[] = [];
  if (order.payment.instructions) blocks.push(<PaymentBox key="pay" instructions={order.payment.instructions} />);
  if (order.payment.method === 'CASH_ON_DELIVERY' && order.fulfilmentStatus === 'UNFULFILLED') {
    blocks.push(
      <div key="cod" className="order-state">
        Zaplatíte při převzetí zásilky.
      </div>,
    );
  }
  if (order.paymentStatus === 'PAID' && order.lines.some((l) => l.type === 'DIGITAL')) {
    blocks.push(
      <div key="downloads" className="order-state">
        Odkazy ke stažení jsme poslali na váš e-mail.
      </div>,
    );
  }
  if (order.fulfilmentStatus === 'SHIPPED' && order.lines.some((l) => l.type === 'PHYSICAL')) {
    blocks.push(
      <div key="shipped" className="order-state">
        <p>Zásilka je na cestě.</p>
        {order.tracking?.number && <p className="mono">{`Číslo zásilky: ${order.tracking.number}`}</p>}
        {order.tracking?.url && (
          <p>
            <a href={order.tracking.url} target="_blank" rel="noreferrer" className="text-link">
              Sledovat zásilku
            </a>
          </p>
        )}
      </div>,
    );
  }
  return <>{blocks}</>;
}

export function OrderPage() {
  const { number = '' } = useParams();
  const [params] = useSearchParams();
  const token = params.get('t') ?? '';
  const location = useLocation();
  const justPlaced = (location.state as { placed?: boolean } | null)?.placed === true;
  const order = useCustomerOrder(number, token);

  let body: ReactNode;
  if (!token) body = <ErrorState message={NOT_FOUND} />;
  else if (order.isLoading) body = <Spinner />;
  else if (order.isError || !order.data) {
    body = <ErrorState message={order.error instanceof ApiError && order.error.status === 404 ? NOT_FOUND : 'Objednávku se nepodařilo načíst.'} />;
  } else {
    const o = order.data;
    body = (
      <>
        <h1>{`Objednávka ${o.number}`}</h1>
        <p className="mono muted">{`Vytvořena ${formatDate(o.createdAt)}, stav: ${statusText(o)}`}</p>
        <StateBlocks order={o} />
        <h2 className="order-items-title">Položky</h2>
        <SummaryLines lines={o.lines} currency={o.currency} />
        <SummaryTotals totals={o.totals} shippingName={o.shipping?.name ?? null} currency={o.currency} />
        <p className="muted">Uložte si odkaz na tuto stránku, vždy na ní uvidíte aktuální stav objednávky.</p>
      </>
    );
  }

  return (
    <section className="article">
      <div className="container">
        <div className="kicker">{justPlaced ? 'děkujeme za objednávku' : 'objednávka'}</div>
        {body}
      </div>
    </section>
  );
}
```

Create `examples/src/shop/pages/TermsPage.tsx`:

```tsx
import { usePage } from '../../hooks/usePosts';
import { RichText } from '../../components/RichText';
import { ErrorState, Spinner } from '../../components/Spinner';

/** Terms, seller details and withdrawal information, written by the shop owner as the CMS page "obchodni-podminky". */
export function TermsPage() {
  const { data: page, isLoading } = usePage('obchodni-podminky');
  return (
    <section className="article">
      <div className="container">
        <div className="kicker">obchodní podmínky</div>
        {isLoading && <Spinner />}
        {!isLoading && !page && <ErrorState message="Obchodní podmínky zatím nejsou k dispozici." />}
        {page && (
          <>
            {page.title && <h1>{page.title}</h1>}
            {page.body && (
              <div style={{ marginTop: 24 }}>
                <RichText html={page.body} />
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
```

In `examples/src/App.tsx`, import `OrderPage` and `TermsPage` and add after the checkout route:

```tsx
          <Route path="objednavka/:number" element={<OrderPage />} />
          <Route path="obchodni-podminky" element={<TermsPage />} />
```

Append to `examples/src/styles/global.css`:

```css
.order-state {
  border-left: 6px solid var(--accent);
  padding: 12px 16px;
  margin: 24px 0;
  background: #fafafa;
}
.payment-box {
  border: 2px solid var(--fg);
  padding: 20px;
  margin: 24px 0;
}
.payment-box h2,
.order-items-title {
  font-size: 1.2rem;
  margin-bottom: 12px;
}
.payment-box dl div {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 4px 0;
  border-bottom: 1px solid var(--line);
}
.payment-box dd {
  font-family: var(--font-mono);
  overflow-wrap: anywhere;
}
.payment-qr {
  display: block;
  margin: 16px auto;
  width: 240px;
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
}
```

- [ ] **Step 5: Run the tests and the build**

Run: `pnpm --filter blog-flajsman test && pnpm --filter blog-flajsman build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add examples pnpm-lock.yaml
git commit -m "feat(examples): order page with payment QR and terms page"
```

---

### Task 7: CI, docs and browser check

**Files:**
- Modify: `.github/workflows/example-website-ci-cd.yml`, `examples/README.md`, `TEST_RESULTS.md`

- [ ] **Step 1: Run the tests in CI**

In `.github/workflows/example-website-ci-cd.yml`, add before the "Build blog" step:

```yaml
      - name: Test blog
        run: pnpm --filter blog-flajsman test
```

- [ ] **Step 2: Document the shop**

In `examples/README.md`, add a section "Shop" after the architecture section:

```markdown
## Shop

The shop lives in `src/shop/` and uses the TheCMS public shop API with the same API key:

- `/obchod` products, `/obchod/:id` product detail, `/kosik` cart, `/pokladna` checkout
- `/objednavka/:number?t=<token>` order status (the personal link shown after ordering)
- `/obchodni-podminky` terms: a page entry with key `obchodni-podminky` in the pages content type; write the seller details, terms and withdrawal information there

The cart is kept in the browser (`flajsman.cart.v1` in localStorage) and holds only variant ids and quantities; prices always come from the API.

Tests: `pnpm --filter blog-flajsman test`.
```

- [ ] **Step 3: Browser check on a throwaway database**

Copy the local database to `thecms_storefront` (never touch `thecms`). Start Azurite, a backend from this worktree on port 3100 against `thecms_storefront`, and set up the shop through the admin API: CZK, Standard 21 % and Reduced 12 %, a CZK bank account with an IBAN, a CZ zone, a Courier method (bank transfer and cash on delivery, fee 39, 2 kg band 129, open band 199), a tee with sizes (stock 3) and an image, a digital guide with a file, both published, a page entry with key `obchodni-podminky`, and a site key. Write `examples/public/config.js` in the worktree pointing at `http://localhost:3100/api/v1/public` with that key and `contentLanguage: ''`, and run `pnpm --filter blog-flajsman dev --port 5176 --strictPort`.

In the browser:
1. `/obchod` lists both products; the tee detail shows sizes, stock, and adds 1 × S; the guide adds to the cart.
2. `/kosik` shows both lines and the subtotal; raising S above the stock shows "Skladem jen 3 ks." with "Snížit na 3".
3. `/pokladna`: only bank transfer is offered (digital item in the cart); fill the form, accept terms, order.
4. The order page shows bank details, the variable symbol and a QR code; the cart is empty.
5. In the admin, mark the order paid and shipped with a tracking link; reload the order page: "Odkazy ke stažení jsme poslali na váš e-mail." and the tracking link.
6. A second order with the tee only and cash on delivery shows "Zaplatíte při převzetí zásilky.".
7. A wrong token on the order page shows "Objednávka nenalezena.".
8. Each shop page at 360px (iframe or a narrow window) has no horizontal scroll; no console errors.
Expected: as described.

- [ ] **Step 4: QR scan**

Ask your human partner to scan the order page's QR code with a Czech banking app and record exactly what they report (or "not scanned").

- [ ] **Step 5: Record and clean up**

Append "E-shop storefront verification" to `TEST_RESULTS.md` with a table of the checks above (failures described as found), stop the servers, delete `examples/public/config.js` from the worktree if it was created there, drop `thecms_storefront`, and commit:

```bash
git add .github/workflows/example-website-ci-cd.yml examples/README.md TEST_RESULTS.md
git commit -m "docs: storefront tests in CI and verification"
```

---

## Self-Review Notes

- **Spec coverage:** section 2 decisions → Global Constraints and Tasks 1 to 6; section 3 pages → Tasks 3 (list, detail), 4 (cart), 5 (checkout), 6 (order, terms); header link → Task 2; section 4 cart → Tasks 2 and 4; section 5 checkout sections, quote refresh, idempotency, field checks and the answer table → Tasks 1 (`checkoutProblem`) and 5; section 6 order page states → Task 6; section 7 structure → File Structure (the `request` change is in Task 1); section 8 tests, CI, 360px and browser check → every task, Task 7; section 10 out of scope respected (no backend changes).
- **Type consistency:** `CartItem`, `Quote`, `QuoteRequest`, `OrderRequest`, `CustomerOrder`, `ShopProduct`, `useCart`, `useQuote`, `quoteKey`, `useMoney`, `useDebounced`, `quoteFor`, `COURIER`, `SummaryLines`, `SummaryTotals`, `checkoutKey`, `forgetCheckoutKey`, `checkoutProblem` are used with the same names and shapes in every task.
- **Review Focus:** each line has its test in the owning task (Task 5 double click and network retry, Task 5 price change, Tasks 4 and 5 stock, Task 2 storage, Task 6 token).
