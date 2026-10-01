# E-shop Orders, Plan 2: Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shop owners run checkout from the admin: checkout settings (bank accounts, days, limits, shop email, terms link), a Shipping page (zones and methods with weight bands), an Orders list with a "needs action" badge, and an order page with Mark as paid, Mark as shipped, Cancel and Resend.

**Architecture:** Two new API and query modules (`orders-*`, `shipping-*`) sit beside the catalogue ones in `features/commerce`. Form logic that turns typed text into API bodies lives in pure, unit-tested files (`checkout-form.ts`, `shipping-form.ts`, `order-rules.ts`); pages and components only render and call them. Two new i18n namespaces, `shipping` and `orders`, keep the catalogue's `commerce` catalog from growing further. One small additive backend change: `GET /commerce/orders?needsAction=true`.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, react-i18next (typed keys, `en`/`cs`), shadcn/ui, Vitest + Testing Library + axe; backend Express + Zod + Jest for the one filter.

**Spec:** `docs/superpowers/specs/2026-10-01-eshop-checkout-orders-design.md` (sections 3.1 to 3.4, 9 and 12). Backend: `docs/superpowers/plans/2026-10-01-eshop-orders-plan-1-backend.md` (merged).

## Global Constraints

- All new UI text comes from catalogs in English and Czech (`one`/`other` and `one`/`few`/`other` plurals); `pnpm --filter admin-dashboard lint` reports 0 problems; typed keys use `{ ns: 'x' }` for other namespaces.
- Money is integer minor units on the wire; the admin shows and edits it with the currency's decimals and the admin language's number format (`toMinor`, `fromMinor`, `formatMoney` in `features/commerce/money.ts`).
- Every screen passes axe in English and Czech and works at 360px with no horizontal scroll.
- Server messages are shown as sent (`apiErrorMessage`); our own fallbacks follow the admin language.
- Backend contract (Plan 1, all under `/commerce`, admin auth):
  - `GET/PUT /settings`: the PUT needs `currencies` and `vatRates`; every other field left out keeps its stored value; `shopEmail: null` and `termsUrl: null` remove them. Settings fields: `bankAccounts[{ currency, accountNumber?, iban?, bic?, holder }]`, `unpaidCancelDays` (1 to 90), `downloadDays` (1 to 365), `downloadLimit` (1 to 100), `shopEmail?`, `termsUrl?`.
  - `GET/POST /shipping/zones`, `PUT/DELETE /shipping/zones/:id`: `{ id, name, countries, rest, order }`; delete of a zone a method uses is `409 "A shipping method uses this zone"`.
  - `GET/POST /shipping/methods`, `PUT/DELETE /shipping/methods/:id`: `{ id, labels, active, paymentMethods, codFees, freeOver, rates[{ zoneId, bands[{ upToGrams | null, prices }] }], order }`. There is no single-method GET.
  - `GET /orders?page&limit&search&status&paymentStatus&fulfilmentStatus` returns `{ data: [{ id, number, createdAt, customer: { name, email }, total, currency, status, paymentStatus, fulfilmentStatus }], pagination }`; `GET /orders/needs-action` returns `{ count }`; `GET /orders/:id` returns the whole order plus `instructions` while it is open and unpaid.
  - `POST /orders/:id/paid`, `POST /orders/:id/shipped { trackingNumber?, trackingUrl? }`, `POST /orders/:id/cancel { refunded? }`, `POST /orders/:id/resend { what: 'confirmation' | 'downloads' }`, `PUT /orders/:id/note { note }`. Actions in the wrong state return `409`; the action responses carry the order without `instructions`.
- Run `pnpm --filter admin-dashboard test`, `lint` and `build` at the end of every task (and `pnpm --filter @thecms/backend test` in Task 1).
- Never use an em dash in code, copy or docs.

## Decisions (for the reviewer)

1. **Checkout settings save on their own** ("Save checkout settings"), and the currency and VAT part now sends only `currencies`, `defaultCurrency` and `vatRates`. The server keeps fields a save leaves out, so neither part can overwrite the other's unsaved or stored values.
2. **Zones edit in a dialog; a shipping method has its own page** (`/commerce/shipping/methods/:id`, `new` creates). A method has labels per language, payment choices, fees and a band table per zone, which does not fit a dialog at 360px.
3. **Order actions are plain buttons that wrap**, not a dropdown, so they work at 360px and in tests without pointer emulation.
4. **"Needs action" is a backend filter** (`needsAction=true`) that reuses the badge's rule, so the badge count and the filtered list always agree.
5. **The admin shows the bank transfer details as text and no QR image**; the customer gets the QR code by email, and the admin would need a QR library only for this.

## Review Focus

1. **Typing "129,5" in Czech or "129.5" in English in the method editor**: saved as 12950 minor units; "abc" shows a field error and nothing is sent. Tested in Task 4 (helpers and page).
2. **Saving checkout settings and then currencies, or the other way round**: neither save drops the other part's values, and "Save settings" stays disabled after a checkout save. Tested in Task 2.
3. **An order action that is no longer possible (another admin shipped it, the job cancelled it)**: the server's 409 message is shown and the order reloads to its real state. Tested in Task 6.
4. **An IBAN typed with spaces or lowercase, or a bank account with neither number nor IBAN**: the IBAN is sent normalised; the missing number shows a field error and nothing is sent. Tested in Task 2.
5. **Deleting a zone that a method uses**: the server's reason is shown and the zone stays in the list. Tested in Task 3.

---

## File Structure

All admin paths are relative to `packages/admin-dashboard/src`.

| File | Responsibility |
|---|---|
| `packages/backend/src/modules/commerce/commerce.schema.ts`, `order-actions.ts`, `orders-admin.test.ts` | `needsAction` list filter |
| `features/commerce/commerce-api.ts` | Settings types gain checkout fields; `withoutEmpty` exported |
| `features/commerce/orders-api.ts`, `orders-queries.ts` | Order types, calls, query hooks, write helpers, badge hook |
| `features/commerce/shipping-api.ts`, `shipping-queries.ts` | Zone and method types, calls, hooks, writes |
| `features/commerce/money.ts` | `currencyFor` |
| `features/commerce/countries.ts` | `countryName`, `parseCountries` |
| `features/commerce/checkout-form.ts` | Checkout settings form to API body |
| `features/commerce/shipping-form.ts` | Method form to API body |
| `features/commerce/order-rules.ts` | Which actions an order allows |
| `features/commerce/components/TextField.tsx` | Label, input, hint and error in one |
| `features/commerce/components/CheckoutSettingsSection.tsx` | Checkout part of Shop settings |
| `features/commerce/pages/ShopSettingsPage.tsx` | Sends only its own fields; hosts the checkout section |
| `features/commerce/pages/ShippingPage.tsx`, `components/ZoneDialog.tsx` | Zones and methods list |
| `features/commerce/pages/ShippingMethodPage.tsx`, `components/MethodEditor.tsx` | Method editor |
| `features/commerce/pages/OrdersListPage.tsx`, `components/OrderBadges.tsx` | Orders list |
| `features/commerce/pages/OrderPage.tsx`, `components/order/OrderLines.tsx`, `OrderDetails.tsx`, `OrderHistory.tsx`, `OrderActions.tsx`, `InternalNote.tsx` | Order page |
| `i18n/locales/{en,cs}/shipping.json`, `orders.json`, `commerce.json`, `shell.json`, `webhooks.json`, `i18n/resources.ts` | Catalogs |
| `modules/registry.tsx` | Orders (with badge) and Shipping in the Commerce group |
| `features/webhooks/webhook-events.ts` | Order events |

---

### Task 1: API layer, needs-action filter and order webhook events

**Files:**
- Modify: `packages/backend/src/modules/commerce/commerce.schema.ts` (`listOrdersSchema`), `packages/backend/src/modules/commerce/order-actions.ts` (`OrderListOptions`, `OrdersAdminService.list`, `needsAction`)
- Test: `packages/backend/src/modules/commerce/orders-admin.test.ts`
- Modify: `features/commerce/commerce-api.ts`, `features/commerce/money.ts`, `features/webhooks/webhook-events.ts`, `i18n/locales/{en,cs}/webhooks.json`
- Create: `features/commerce/orders-api.ts`, `orders-queries.ts`, `shipping-api.ts`, `shipping-queries.ts`
- Test: `features/webhooks/webhook-events.test.ts`, `features/commerce/money.test.ts`, `features/commerce/orders-queries.test.tsx`

**Interfaces:**
- Produces (admin): `withoutEmpty(params)`; `BankAccount`; `ShopSettings` with `bankAccounts?`, `unpaidCancelDays?`, `downloadDays?`, `downloadLimit?`, `shopEmail?: string | null`, `termsUrl?: string | null`; `currencyFor(code, currencies): ShopCurrency`.
- Produces (orders): types `OrderStatus`, `PaymentStatus`, `FulfilmentStatus`, `PaymentMethod`, `PAYMENT_METHODS`, `OrderListItem`, `OrderListParams`, `Address`, `OrderLine`, `OrderHistoryEntry`, `PaymentInstructions`, `Order`; calls `listOrders`, `getOrder`, `ordersNeedingAction`, `markOrderPaid`, `markOrderShipped`, `cancelOrder`, `resendOrderEmail`, `saveOrderNote`; hooks `orderKeys`, `useOrders`, `useOrder`, `useOrdersNeedingAction(): number | undefined`, `useOrderWrites()` with `markPaid(id)`, `markShipped(id, tracking)`, `cancel(id, refunded)`, `resend(id, what)`, `saveNote(id, note)`, `refresh(id)`.
- Produces (shipping): types `ShippingZone`, `ZoneInput`, `WeightBand`, `ShippingRate`, `ShippingMethod`, `MethodInput`; calls `listZones`, `createZone`, `updateZone`, `deleteZone`, `listMethods`, `createMethod`, `updateMethod`, `deleteMethod`; hooks `shippingKeys`, `useZones`, `useMethods`, `useShippingWrites()` with `saveZone(id | undefined, body)`, `removeZone(id)`, `saveMethod(id | undefined, body)`, `removeMethod(id)`.

- [ ] **Step 1: Write the failing backend test**

Append to `packages/backend/src/modules/commerce/orders-admin.test.ts`:

```ts
it('filters the list to orders that need action, together with a search', async () => {
  const shop = await seedShop();
  await placeTestOrder(shop);
  const paid = await placeTestOrder(shop);
  await request(app).post(`/commerce/orders/${paid._id}/paid`);
  const res = await request(app).get('/commerce/orders').query({ needsAction: 'true', search: 'jana' });
  expect(res.body.data.map((o: { number: string }) => o.number)).toEqual([paid.number]);
  expect(res.body.pagination.total).toBe(1);
  expect((await request(app).get('/commerce/orders').query({ needsAction: 'false' })).body.pagination.total).toBe(2);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @thecms/backend exec jest src/modules/commerce/orders-admin.test.ts -t "need action"`
Expected: FAIL, both orders returned (the parameter is ignored).

- [ ] **Step 3: Implement the filter**

In `commerce.schema.ts`, add to `listOrdersSchema.query`:

```ts
    needsAction: z.enum(['true', 'false']).optional(),
```

In `order-actions.ts`, add `needsAction?: 'true' | 'false';` to `OrderListOptions`, put the rule in one constant above `OrdersAdminService`, and build the filter with `$and` so the search's `$or` and the rule's `$or` do not collide:

```ts
/** Paid and unshipped, or cash on delivery and unshipped: the shop has to send these. */
const NEEDS_ACTION = {
  status: 'PLACED',
  fulfilmentStatus: 'UNFULFILLED',
  $or: [{ paymentStatus: 'PAID' }, { 'payment.method': 'CASH_ON_DELIVERY' }],
};
```

```ts
  async list(opts: OrderListOptions = {}) {
    const { page = 1, limit = 20, search, status, paymentStatus, fulfilmentStatus, needsAction, sortOrder = 'desc' } = opts;
    const and: Record<string, unknown>[] = [];
    if (status) and.push({ status });
    if (paymentStatus) and.push({ paymentStatus });
    if (fulfilmentStatus) and.push({ fulfilmentStatus });
    if (search) {
      const text = escapeRegex(search.trim());
      and.push({ $or: [{ number: { $regex: `^${text}` } }, { 'customer.email': { $regex: text, $options: 'i' } }, { 'customer.name': { $regex: text, $options: 'i' } }] });
    }
    if (needsAction === 'true') and.push(NEEDS_ACTION);
    const filter = and.length ? { $and: and } : {};
```

Keep the rest of `list` as it is. Change `needsAction()` to `return OrderModel.countDocuments(NEEDS_ACTION).exec();`.

- [ ] **Step 4: Run the backend tests**

Run: `pnpm --filter @thecms/backend exec jest src/modules/commerce/orders-admin.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Write the failing admin tests**

Replace the first test of `features/webhooks/webhook-events.test.ts` and add Czech order labels to the Czech test:

```ts
it('groups every backend event', () => {
  expect(getEventGroups().map((g) => g.label)).toEqual(['Entries', 'Content models', 'Media', 'Commerce'])
  expect(getEventGroups().flatMap((g) => g.events.map((e) => e.value))).toHaveLength(18)
  expect(eventLabel('entry.published')).toBe('Entry published')
  expect(eventLabel('order.paid')).toBe('Order paid')
  expect(eventLabel('custom.thing')).toBe('custom.thing')
})
```

In `'labels groups, events and errors in Czech'`, after `expect(eventLabel('entry.published')).toBe('Položka publikována')` add:

```ts
  expect(eventLabel('order.cancelled')).toBe('Objednávka zrušena')
```

Append to `features/commerce/money.test.ts`:

```ts
it('finds a currency by code and falls back to two decimals', () => {
  const currencies = [{ code: 'CZK', decimals: 2 }, { code: 'JPY', decimals: 0 }]
  expect(currencyFor('JPY', currencies)).toEqual({ code: 'JPY', decimals: 0 })
  expect(currencyFor('EUR', currencies)).toEqual({ code: 'EUR', decimals: 2 })
})
```

(Add `currencyFor` to the file's import from `./money`.)

Create `features/commerce/orders-queries.test.tsx`:

```tsx
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { useOrdersNeedingAction } from './orders-queries'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
}

it('returns the count of orders that need action, and nothing for zero', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: { count: 3 } } })
  const three = renderHook(() => useOrdersNeedingAction(), { wrapper })
  await waitFor(() => expect(three.result.current).toBe(3))
  expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders/needs-action')
  vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { success: true, data: { count: 0 } } })
  const none = renderHook(() => useOrdersNeedingAction(), { wrapper })
  await waitFor(() => expect(vi.mocked(apiClient.get)).toHaveBeenCalledTimes(2))
  expect(none.result.current).toBeUndefined()
})
```

- [ ] **Step 6: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/webhooks/webhook-events.test.ts src/features/commerce/money.test.ts src/features/commerce/orders-queries.test.tsx`
Expected: FAIL (14 events, `currencyFor` and `./orders-queries` missing).

- [ ] **Step 7: Implement the admin API layer**

In `features/commerce/commerce-api.ts`, export `withoutEmpty` (change `function withoutEmpty` to `export function withoutEmpty`) and replace `ShopSettings`:

```ts
export interface BankAccount {
  currency: string
  accountNumber?: string
  iban?: string
  bic?: string
  holder: string
}

export interface ShopSettings {
  currencies: ShopCurrency[]
  defaultCurrency?: string
  vatRates: VatRate[]
  bankAccounts?: BankAccount[]
  unpaidCancelDays?: number
  downloadDays?: number
  downloadLimit?: number
  /** null removes the stored value. */
  shopEmail?: string | null
  termsUrl?: string | null
}
```

Append to `features/commerce/money.ts`:

```ts
/** The shop's currency for a code; an unknown code (removed since the order) shows with 2 decimals. */
export function currencyFor(code: string, currencies: { code: string; decimals: number }[]): { code: string; decimals: number } {
  return currencies.find((c) => c.code === code) ?? { code, decimals: 2 }
}
```

Create `features/commerce/orders-api.ts`:

```ts
import apiClient from '@/lib/api'
import type { ApiResponse, PaginatedResponse } from '@/types'
import { withoutEmpty } from './commerce-api'

export type OrderStatus = 'PLACED' | 'COMPLETED' | 'CANCELLED'
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED'
export type FulfilmentStatus = 'UNFULFILLED' | 'SHIPPED'
export type PaymentMethod = 'BANK_TRANSFER' | 'CASH_ON_DELIVERY'
export const PAYMENT_METHODS: PaymentMethod[] = ['BANK_TRANSFER', 'CASH_ON_DELIVERY']
export const ORDER_STATUSES: OrderStatus[] = ['PLACED', 'COMPLETED', 'CANCELLED']
export const PAYMENT_STATUSES: PaymentStatus[] = ['UNPAID', 'PAID', 'REFUNDED']
export const FULFILMENT_STATUSES: FulfilmentStatus[] = ['UNFULFILLED', 'SHIPPED']

export interface OrderListItem {
  id: string
  number: string
  createdAt: string
  customer: { name: string; email: string }
  total: number
  currency: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfilmentStatus: FulfilmentStatus
}

export interface OrderListParams {
  search?: string
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  fulfilmentStatus?: FulfilmentStatus
  needsAction?: boolean
  page?: number
  limit?: number
}

export interface Address {
  name: string
  company?: string
  street: string
  city: string
  postalCode: string
  country: string
  vatId?: string
}

export interface OrderLine {
  productId: string
  variantId: string
  itemId: string
  sku: string
  name: string
  optionLabels: { option: string; value: string }[]
  type: 'PHYSICAL' | 'DIGITAL'
  unitPrice: number
  quantity: number
  vatRate: number
  lineTotal: number
  weightGrams: number
}

export interface OrderHistoryEntry {
  at: string
  type: string
  by?: string
  detail?: string
}

export interface PaymentInstructions {
  holder: string
  accountNumber?: string
  iban?: string
  bic?: string
  amount: number
  currency: string
  reference: string
  qr?: string
}

export interface Order {
  id: string
  number: string
  currency: string
  language: string
  customer: { email: string; name: string; phone?: string }
  billingAddress: Address
  shippingAddress?: Address
  note?: string
  lines: OrderLine[]
  shipping: { methodId: string; name: string; price: number } | null
  payment: { method: PaymentMethod; fee: number; reference: string }
  totals: { items: number; shipping: number; paymentFee: number; total: number; vat: { rate: number; base: number; amount: number }[] }
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfilmentStatus: FulfilmentStatus
  tracking?: { number?: string; url?: string }
  internalNote?: string
  history: OrderHistoryEntry[]
  createdAt: string
  /** Present while the order is open and unpaid. */
  instructions?: PaymentInstructions
}

export async function listOrders(params: OrderListParams): Promise<PaginatedResponse<OrderListItem>> {
  const { needsAction, ...rest } = params
  return (await apiClient.get<PaginatedResponse<OrderListItem>>('/commerce/orders', { params: withoutEmpty({ ...rest, needsAction: needsAction ? 'true' : undefined }) })).data
}

export async function getOrder(id: string): Promise<Order> {
  return (await apiClient.get<ApiResponse<Order>>(`/commerce/orders/${id}`)).data.data
}

export async function ordersNeedingAction(): Promise<number> {
  return (await apiClient.get<ApiResponse<{ count: number }>>('/commerce/orders/needs-action')).data.data.count
}

export async function markOrderPaid(id: string): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/paid`)).data.data
}

export async function markOrderShipped(id: string, tracking: { trackingNumber?: string; trackingUrl?: string }): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/shipped`, tracking)).data.data
}

export async function cancelOrder(id: string, refunded: boolean): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/cancel`, { refunded })).data.data
}

export async function resendOrderEmail(id: string, what: 'confirmation' | 'downloads'): Promise<Order> {
  return (await apiClient.post<ApiResponse<Order>>(`/commerce/orders/${id}/resend`, { what })).data.data
}

export async function saveOrderNote(id: string, note: string): Promise<Order> {
  return (await apiClient.put<ApiResponse<Order>>(`/commerce/orders/${id}/note`, { note })).data.data
}
```

Create `features/commerce/orders-queries.ts`:

```ts
import { useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelOrder,
  getOrder,
  listOrders,
  markOrderPaid,
  markOrderShipped,
  ordersNeedingAction,
  resendOrderEmail,
  saveOrderNote,
  type OrderListParams,
} from './orders-api'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: OrderListParams) => [...orderKeys.lists(), params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
  needsAction: () => [...orderKeys.all, 'needs-action'] as const,
}

export function useOrders(params: OrderListParams) {
  return useQuery({ queryKey: orderKeys.list(params), queryFn: () => listOrders(params), placeholderData: keepPreviousData })
}

export function useOrder(id?: string) {
  return useQuery({ queryKey: orderKeys.detail(id ?? ''), queryFn: () => getOrder(id!), enabled: !!id })
}

/** Navigation badge: orders the shop has to send. Refreshed every minute; zero shows no badge. */
export function useOrdersNeedingAction(): number | undefined {
  const query = useQuery({ queryKey: orderKeys.needsAction(), queryFn: ordersNeedingAction, refetchInterval: 60_000, staleTime: 30_000 })
  return query.data || undefined
}

/** Every action reloads the order (the action responses carry no payment instructions), the lists and the badge. */
export function useOrderWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = async (id: string) => {
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() })
      void queryClient.invalidateQueries({ queryKey: orderKeys.needsAction() })
      await queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) })
    }
    const after = async <T,>(id: string, run: Promise<T>) => {
      const result = await run
      await refresh(id)
      return result
    }
    return {
      refresh,
      markPaid: (id: string) => after(id, markOrderPaid(id)),
      markShipped: (id: string, tracking: { trackingNumber?: string; trackingUrl?: string }) => after(id, markOrderShipped(id, tracking)),
      cancel: (id: string, refunded: boolean) => after(id, cancelOrder(id, refunded)),
      resend: (id: string, what: 'confirmation' | 'downloads') => after(id, resendOrderEmail(id, what)),
      saveNote: (id: string, note: string) => after(id, saveOrderNote(id, note)),
    }
  }, [queryClient])
}
```

Create `features/commerce/shipping-api.ts`:

```ts
import apiClient from '@/lib/api'
import type { ApiResponse } from '@/types'
import type { Labels } from './commerce-api'
import type { PaymentMethod } from './orders-api'

export interface ShippingZone {
  id: string
  name: string
  countries: string[]
  rest: boolean
  order: number
}
export type ZoneInput = Pick<ShippingZone, 'name' | 'countries' | 'rest'>

export interface WeightBand {
  /** null: no upper limit (only the last band). */
  upToGrams: number | null
  prices: Record<string, number>
}

export interface ShippingRate {
  zoneId: string
  bands: WeightBand[]
}

export interface ShippingMethod {
  id: string
  labels: Labels
  active: boolean
  paymentMethods: PaymentMethod[]
  codFees: Record<string, number>
  freeOver: Record<string, number>
  rates: ShippingRate[]
  order: number
}
export type MethodInput = Omit<ShippingMethod, 'id' | 'order'>

export async function listZones(): Promise<ShippingZone[]> {
  return (await apiClient.get<ApiResponse<ShippingZone[]>>('/commerce/shipping/zones')).data.data
}

export async function createZone(body: ZoneInput): Promise<ShippingZone> {
  return (await apiClient.post<ApiResponse<ShippingZone>>('/commerce/shipping/zones', body)).data.data
}

export async function updateZone(id: string, body: ZoneInput): Promise<ShippingZone> {
  return (await apiClient.put<ApiResponse<ShippingZone>>(`/commerce/shipping/zones/${id}`, body)).data.data
}

export async function deleteZone(id: string): Promise<void> {
  await apiClient.delete(`/commerce/shipping/zones/${id}`)
}

export async function listMethods(): Promise<ShippingMethod[]> {
  return (await apiClient.get<ApiResponse<ShippingMethod[]>>('/commerce/shipping/methods')).data.data
}

export async function createMethod(body: MethodInput): Promise<ShippingMethod> {
  return (await apiClient.post<ApiResponse<ShippingMethod>>('/commerce/shipping/methods', body)).data.data
}

export async function updateMethod(id: string, body: MethodInput): Promise<ShippingMethod> {
  return (await apiClient.put<ApiResponse<ShippingMethod>>(`/commerce/shipping/methods/${id}`, body)).data.data
}

export async function deleteMethod(id: string): Promise<void> {
  await apiClient.delete(`/commerce/shipping/methods/${id}`)
}
```

Create `features/commerce/shipping-queries.ts`:

```ts
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMethod,
  createZone,
  deleteMethod,
  deleteZone,
  listMethods,
  listZones,
  updateMethod,
  updateZone,
  type MethodInput,
  type ShippingMethod,
  type ZoneInput,
} from './shipping-api'

export const shippingKeys = {
  all: ['shipping'] as const,
  zones: () => [...shippingKeys.all, 'zones'] as const,
  methods: () => [...shippingKeys.all, 'methods'] as const,
}

export function useZones() {
  return useQuery({ queryKey: shippingKeys.zones(), queryFn: listZones, staleTime: 30_000 })
}

export function useMethods() {
  return useQuery({ queryKey: shippingKeys.methods(), queryFn: listMethods, staleTime: 30_000 })
}

export function useShippingWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: shippingKeys.all })
    return {
      saveZone: async (id: string | undefined, body: ZoneInput) => {
        const saved = id ? await updateZone(id, body) : await createZone(body)
        refresh()
        return saved
      },
      removeZone: async (id: string) => {
        await deleteZone(id)
        refresh()
      },
      saveMethod: async (id: string | undefined, body: MethodInput) => {
        const saved = id ? await updateMethod(id, body) : await createMethod(body)
        // The editor opens the saved method by id right away, so put it in the list before the refetch.
        queryClient.setQueryData<ShippingMethod[]>(shippingKeys.methods(), (old = []) =>
          old.some((m) => m.id === saved.id) ? old.map((m) => (m.id === saved.id ? saved : m)) : [...old, saved],
        )
        refresh()
        return saved
      },
      removeMethod: async (id: string) => {
        await deleteMethod(id)
        refresh()
      },
    }
  }, [queryClient])
}
```

In `features/webhooks/webhook-events.ts`, change the commerce group to:

```ts
  { key: 'commerce', events: ['product.updated', 'product.deleted', 'stock.changed', 'order.placed', 'order.paid', 'order.shipped', 'order.cancelled'] },
```

In `i18n/locales/en/webhooks.json` `events`, after `"stock_changed"` add:

```json
    "order_placed": "Order placed",
    "order_paid": "Order paid",
    "order_shipped": "Order shipped",
    "order_cancelled": "Order cancelled"
```

In `i18n/locales/cs/webhooks.json` `events`, after `"stock_changed"` add:

```json
    "order_placed": "Objednávka přijata",
    "order_paid": "Objednávka zaplacena",
    "order_shipped": "Objednávka odeslána",
    "order_cancelled": "Objednávka zrušena"
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/webhooks src/features/commerce`
Expected: PASS.

- [ ] **Step 9: Full checks and commit**

Run: `pnpm --filter @thecms/backend test && pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass, lint 0 problems.

```bash
git add packages/backend/src/modules/commerce packages/admin-dashboard/src/features packages/admin-dashboard/src/i18n
git commit -m "feat(admin): orders and shipping API layer, needs-action filter, order webhook events"
```

---

### Task 2: Checkout settings

**Files:**
- Create: `features/commerce/checkout-form.ts`, `features/commerce/components/TextField.tsx`, `features/commerce/components/CheckoutSettingsSection.tsx`
- Modify: `features/commerce/pages/ShopSettingsPage.tsx`, `i18n/locales/{en,cs}/commerce.json`
- Test: `features/commerce/checkout-form.test.ts`, `features/commerce/pages/ShopSettingsPage.test.tsx`

**Interfaces:**
- Consumes: `ShopSettings`, `BankAccount` (Task 1); `useCommerceWrites().saveSettings`.
- Produces: `TextField({ id, label, value, onChange, hint?, error?, inputMode?, type?, className? })` used by Tasks 3, 4, 6; `checkoutToForm`, `formToCheckout`, `CheckoutForm`, `CheckoutErrorKey`.

- [ ] **Step 1: Write the failing tests**

Create `features/commerce/checkout-form.test.ts`:

```ts
import { checkoutToForm, formToCheckout } from './checkout-form'

const base = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [] }

it('fills defaults and turns empty email and terms into null', () => {
  const form = checkoutToForm(base)
  expect(form).toEqual({ accounts: [], unpaidCancelDays: '14', downloadDays: '30', downloadLimit: '5', shopEmail: '', termsUrl: '' })
  expect(formToCheckout(form).body).toEqual({ bankAccounts: [], unpaidCancelDays: 14, downloadDays: 30, downloadLimit: 5, shopEmail: null, termsUrl: null })
})

it('normalises an IBAN typed with spaces and drops empty optional fields', () => {
  const form = { ...checkoutToForm(base), accounts: [{ currency: 'CZK', holder: ' Test Shop ', accountNumber: '', iban: 'cz65 0800 0000 1920 0014 5399', bic: '' }] }
  expect(formToCheckout(form).body?.bankAccounts).toEqual([{ currency: 'CZK', holder: 'Test Shop', iban: 'CZ6508000000192000145399' }])
})

it('names every invalid field and returns no body', () => {
  const form = {
    accounts: [{ currency: 'CZK', holder: '', accountNumber: '', iban: '', bic: 'ABC' }],
    unpaidCancelDays: '0',
    downloadDays: '1,5',
    downloadLimit: '101',
    shopEmail: 'shop@',
    termsUrl: 'ftp://x',
  }
  const result = formToCheckout(form)
  expect(result.body).toBeUndefined()
  expect(result.errors).toEqual({
    'account-CZK-holder': 'holder',
    'account-CZK-accountNumber': 'account',
    'account-CZK-bic': 'bic',
    'unpaid-days': 'unpaidCancelDays',
    'download-days': 'downloadDays',
    'download-limit': 'downloadLimit',
    'shop-email': 'email',
    'terms-url': 'url',
  })
})
```

In `features/commerce/pages/ShopSettingsPage.test.tsx`, replace the `saved` constant so the GET returns stored checkout fields (the first test then proves the currency save sends only its own three fields):

```ts
const saved = {
  currencies: [{ code: 'CZK', decimals: 2 }],
  defaultCurrency: 'CZK',
  vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }],
  bankAccounts: [],
  unpaidCancelDays: 14,
  downloadDays: 30,
  downloadLimit: 5,
  termsUrl: 'https://shop.test/terms',
}
```

Append:

```tsx
it('adds a bank account, clears the terms link and saves only checkout settings', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add bank account for CZK' }))
  await userEvent.type(screen.getByLabelText('Account holder'), 'Test Shop')
  await userEvent.type(screen.getByLabelText('IBAN'), 'cz65 0800 0000 1920 0014 5399')
  await userEvent.clear(screen.getByLabelText('Terms and conditions link'))
  const days = screen.getByLabelText('Cancel unpaid transfers after (days)')
  await userEvent.clear(days)
  await userEvent.type(days, '10')
  await userEvent.click(screen.getByRole('button', { name: 'Save checkout settings' }))
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith('/commerce/settings', {
      currencies: saved.currencies,
      defaultCurrency: 'CZK',
      vatRates: saved.vatRates,
      bankAccounts: [{ currency: 'CZK', holder: 'Test Shop', iban: 'CZ6508000000192000145399' }],
      unpaidCancelDays: 10,
      downloadDays: 30,
      downloadLimit: 5,
      shopEmail: null,
      termsUrl: null,
    }),
  )
  expect(await screen.findByText('Checkout settings saved')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled()
  await expectNoA11yViolations(container)
})

it('marks a bank account without number or IBAN and a bad email, and sends nothing', async () => {
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add bank account for CZK' }))
  await userEvent.type(screen.getByLabelText('Account holder'), 'Test Shop')
  await userEvent.type(screen.getByLabelText('Email for new orders'), 'shop@')
  await userEvent.click(screen.getByRole('button', { name: 'Save checkout settings' }))
  expect(screen.getByText('Enter an account number (up to 40 characters) or an IBAN')).toBeInTheDocument()
  expect(screen.getByText('Enter an email address')).toBeInTheDocument()
  expect(screen.getByLabelText('Account number')).toHaveAttribute('aria-invalid', 'true')
  expect(apiClient.put).not.toHaveBeenCalled()
})

it('keeps unsaved checkout edits when the currencies are saved', async () => {
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.type(await screen.findByLabelText('Email for new orders'), 'shop@example.test')
  await userEvent.type(screen.getByLabelText('Currency code'), 'EUR')
  await userEvent.click(screen.getByRole('button', { name: 'Add currency' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1))
  expect(screen.getByLabelText('Email for new orders')).toHaveValue('shop@example.test')
  expect(screen.getByRole('button', { name: 'Save checkout settings' })).toBeEnabled()
})

it('renders the checkout section in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  expect(await screen.findByRole('heading', { name: 'Objednávky a platby' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Přidat bankovní účet pro CZK' })).toBeInTheDocument()
  expect(screen.getByLabelText('Odkaz na obchodní podmínky')).toHaveValue('https://shop.test/terms')
  await expectNoA11yViolations(container)
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce/checkout-form.test.ts src/features/commerce/pages/ShopSettingsPage.test.tsx`
Expected: FAIL (`./checkout-form` missing; the first settings test fails because the save sends the stored checkout fields too; the new tests find no checkout section).

- [ ] **Step 3: Implement the helpers and the field**

Create `features/commerce/checkout-form.ts`:

```ts
import type { BankAccount, ShopSettings } from './commerce-api'

export interface AccountForm {
  currency: string
  holder: string
  accountNumber: string
  iban: string
  bic: string
}

export interface CheckoutForm {
  accounts: AccountForm[]
  unpaidCancelDays: string
  downloadDays: string
  downloadLimit: string
  shopEmail: string
  termsUrl: string
}

export interface CheckoutBody {
  bankAccounts: BankAccount[]
  unpaidCancelDays: number
  downloadDays: number
  downloadLimit: number
  shopEmail: string | null
  termsUrl: string | null
}

export type CheckoutErrorKey = 'holder' | 'account' | 'iban' | 'bic' | 'unpaidCancelDays' | 'downloadDays' | 'downloadLimit' | 'email' | 'url'

// Same rules as the backend settings schema.
const IBAN = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/
const BIC = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function checkoutToForm(settings: ShopSettings): CheckoutForm {
  return {
    accounts: (settings.bankAccounts ?? []).map((a) => ({ currency: a.currency, holder: a.holder, accountNumber: a.accountNumber ?? '', iban: a.iban ?? '', bic: a.bic ?? '' })),
    unpaidCancelDays: String(settings.unpaidCancelDays ?? 14),
    downloadDays: String(settings.downloadDays ?? 30),
    downloadLimit: String(settings.downloadLimit ?? 5),
    shopEmail: settings.shopEmail ?? '',
    termsUrl: settings.termsUrl ?? '',
  }
}

function whole(text: string, min: number, max: number): number | null {
  const trimmed = text.trim()
  return /^\d+$/.test(trimmed) && Number(trimmed) >= min && Number(trimmed) <= max ? Number(trimmed) : null
}

function isHttpUrl(text: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

/** Errors are keyed by the input id they belong to. */
export function formToCheckout(form: CheckoutForm): { body?: CheckoutBody; errors: Record<string, CheckoutErrorKey> } {
  const errors: Record<string, CheckoutErrorKey> = {}
  const bankAccounts = form.accounts.map((a) => {
    const id = `account-${a.currency}`
    const holder = a.holder.trim()
    const accountNumber = a.accountNumber.trim()
    const iban = a.iban.replace(/\s/g, '').toUpperCase()
    const bic = a.bic.replace(/\s/g, '').toUpperCase()
    if (!holder || holder.length > 100) errors[`${id}-holder`] = 'holder'
    if ((!accountNumber && !iban) || accountNumber.length > 40) errors[`${id}-accountNumber`] = 'account'
    if (iban && !IBAN.test(iban)) errors[`${id}-iban`] = 'iban'
    if (bic && !BIC.test(bic)) errors[`${id}-bic`] = 'bic'
    return { currency: a.currency, holder, ...(accountNumber ? { accountNumber } : {}), ...(iban ? { iban } : {}), ...(bic ? { bic } : {}) }
  })
  const unpaidCancelDays = whole(form.unpaidCancelDays, 1, 90)
  const downloadDays = whole(form.downloadDays, 1, 365)
  const downloadLimit = whole(form.downloadLimit, 1, 100)
  if (unpaidCancelDays === null) errors['unpaid-days'] = 'unpaidCancelDays'
  if (downloadDays === null) errors['download-days'] = 'downloadDays'
  if (downloadLimit === null) errors['download-limit'] = 'downloadLimit'
  const shopEmail = form.shopEmail.trim()
  if (shopEmail && !EMAIL.test(shopEmail)) errors['shop-email'] = 'email'
  const termsUrl = form.termsUrl.trim()
  if (termsUrl && !isHttpUrl(termsUrl)) errors['terms-url'] = 'url'
  if (Object.keys(errors).length || unpaidCancelDays === null || downloadDays === null || downloadLimit === null) return { errors }
  return { errors, body: { bankAccounts, unpaidCancelDays, downloadDays, downloadLimit, shopEmail: shopEmail || null, termsUrl: termsUrl || null } }
}
```

Create `features/commerce/components/TextField.tsx`:

```tsx
import type { HTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  type?: string
  className?: string
}

/** Label, input, hint and error, wired together for screen readers. */
export function TextField({ id, label, value, onChange, hint, error, inputMode, type, className }: TextFieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Add the catalog keys**

In `i18n/locales/en/commerce.json`, add a top-level `checkout` object:

```json
  "checkout": {
    "title": "Checkout and payment",
    "hint": "Bank details for transfers, how long unpaid orders wait, download links and order notifications.",
    "bankAccounts": "Bank accounts",
    "noCurrencies": "Add a currency first.",
    "accountFor": "Account for {{code}}",
    "addAccount": "Add bank account for {{code}}",
    "removeAccount": "Remove account for {{code}}",
    "holder": "Account holder",
    "accountNumber": "Account number",
    "iban": "IBAN",
    "ibanHint": "With an IBAN, order emails include a payment QR code.",
    "bic": "BIC",
    "unpaidCancelDays": "Cancel unpaid transfers after (days)",
    "downloadDays": "Download links valid for (days)",
    "downloadLimit": "Downloads per link",
    "shopEmail": "Email for new orders",
    "shopEmailHint": "Leave empty to get no new-order emails.",
    "termsUrl": "Terms and conditions link",
    "termsUrlHint": "When set, customers must accept the terms at checkout.",
    "save": "Save checkout settings",
    "saved": "Checkout settings saved",
    "errors": {
      "holder": "Enter the account holder, up to 100 characters",
      "account": "Enter an account number (up to 40 characters) or an IBAN",
      "iban": "Enter an IBAN such as CZ65 0800 0000 1920 0014 5399",
      "bic": "Enter a BIC of 8 or 11 letters and digits",
      "unpaidCancelDays": "Enter whole days from 1 to 90",
      "downloadDays": "Enter whole days from 1 to 365",
      "downloadLimit": "Enter a whole number from 1 to 100",
      "email": "Enter an email address",
      "url": "Enter an http or https link"
    }
  }
```

In `i18n/locales/cs/commerce.json`:

```json
  "checkout": {
    "title": "Objednávky a platby",
    "hint": "Bankovní spojení pro převody, jak dlouho čekají nezaplacené objednávky, odkazy ke stažení a upozornění na objednávky.",
    "bankAccounts": "Bankovní účty",
    "noCurrencies": "Nejdřív přidejte měnu.",
    "accountFor": "Účet pro {{code}}",
    "addAccount": "Přidat bankovní účet pro {{code}}",
    "removeAccount": "Odebrat účet pro {{code}}",
    "holder": "Majitel účtu",
    "accountNumber": "Číslo účtu",
    "iban": "IBAN",
    "ibanHint": "S IBAN obsahují e-maily k objednávce QR kód pro platbu.",
    "bic": "BIC",
    "unpaidCancelDays": "Zrušit nezaplacené převody po (dnech)",
    "downloadDays": "Platnost odkazů ke stažení (dny)",
    "downloadLimit": "Počet stažení na odkaz",
    "shopEmail": "E-mail pro nové objednávky",
    "shopEmailHint": "Nechte prázdné, pokud e-maily o nových objednávkách nechcete.",
    "termsUrl": "Odkaz na obchodní podmínky",
    "termsUrlHint": "Když je vyplněný, zákazníci musí při objednávce podmínky přijmout.",
    "save": "Uložit nastavení objednávek",
    "saved": "Nastavení objednávek uloženo",
    "errors": {
      "holder": "Zadejte majitele účtu, nejvýše 100 znaků",
      "account": "Zadejte číslo účtu (nejvýše 40 znaků) nebo IBAN",
      "iban": "Zadejte IBAN, například CZ65 0800 0000 1920 0014 5399",
      "bic": "Zadejte BIC o 8 nebo 11 písmenech a číslicích",
      "unpaidCancelDays": "Zadejte celé dny od 1 do 90",
      "downloadDays": "Zadejte celé dny od 1 do 365",
      "downloadLimit": "Zadejte celé číslo od 1 do 100",
      "email": "Zadejte e-mailovou adresu",
      "url": "Zadejte odkaz začínající http nebo https"
    }
  }
```

- [ ] **Step 5: Implement the section and wire it into the page**

Create `features/commerce/components/CheckoutSettingsSection.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { apiErrorMessage } from '@/lib/api-error'
import type { ShopSettings } from '../commerce-api'
import { useCommerceWrites } from '../commerce-queries'
import { checkoutToForm, formToCheckout, type AccountForm, type CheckoutErrorKey, type CheckoutForm } from '../checkout-form'
import { TextField } from './TextField'

interface CheckoutSettingsSectionProps {
  settings: ShopSettings
  onDirty: (dirty: boolean) => void
}

export function CheckoutSettingsSection({ settings, onDirty }: CheckoutSettingsSectionProps) {
  const { t } = useTranslation('commerce')
  const writes = useCommerceWrites()
  const initial = useMemo(() => checkoutToForm(settings), [settings])
  // Not reset when settings change: a currency save must not wipe edits made here.
  const [form, setForm] = useState<CheckoutForm>(initial)
  const [errors, setErrors] = useState<Record<string, CheckoutErrorKey>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  useEffect(() => onDirty(dirty), [dirty, onDirty])

  const err = (id: string) => (errors[id] ? t(`checkout.errors.${errors[id]}`) : undefined)
  const setAccount = (currency: string, patch: Partial<AccountForm>) =>
    setForm({ ...form, accounts: form.accounts.map((a) => (a.currency === currency ? { ...a, ...patch } : a)) })

  const save = async () => {
    const result = formToCheckout(form)
    setErrors(result.errors)
    if (!result.body) return
    setSaving(true)
    setServerError(null)
    try {
      const saved = await writes.saveSettings({ currencies: settings.currencies, defaultCurrency: settings.defaultCurrency, vatRates: settings.vatRates, ...result.body })
      setForm(checkoutToForm(saved))
      toast.success(t('checkout.saved'))
    } catch (error) {
      setServerError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="checkout-title" className="mt-10 min-w-0 space-y-4">
      <h2 id="checkout-title" className="font-serif text-xl font-semibold">{t('checkout.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('checkout.hint')}</p>
      {serverError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      <h3 className="font-medium">{t('checkout.bankAccounts')}</h3>
      {settings.currencies.length === 0 && <p className="text-sm text-muted-foreground">{t('checkout.noCurrencies')}</p>}
      <div className="space-y-3">
        {settings.currencies.map((c) => {
          const account = form.accounts.find((a) => a.currency === c.code)
          if (!account) {
            return (
              <Button key={c.code} variant="outline" onClick={() => setForm({ ...form, accounts: [...form.accounts, { currency: c.code, holder: '', accountNumber: '', iban: '', bic: '' }] })}>
                {t('checkout.addAccount', { code: c.code })}
              </Button>
            )
          }
          const id = `account-${c.code}`
          return (
            <fieldset key={c.code} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <legend className="font-medium">{t('checkout.accountFor', { code: c.code })}</legend>
                <Button variant="ghost" size="icon" aria-label={t('checkout.removeAccount', { code: c.code })} onClick={() => setForm({ ...form, accounts: form.accounts.filter((a) => a.currency !== c.code) })}>
                  <Trash2 aria-hidden />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`${id}-holder`} label={t('checkout.holder')} value={account.holder} onChange={(holder) => setAccount(c.code, { holder })} error={err(`${id}-holder`)} />
                <TextField id={`${id}-accountNumber`} label={t('checkout.accountNumber')} value={account.accountNumber} onChange={(accountNumber) => setAccount(c.code, { accountNumber })} error={err(`${id}-accountNumber`)} />
                <TextField id={`${id}-iban`} label={t('checkout.iban')} hint={t('checkout.ibanHint')} value={account.iban} onChange={(iban) => setAccount(c.code, { iban })} error={err(`${id}-iban`)} />
                <TextField id={`${id}-bic`} label={t('checkout.bic')} value={account.bic} onChange={(bic) => setAccount(c.code, { bic })} error={err(`${id}-bic`)} />
              </div>
            </fieldset>
          )
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField id="unpaid-days" inputMode="numeric" label={t('checkout.unpaidCancelDays')} value={form.unpaidCancelDays} onChange={(unpaidCancelDays) => setForm({ ...form, unpaidCancelDays })} error={err('unpaid-days')} />
        <TextField id="download-days" inputMode="numeric" label={t('checkout.downloadDays')} value={form.downloadDays} onChange={(downloadDays) => setForm({ ...form, downloadDays })} error={err('download-days')} />
        <TextField id="download-limit" inputMode="numeric" label={t('checkout.downloadLimit')} value={form.downloadLimit} onChange={(downloadLimit) => setForm({ ...form, downloadLimit })} error={err('download-limit')} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField id="shop-email" type="email" label={t('checkout.shopEmail')} hint={t('checkout.shopEmailHint')} value={form.shopEmail} onChange={(shopEmail) => setForm({ ...form, shopEmail })} error={err('shop-email')} />
        <TextField id="terms-url" type="url" label={t('checkout.termsUrl')} hint={t('checkout.termsUrlHint')} value={form.termsUrl} onChange={(termsUrl) => setForm({ ...form, termsUrl })} error={err('terms-url')} />
      </div>
      <Button onClick={() => void save()} disabled={saving || !dirty}>{t('checkout.save')}</Button>
    </section>
  )
}
```

In `features/commerce/pages/ShopSettingsPage.tsx`:

1. Import `CheckoutSettingsSection` from `'../components/CheckoutSettingsSection'`.
2. After the existing `useState` hooks add `const [checkoutDirty, setCheckoutDirty] = useState(false)`.
3. Replace the `dirty` and `blocker` lines with:

```tsx
  // Only the currency and VAT part counts here; the checkout section tracks its own edits.
  const own = (s: ShopSettings) => JSON.stringify([s.currencies, s.defaultCurrency ?? null, s.vatRates])
  const dirty = !!draft && !!settings.data && own(draft) !== own(settings.data)
  const blocker = useUnsavedGuard(dirty || checkoutDirty)
```

4. In `save`, send only this part's fields (the server keeps the rest):

```tsx
      const saved = await writes.saveSettings({ currencies: draft.currencies, defaultCurrency: draft.defaultCurrency, vatRates: draft.vatRates })
```

5. After the closing `</div>` of the two-column grid and before `<UnsavedChangesDialog`, add:

```tsx
      {settings.data && <CheckoutSettingsSection settings={settings.data} onDirty={setCheckoutDirty} />}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce/checkout-form.test.ts src/features/commerce/pages/ShopSettingsPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(admin): checkout settings with bank accounts, days, limits, shop email and terms link"
```

---

### Task 3: Shipping page with zones and the methods list

**Files:**
- Create: `features/commerce/countries.ts`, `features/commerce/components/ZoneDialog.tsx`, `features/commerce/pages/ShippingPage.tsx`, `i18n/locales/{en,cs}/shipping.json`
- Modify: `i18n/resources.ts`, `i18n/locales/{en,cs}/shell.json`, `modules/registry.tsx`
- Test: `features/commerce/countries.test.ts`, `features/commerce/pages/ShippingPage.test.tsx`, `modules/registry.test.tsx`

**Interfaces:**
- Consumes: `useZones`, `useMethods`, `useShippingWrites` (Task 1); `useLanguages`; `TextField` (Task 2); `ConfirmDialog`.
- Produces: `countryName(code, language)`, `parseCountries(text): { codes, invalid }`; the `shipping` namespace (Task 4 adds `method` keys); module `shipping` at `/commerce/shipping`.

- [ ] **Step 1: Write the failing tests**

Create `features/commerce/countries.test.ts`:

```ts
import { countryName, parseCountries } from './countries'

it('reads codes separated by commas or spaces, uppercased and without repeats', () => {
  expect(parseCountries('cz, sk at;cz')).toEqual({ codes: ['CZ', 'SK', 'AT'], invalid: [] })
  expect(parseCountries('CZ, XYZ, 1')).toEqual({ codes: ['CZ'], invalid: ['XYZ', '1'] })
})

it('names countries in the admin language', () => {
  expect(countryName('CZ', 'en')).toBe('Czechia')
  expect(countryName('CZ', 'cs')).toBe('Česko')
})
```

Create `features/commerce/pages/ShippingPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ShippingPage } from './ShippingPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/shipping', element: <ShippingPage /> }]
const zones = [{ id: 'z1', name: 'Home', countries: ['CZ'], rest: false, order: 0 }]
const methods = [
  { id: 'm1', labels: { en: 'Courier', cs: 'Kurýr' }, active: true, paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'], codFees: { CZK: 3900 }, freeOver: {}, rates: [{ zoneId: 'z1', bands: [{ upToGrams: null, prices: { CZK: 12900 } }] }], order: 0 },
]
const languages = [
  { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 },
  { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
]

function serve(data: { zones?: unknown[]; methods?: unknown[] } = {}) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/shipping/zones') return { data: { success: true, data: data.zones ?? zones } }
    if (url === '/commerce/shipping/methods') return { data: { success: true, data: data.methods ?? methods } }
    if (url === '/languages') return { data: { success: true, data: languages } }
    throw new Error(`unexpected GET ${url}`)
  })
}

beforeEach(() => {
  serve()
  vi.mocked(apiClient.post).mockImplementation(async (_url: string, body: unknown) => ({ data: { success: true, data: { id: 'z2', order: 1, ...(body as object) } } }))
})

it('lists zones with country names and methods with zones and payment', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/shipping' })
  const zoneList = await screen.findByRole('list', { name: 'Zones' })
  expect(within(zoneList).getByText('Home')).toBeInTheDocument()
  expect(within(zoneList).getByText('Czechia')).toBeInTheDocument()
  const methodList = screen.getByRole('list', { name: 'Shipping methods' })
  expect(within(methodList).getByRole('link', { name: 'Courier' })).toHaveAttribute('href', '/commerce/shipping/methods/m1')
  expect(within(methodList).getByText('Home · Bank transfer, Cash on delivery')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New method' })).toHaveAttribute('href', '/commerce/shipping/methods/new')
  await expectNoA11yViolations(container)
})

it('adds a zone from typed codes and refuses bad codes', async () => {
  renderRoutes(routes, { route: '/commerce/shipping' })
  await userEvent.click(await screen.findByRole('button', { name: 'Add zone' }))
  const dialog = await screen.findByRole('dialog', { name: 'New zone' })
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Neighbours')
  await userEvent.type(within(dialog).getByLabelText('Countries'), 'sk, at, xyz')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save zone' }))
  expect(within(dialog).getByText('Use two-letter codes such as CZ: XYZ')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  const countries = within(dialog).getByLabelText('Countries')
  await userEvent.clear(countries)
  await userEvent.type(countries, 'sk, at')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Save zone' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/shipping/zones', { name: 'Neighbours', countries: ['SK', 'AT'], rest: false }))
  expect(await screen.findByText('Zone saved')).toBeInTheDocument()
})

it('keeps a zone that a method uses and shows the reason', async () => {
  vi.mocked(apiClient.delete).mockRejectedValue(
    Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'A shipping method uses this zone' } } }),
  )
  renderRoutes(routes, { route: '/commerce/shipping' })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete Home' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Delete zone Home?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
  expect(await screen.findByText('A shipping method uses this zone')).toBeInTheDocument()
  expect(within(screen.getByRole('list', { name: 'Zones' })).getByText('Home')).toBeInTheDocument()
})

it('asks for a zone before the first method', async () => {
  serve({ zones: [], methods: [] })
  renderRoutes(routes, { route: '/commerce/shipping' })
  expect(await screen.findByText('Add a zone first.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'New method' })).toBeDisabled()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/shipping' })
  expect(await screen.findByRole('heading', { name: 'Doprava' })).toBeInTheDocument()
  expect(await screen.findByText('Česko')).toBeInTheDocument()
  expect(screen.getByText('Home · Bankovní převod, Dobírka')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
```

In `modules/registry.test.tsx`, change the commerce line to:

```ts
    expect(commerce.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Products', 'Shipping', 'Shop settings'])
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce/countries.test.ts src/features/commerce/pages/ShippingPage.test.tsx src/modules/registry.test.tsx`
Expected: FAIL (modules missing; registry has no Shipping).

- [ ] **Step 3: Add the catalogs and register the namespace**

Create `i18n/locales/en/shipping.json`:

```json
{
  "page": {
    "title": "Shipping",
    "description": "Where you ship, how and for how much.",
    "loadError": "Could not load shipping."
  },
  "zones": {
    "title": "Zones",
    "hint": "A country belongs to one zone. The zone for everywhere else covers all other countries.",
    "add": "Add zone",
    "edit": "Edit {{name}}",
    "remove": "Delete {{name}}",
    "rest": "Everywhere else",
    "empty": "No zones yet. Add the countries you ship to.",
    "removeTitle": "Delete zone {{name}}?",
    "removeText": "The zone is deleted. A zone that a shipping method uses cannot be deleted.",
    "removed": "Zone deleted",
    "saved": "Zone saved"
  },
  "zoneDialog": {
    "titleNew": "New zone",
    "titleEdit": "Edit zone",
    "name": "Name",
    "countries": "Countries",
    "countriesHint": "Two-letter codes separated by commas, for example CZ, SK",
    "rest": "Everywhere else",
    "restHint": "Covers every country that is not in another zone",
    "save": "Save zone",
    "nameRequired": "Enter a name of up to 50 characters",
    "countriesInvalid": "Use two-letter codes such as CZ: {{codes}}",
    "countriesRequired": "Add at least one country or choose everywhere else"
  },
  "methods": {
    "title": "Methods",
    "add": "New method",
    "empty": "No shipping methods yet.",
    "needsZone": "Add a zone first.",
    "tableLabel": "Shipping methods",
    "summary": "{{zones}} · {{payment}}",
    "active": "Active",
    "inactive": "Inactive",
    "untitled": "Untitled method"
  },
  "payment": {
    "BANK_TRANSFER": "Bank transfer",
    "CASH_ON_DELIVERY": "Cash on delivery"
  }
}
```

Create `i18n/locales/cs/shipping.json`:

```json
{
  "page": {
    "title": "Doprava",
    "description": "Kam, jak a za kolik posíláte.",
    "loadError": "Dopravu se nepodařilo načíst."
  },
  "zones": {
    "title": "Zóny",
    "hint": "Země patří do jedné zóny. Zóna pro zbytek světa pokrývá všechny ostatní země.",
    "add": "Přidat zónu",
    "edit": "Upravit {{name}}",
    "remove": "Smazat {{name}}",
    "rest": "Zbytek světa",
    "empty": "Zatím žádné zóny. Přidejte země, kam posíláte.",
    "removeTitle": "Smazat zónu {{name}}?",
    "removeText": "Zóna se smaže. Zónu, kterou používá způsob dopravy, smazat nelze.",
    "removed": "Zóna smazána",
    "saved": "Zóna uložena"
  },
  "zoneDialog": {
    "titleNew": "Nová zóna",
    "titleEdit": "Upravit zónu",
    "name": "Název",
    "countries": "Země",
    "countriesHint": "Dvoupísmenné kódy oddělené čárkou, například CZ, SK",
    "rest": "Zbytek světa",
    "restHint": "Pokrývá všechny země, které nejsou v jiné zóně",
    "save": "Uložit zónu",
    "nameRequired": "Zadejte název o délce nejvýše 50 znaků",
    "countriesInvalid": "Použijte dvoupísmenné kódy jako CZ: {{codes}}",
    "countriesRequired": "Přidejte alespoň jednu zemi nebo zvolte zbytek světa"
  },
  "methods": {
    "title": "Způsoby dopravy",
    "add": "Nový způsob",
    "empty": "Zatím žádné způsoby dopravy.",
    "needsZone": "Nejdřív přidejte zónu.",
    "tableLabel": "Způsoby dopravy",
    "summary": "{{zones}} · {{payment}}",
    "active": "Aktivní",
    "inactive": "Neaktivní",
    "untitled": "Způsob bez názvu"
  },
  "payment": {
    "BANK_TRANSFER": "Bankovní převod",
    "CASH_ON_DELIVERY": "Dobírka"
  }
}
```

In `i18n/resources.ts`, import `enShipping`/`csShipping` from `./locales/{en,cs}/shipping.json`, add `'shipping'` to the end of `NAMESPACES`, and `shipping: enShipping` / `shipping: csShipping` to `resources.en` / `resources.cs`.

In `i18n/locales/en/shell.json` `nav`, add `"shipping": "Shipping"`; in `cs`, `"shipping": "Doprava"`.

- [ ] **Step 4: Implement the helpers, dialog, page and route**

Create `features/commerce/countries.ts`:

```ts
/** Country name in the admin language, or the code when the browser has no name for it. */
export function countryName(code: string, language: string): string {
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

/** Codes typed as "cz, sk at": uppercased, without repeats; anything that is not two letters is invalid. */
export function parseCountries(text: string): { codes: string[]; invalid: string[] } {
  const parts = text.split(/[\s,;]+/).map((p) => p.trim().toUpperCase()).filter(Boolean)
  const valid = (p: string) => /^[A-Z]{2}$/.test(p)
  return { codes: [...new Set(parts.filter(valid))], invalid: parts.filter((p) => !valid(p)) }
}
```

Create `features/commerce/components/ZoneDialog.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/lib/api-error'
import type { ShippingZone } from '../shipping-api'
import { useShippingWrites } from '../shipping-queries'
import { parseCountries } from '../countries'
import { TextField } from './TextField'

interface ZoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  zone?: ShippingZone
}

export function ZoneDialog({ open, onOpenChange, zone }: ZoneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so the form starts fresh on every open. */}
      <DialogContent>
        <ZoneForm zone={zone} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ZoneForm({ zone, onDone }: { zone?: ShippingZone; onDone: () => void }) {
  const { t } = useTranslation('shipping')
  const writes = useShippingWrites()
  const [name, setName] = useState(zone?.name ?? '')
  const [countries, setCountries] = useState(zone?.countries.join(', ') ?? '')
  const [rest, setRest] = useState(zone?.rest ?? false)
  const [errors, setErrors] = useState<{ name?: string; countries?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const next: { name?: string; countries?: string } = {}
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 50) next.name = t('zoneDialog.nameRequired')
    const parsed = parseCountries(countries)
    if (!rest && parsed.invalid.length) next.countries = t('zoneDialog.countriesInvalid', { codes: parsed.invalid.join(', ') })
    else if (!rest && parsed.codes.length === 0) next.countries = t('zoneDialog.countriesRequired')
    setErrors(next)
    if (next.name || next.countries) return
    setSaving(true)
    setServerError(null)
    try {
      await writes.saveZone(zone?.id, { name: trimmed, countries: rest ? [] : parsed.codes, rest })
      toast.success(t('zones.saved'))
      onDone()
    } catch (error) {
      setServerError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{zone ? t('zoneDialog.titleEdit') : t('zoneDialog.titleNew')}</DialogTitle>
        <DialogDescription>{t('zones.hint')}</DialogDescription>
      </DialogHeader>
      {serverError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      <TextField id="zone-name" label={t('zoneDialog.name')} value={name} onChange={setName} error={errors.name} />
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Switch id="zone-rest" checked={rest} onCheckedChange={setRest} aria-describedby="zone-rest-hint" />
          <Label htmlFor="zone-rest">{t('zoneDialog.rest')}</Label>
        </div>
        <p id="zone-rest-hint" className="text-xs text-muted-foreground">{t('zoneDialog.restHint')}</p>
      </div>
      {!rest && (
        <TextField id="zone-countries" label={t('zoneDialog.countries')} hint={t('zoneDialog.countriesHint')} value={countries} onChange={setCountries} error={errors.countries} />
      )}
      <DialogFooter>
        <Button type="submit" disabled={saving}>{t('zoneDialog.save')}</Button>
      </DialogFooter>
    </form>
  )
}
```

Create `features/commerce/pages/ShippingPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-error'
import { useLanguages } from '@/features/languages/languages-queries'
import type { ShippingMethod, ShippingZone } from '../shipping-api'
import { useMethods, useShippingWrites, useZones } from '../shipping-queries'
import { countryName } from '../countries'
import { ZoneDialog } from '../components/ZoneDialog'

export function ShippingPage() {
  const { t, i18n } = useTranslation('shipping')
  const zones = useZones()
  const methods = useMethods()
  const languages = useLanguages()
  const writes = useShippingWrites()
  const [editing, setEditing] = useState<ShippingZone | 'new' | null>(null)
  const [removing, setRemoving] = useState<ShippingZone | null>(null)

  if (zones.isError || methods.isError)
    return <ErrorState message={t('page.loadError')} onRetry={() => { void zones.refetch(); void methods.refetch() }} />
  if (zones.isPending || methods.isPending) return <Skeleton className="h-40 w-full" />

  const defaultLanguage = languages.data?.find((l) => l.isDefault)?.code ?? 'en'
  const methodName = (m: ShippingMethod) => m.labels[defaultLanguage] || Object.values(m.labels)[0] || t('methods.untitled')
  const zoneNames = (m: ShippingMethod) => m.rates.map((r) => zones.data.find((z) => z.id === r.zoneId)?.name).filter(Boolean).join(', ')
  const paymentNames = (m: ShippingMethod) => m.paymentMethods.map((p) => t(`payment.${p}`)).join(', ')

  const remove = async () => {
    const zone = removing
    setRemoving(null)
    if (!zone) return
    try {
      await writes.removeZone(zone.id)
      toast.success(t('zones.removed'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader title={t('page.title')} description={t('page.description')} />
      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="zones-title" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="zones-title" className="font-serif text-xl font-semibold">{t('zones.title')}</h2>
            <Button variant="outline" onClick={() => setEditing('new')}>{t('zones.add')}</Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('zones.hint')}</p>
          {zones.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('zones.empty')}</p>
          ) : (
            <ul aria-label={t('zones.title')} className="flex flex-col divide-y rounded-xl border bg-card">
              {zones.data.map((z) => (
                <li key={z.id} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{z.name}</p>
                    <p className="text-sm text-muted-foreground">{z.rest ? t('zones.rest') : z.countries.map((c) => countryName(c, i18n.language)).join(', ')}</p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={t('zones.edit', { name: z.name })} onClick={() => setEditing(z)}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t('zones.remove', { name: z.name })} onClick={() => setRemoving(z)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="methods-title" className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="methods-title" className="font-serif text-xl font-semibold">{t('methods.title')}</h2>
            {zones.data.length > 0 ? (
              <Button asChild>
                <Link to="/commerce/shipping/methods/new">{t('methods.add')}</Link>
              </Button>
            ) : (
              <Button disabled>{t('methods.add')}</Button>
            )}
          </div>
          {zones.data.length === 0 && <p className="text-sm text-muted-foreground">{t('methods.needsZone')}</p>}
          {methods.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('methods.empty')}</p>
          ) : (
            <ul aria-label={t('methods.tableLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
              {methods.data.map((m) => (
                <li key={m.id} className="flex items-start gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/commerce/shipping/methods/${m.id}`} className="font-medium hover:underline">{methodName(m)}</Link>
                    <p className="text-sm text-muted-foreground">{t('methods.summary', { zones: zoneNames(m), payment: paymentNames(m) })}</p>
                  </div>
                  <Badge variant={m.active ? 'default' : 'outline'}>{m.active ? t('methods.active') : t('methods.inactive')}</Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <ZoneDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} zone={editing && editing !== 'new' ? editing : undefined} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t('zones.removeTitle', { name: removing?.name ?? '' })}
        description={t('zones.removeText')}
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        onConfirm={() => void remove()}
      />
    </>
  )
}
```

In `modules/registry.tsx`, import `Truck` from `lucide-react` and `ShippingPage` from `@/features/commerce/pages/ShippingPage`, and add after the `products` module:

```tsx
  {
    id: 'shipping',
    labelKey: 'nav.shipping',
    icon: Truck,
    group: 'commerce',
    path: '/commerce/shipping',
    routes: [{ path: 'commerce/shipping', element: <ShippingPage /> }],
  },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce src/modules src/i18n`
Expected: PASS (the catalog test checks the new namespace in both languages).

- [ ] **Step 6: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(admin): shipping page with zones and methods list"
```

---

### Task 4: Shipping method editor

**Files:**
- Create: `features/commerce/shipping-form.ts`, `features/commerce/components/MethodEditor.tsx`, `features/commerce/pages/ShippingMethodPage.tsx`
- Modify: `i18n/locales/{en,cs}/shipping.json`, `modules/registry.tsx`
- Test: `features/commerce/shipping-form.test.ts`, `features/commerce/pages/ShippingMethodPage.test.tsx`

**Interfaces:**
- Consumes: `ShippingMethod`, `ShippingZone`, `MethodInput` (Task 1); `PAYMENT_METHODS`, `PaymentMethod`; `useZones`, `useMethods`, `useShippingWrites().saveMethod / removeMethod`; `useShopSettings`; `useLanguages`; `toMinor`, `fromMinor`; `TextField` (Task 2); `useUnsavedGuard`, `UnsavedChangesDialog`, `ConfirmDialog`.
- Produces: `methodToForm(method | undefined, currencies, language): MethodForm`, `formToMethod(form, currencies, language, defaultLanguage)`, `emptyBand(currencies)`, `MethodForm`, `MethodErrorKey`; route `/commerce/shipping/methods/:id` (`new` creates).

- [ ] **Step 1: Write the failing tests**

Create `features/commerce/shipping-form.test.ts`:

```ts
import { formToMethod, methodToForm } from './shipping-form'

const czk = [{ code: 'CZK', decimals: 2 }]
const method = {
  id: 'm1',
  labels: { en: 'Courier' },
  active: true,
  paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'] as ('BANK_TRANSFER' | 'CASH_ON_DELIVERY')[],
  codFees: { CZK: 3900 },
  freeOver: { CZK: 200000 },
  rates: [{ zoneId: 'z1', bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19900 } }] }],
  order: 0,
}

it('round-trips a method through the form in Czech number format', () => {
  const form = methodToForm(method, czk, 'cs')
  expect(form.rates[0].bands[0]).toEqual({ upTo: '2000', prices: { CZK: '129,00' } })
  expect(form.rates[0].bands[1].upTo).toBe('')
  const { id, order, ...body } = method
  void id
  void order
  expect(formToMethod(form, czk, 'cs', 'en')).toEqual({ errors: {}, body })
})

it('reads "129,5" in Czech as 12950 and names a bad amount', () => {
  const form = methodToForm(method, czk, 'cs')
  form.rates[0].bands[0].prices.CZK = '129,5'
  expect(formToMethod(form, czk, 'cs', 'en').body?.rates[0].bands[0].prices).toEqual({ CZK: 12950 })
  form.codFees.CZK = 'abc'
  expect(formToMethod(form, czk, 'cs', 'en')).toEqual({ errors: { 'cod:CZK': 'money' } })
})

it('allows an open limit only on the last band and needs rising limits', () => {
  const form = methodToForm(method, czk, 'en')
  form.rates[0].bands = [
    { upTo: '', prices: { CZK: '100' } },
    { upTo: '2000', prices: { CZK: '120' } },
    { upTo: '1000', prices: { CZK: '150' } },
  ]
  expect(formToMethod(form, czk, 'en', 'en').errors).toEqual({ 'rate:0:band:0:upTo': 'upTo', 'rate:0:band:2:upTo': 'upToOrder' })
})

it('needs a default-language name, a payment method, a rate and a price per band', () => {
  const empty = methodToForm(undefined, czk, 'en')
  empty.paymentMethods = []
  expect(formToMethod(empty, czk, 'en', 'en').errors).toEqual({ 'label:en': 'labelRequired', payment: 'paymentRequired', rates: 'ratesRequired' })
  const noPrice = methodToForm(method, czk, 'en')
  noPrice.rates[0].bands[1].prices.CZK = ''
  expect(formToMethod(noPrice, czk, 'en', 'en').errors).toEqual({ 'rate:0:band:1:price': 'bandPrice' })
})

it('drops cash on delivery fees when cash on delivery is not offered', () => {
  const form = methodToForm(method, czk, 'en')
  form.paymentMethods = ['BANK_TRANSFER']
  expect(formToMethod(form, czk, 'en', 'en').body?.codFees).toEqual({})
})
```

Create `features/commerce/pages/ShippingMethodPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ShippingMethodPage } from './ShippingMethodPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [
  { path: '/commerce/shipping', element: <p>Shipping list</p> },
  { path: '/commerce/shipping/methods/:id', element: <ShippingMethodPage /> },
]
const zones = [{ id: 'z1', name: 'Home', countries: ['CZ'], rest: false, order: 0 }]
const settings = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] }
const languages = [
  { id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 },
  { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
]
let methods: Record<string, unknown>[] = []

beforeEach(() => {
  methods = [
    { id: 'm1', labels: { en: 'Courier' }, active: true, paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'], codFees: { CZK: 3900 }, freeOver: {}, rates: [{ zoneId: 'z1', bands: [{ upToGrams: null, prices: { CZK: 12900 } }] }], order: 0 },
  ]
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/shipping/zones') return { data: { success: true, data: zones } }
    if (url === '/commerce/shipping/methods') return { data: { success: true, data: methods } }
    if (url === '/commerce/settings') return { data: { success: true, data: settings } }
    if (url === '/languages') return { data: { success: true, data: languages } }
    throw new Error(`unexpected GET ${url}`)
  })
  vi.mocked(apiClient.post).mockImplementation(async (_url: string, body: unknown) => {
    const created = { id: 'm2', order: 1, ...(body as object) }
    methods = [...methods, created]
    return { data: { success: true, data: created } }
  })
  vi.mocked(apiClient.put).mockImplementation(async (url: string, body: unknown) => ({ data: { success: true, data: { id: url.split('/').pop(), order: 0, ...(body as object) } } }))
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } })
})

it('creates a method with a cash on delivery fee and an open last band', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/shipping/methods/new' })
  await userEvent.type(await screen.findByLabelText('Name (English)'), 'Parcel')
  await userEvent.click(screen.getByRole('checkbox', { name: 'Cash on delivery' }))
  await userEvent.type(screen.getByLabelText('Cash on delivery fee in CZK'), '39')
  await userEvent.click(screen.getByRole('button', { name: 'Add rates for Home' }))
  await userEvent.type(screen.getByLabelText('Weight limit in grams, band 1'), '2000')
  await userEvent.type(screen.getByLabelText('Price in CZK, band 1'), '129')
  await userEvent.click(screen.getByRole('button', { name: 'Add band' }))
  await userEvent.type(screen.getByLabelText('Price in CZK, band 2'), '199.50')
  await userEvent.click(screen.getByRole('button', { name: 'Save method' }))
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith('/commerce/shipping/methods', {
      labels: { en: 'Parcel' },
      active: true,
      paymentMethods: ['BANK_TRANSFER', 'CASH_ON_DELIVERY'],
      codFees: { CZK: 3900 },
      freeOver: {},
      rates: [{ zoneId: 'z1', bands: [{ upToGrams: 2000, prices: { CZK: 12900 } }, { upToGrams: null, prices: { CZK: 19950 } }] }],
    }),
  )
  expect(await screen.findByRole('heading', { name: 'Parcel' })).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('refuses a bad amount in Czech and saves "129,5" as 12950', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/commerce/shipping/methods/m1' })
  const price = await screen.findByLabelText('Cena v CZK, pásmo 1')
  expect(price).toHaveValue('129,00')
  await userEvent.clear(price)
  await userEvent.type(price, '129,5')
  const fee = screen.getByLabelText('Poplatek za dobírku v CZK')
  await userEvent.clear(fee)
  await userEvent.type(fee, 'abc')
  await userEvent.click(screen.getByRole('button', { name: 'Uložit způsob' }))
  expect(screen.getByText('Zadejte částku, například 129,00')).toBeInTheDocument()
  expect(apiClient.put).not.toHaveBeenCalled()
  await userEvent.clear(fee)
  await userEvent.type(fee, '39')
  await userEvent.click(screen.getByRole('button', { name: 'Uložit způsob' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalled())
  const body = vi.mocked(apiClient.put).mock.calls[0][1] as { rates: { bands: { prices: Record<string, number> }[] }[]; codFees: Record<string, number> }
  expect(body.rates[0].bands[0].prices).toEqual({ CZK: 12950 })
  expect(body.codFees).toEqual({ CZK: 3900 })
})

it('turns a method off and deletes it', async () => {
  renderRoutes(routes, { route: '/commerce/shipping/methods/m1' })
  await userEvent.click(await screen.findByRole('switch', { name: 'Active' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save method' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/commerce/shipping/methods/m1', expect.objectContaining({ active: false })))
  await userEvent.click(screen.getByRole('button', { name: 'Delete method' }))
  const confirm = await screen.findByRole('alertdialog', { name: 'Delete Courier?' })
  await userEvent.click(within(confirm).getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(apiClient.delete).toHaveBeenCalledWith('/commerce/shipping/methods/m1'))
  expect(await screen.findByText('Shipping list')).toBeInTheDocument()
})

it('says when the method no longer exists', async () => {
  renderRoutes(routes, { route: '/commerce/shipping/methods/gone' })
  expect(await screen.findByText('This shipping method no longer exists.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce/shipping-form.test.ts src/features/commerce/pages/ShippingMethodPage.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the form helpers**

Create `features/commerce/shipping-form.ts`:

```ts
import type { ShopCurrency } from './commerce-api'
import type { PaymentMethod } from './orders-api'
import type { MethodInput, ShippingMethod } from './shipping-api'
import { fromMinor, toMinor } from './money'

export interface BandForm {
  upTo: string
  prices: Record<string, string>
}

export interface RateForm {
  zoneId: string
  bands: BandForm[]
}

export interface MethodForm {
  labels: Record<string, string>
  active: boolean
  paymentMethods: PaymentMethod[]
  codFees: Record<string, string>
  freeOver: Record<string, string>
  rates: RateForm[]
}

export type MethodErrorKey = 'labelRequired' | 'paymentRequired' | 'ratesRequired' | 'money' | 'upTo' | 'upToOrder' | 'bandPrice'

function moneyText(map: Record<string, number>, currencies: ShopCurrency[], language: string): Record<string, string> {
  return Object.fromEntries(currencies.map((c) => [c.code, typeof map[c.code] === 'number' ? fromMinor(map[c.code], c.decimals, language) : '']))
}

export function emptyBand(currencies: ShopCurrency[]): BandForm {
  return { upTo: '', prices: Object.fromEntries(currencies.map((c) => [c.code, ''])) }
}

export function methodToForm(method: ShippingMethod | undefined, currencies: ShopCurrency[], language: string): MethodForm {
  if (!method) {
    return { labels: {}, active: true, paymentMethods: ['BANK_TRANSFER'], codFees: moneyText({}, currencies, language), freeOver: moneyText({}, currencies, language), rates: [] }
  }
  return {
    labels: { ...method.labels },
    active: method.active,
    paymentMethods: [...method.paymentMethods],
    codFees: moneyText(method.codFees, currencies, language),
    freeOver: moneyText(method.freeOver, currencies, language),
    rates: method.rates.map((r) => ({
      zoneId: r.zoneId,
      bands: r.bands.map((b) => ({ upTo: b.upToGrams === null ? '' : String(b.upToGrams), prices: moneyText(b.prices, currencies, language) })),
    })),
  }
}

/** Form to API body. Errors are keyed by field ("cod:CZK", "rate:0:band:1:upTo") and name the message to show. */
export function formToMethod(
  form: MethodForm,
  currencies: ShopCurrency[],
  language: string,
  defaultLanguage: string,
): { body?: MethodInput; errors: Record<string, MethodErrorKey> } {
  const errors: Record<string, MethodErrorKey> = {}
  const labels = Object.fromEntries(Object.entries(form.labels).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v))
  if (!labels[defaultLanguage] || labels[defaultLanguage].length > 100) errors[`label:${defaultLanguage}`] = 'labelRequired'
  if (form.paymentMethods.length === 0) errors.payment = 'paymentRequired'

  const money = (map: Record<string, string>, prefix: string) => {
    const out: Record<string, number> = {}
    for (const c of currencies) {
      const text = map[c.code]?.trim() ?? ''
      if (!text) continue
      const minor = toMinor(text, c.decimals, language)
      if (minor === null) errors[`${prefix}:${c.code}`] = 'money'
      else out[c.code] = minor
    }
    return out
  }
  const codFees = form.paymentMethods.includes('CASH_ON_DELIVERY') ? money(form.codFees, 'cod') : {}
  const freeOver = money(form.freeOver, 'free')

  if (form.rates.length === 0) errors.rates = 'ratesRequired'
  const rates = form.rates.map((rate, i) => {
    let previous = 0
    return {
      zoneId: rate.zoneId,
      bands: rate.bands.map((band, j) => {
        const id = `rate:${i}:band:${j}`
        const last = j === rate.bands.length - 1
        const text = band.upTo.trim()
        let upToGrams: number | null = null
        if (text || !last) {
          const grams = Number(text)
          if (!/^\d+$/.test(text) || grams < 1 || grams > 1_000_000) errors[`${id}:upTo`] = 'upTo'
          else if (grams <= previous) errors[`${id}:upTo`] = 'upToOrder'
          else {
            upToGrams = grams
            previous = grams
          }
        }
        const prices = money(band.prices, `${id}:price`)
        const badPrice = currencies.some((c) => errors[`${id}:price:${c.code}`])
        if (Object.keys(prices).length === 0 && !badPrice) errors[`${id}:price`] = 'bandPrice'
        return { upToGrams, prices }
      }),
    }
  })

  if (Object.keys(errors).length) return { errors }
  return { errors, body: { labels, active: form.active, paymentMethods: form.paymentMethods, codFees, freeOver, rates } }
}
```

- [ ] **Step 4: Add the `method` catalog keys**

Add a top-level `method` object to `i18n/locales/en/shipping.json`:

```json
  "method": {
    "newTitle": "New shipping method",
    "notFound": "This shipping method no longer exists.",
    "back": "Shipping",
    "general": "General",
    "label": "Name ({{language}})",
    "active": "Active",
    "activeHint": "Inactive methods are not offered at checkout",
    "payment": "Payment",
    "paymentHint": "Cash on delivery is never offered for carts with digital items.",
    "codFeeLabel": "Cash on delivery fee in {{code}}",
    "freeOver": "Free shipping",
    "freeOverHint": "Shipping is free when the items total reaches this amount. Leave empty for no free shipping.",
    "freeOverLabel": "Free from, {{code}}",
    "rates": "Rates",
    "ratesHint": "Prices by parcel weight for each zone. Leave the last limit empty for no upper limit.",
    "upToLabel": "Weight limit in grams, band {{n}}",
    "priceLabel": "Price in {{code}}, band {{n}}",
    "noLimitHint": "Empty means no upper limit",
    "addBand": "Add band",
    "removeBand": "Remove band {{n}}",
    "removeZone": "Remove {{name}}",
    "addZoneRates": "Add rates for {{name}}",
    "unknownZone": "Deleted zone",
    "save": "Save method",
    "saved": "Shipping method saved",
    "delete": "Delete method",
    "deleteTitle": "Delete {{name}}?",
    "deleteText": "Checkout stops offering it. Orders already placed keep their shipping.",
    "deleted": "Shipping method deleted",
    "fixErrors": "Fix the marked fields",
    "errors": {
      "labelRequired": "Enter a name of up to 100 characters",
      "paymentRequired": "Choose at least one payment method",
      "ratesRequired": "Add rates for at least one zone",
      "money": "Enter an amount such as {{example}}",
      "upTo": "Enter whole grams from 1 to 1000000; only the last band can be empty",
      "upToOrder": "Each limit must be higher than the one before",
      "bandPrice": "Enter a price in at least one currency"
    }
  }
```

And to `i18n/locales/cs/shipping.json`:

```json
  "method": {
    "newTitle": "Nový způsob dopravy",
    "notFound": "Tento způsob dopravy už neexistuje.",
    "back": "Doprava",
    "general": "Obecné",
    "label": "Název ({{language}})",
    "active": "Aktivní",
    "activeHint": "Neaktivní způsoby se při objednávce nenabízejí",
    "payment": "Platba",
    "paymentHint": "Dobírka se nikdy nenabízí pro košíky s digitálními položkami.",
    "codFeeLabel": "Poplatek za dobírku v {{code}}",
    "freeOver": "Doprava zdarma",
    "freeOverHint": "Doprava je zdarma, když zboží dosáhne této částky. Nechte prázdné, pokud dopravu zdarma nenabízíte.",
    "freeOverLabel": "Zdarma od, {{code}}",
    "rates": "Ceny",
    "ratesHint": "Ceny podle hmotnosti zásilky pro každou zónu. Poslední limit nechte prázdný, pokud nemá horní hranici.",
    "upToLabel": "Limit hmotnosti v gramech, pásmo {{n}}",
    "priceLabel": "Cena v {{code}}, pásmo {{n}}",
    "noLimitHint": "Prázdné znamená bez horní hranice",
    "addBand": "Přidat pásmo",
    "removeBand": "Odebrat pásmo {{n}}",
    "removeZone": "Odebrat {{name}}",
    "addZoneRates": "Přidat ceny pro {{name}}",
    "unknownZone": "Smazaná zóna",
    "save": "Uložit způsob",
    "saved": "Způsob dopravy uložen",
    "delete": "Smazat způsob",
    "deleteTitle": "Smazat {{name}}?",
    "deleteText": "Při objednávce se přestane nabízet. Už vytvořené objednávky si dopravu ponechají.",
    "deleted": "Způsob dopravy smazán",
    "fixErrors": "Opravte označená pole",
    "errors": {
      "labelRequired": "Zadejte název o délce nejvýše 100 znaků",
      "paymentRequired": "Vyberte alespoň jeden způsob platby",
      "ratesRequired": "Přidejte ceny alespoň pro jednu zónu",
      "money": "Zadejte částku, například {{example}}",
      "upTo": "Zadejte celé gramy od 1 do 1000000; prázdné může být jen poslední pásmo",
      "upToOrder": "Každý limit musí být vyšší než předchozí",
      "bandPrice": "Zadejte cenu alespoň v jedné měně"
    }
  }
```

- [ ] **Step 5: Implement the editor, page and route**

Create `features/commerce/components/MethodEditor.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import type { Language } from '@/features/languages/languages-api'
import type { ShopCurrency } from '../commerce-api'
import { PAYMENT_METHODS, type PaymentMethod } from '../orders-api'
import type { ShippingMethod, ShippingZone } from '../shipping-api'
import { useShippingWrites } from '../shipping-queries'
import { emptyBand, formToMethod, methodToForm, type BandForm, type MethodErrorKey, type MethodForm } from '../shipping-form'
import { fromMinor } from '../money'
import { TextField } from './TextField'

interface MethodEditorProps {
  method?: ShippingMethod
  zones: ShippingZone[]
  currencies: ShopCurrency[]
  languages: Language[]
}

export function MethodEditor({ method, zones, currencies, languages }: MethodEditorProps) {
  const { t, i18n } = useTranslation('shipping')
  const language = i18n.language
  const navigate = useNavigate()
  const writes = useShippingWrites()
  const defaultLanguage = languages.find((l) => l.isDefault)?.code ?? languages[0]?.code ?? 'en'
  const initial = useMemo(() => methodToForm(method, currencies, language), [method, currencies, language])
  const [form, setForm] = useState<MethodForm>(initial)
  const [errors, setErrors] = useState<Record<string, MethodErrorKey>>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const blocker = useUnsavedGuard(dirty)

  const name = method ? method.labels[defaultLanguage] || t('methods.untitled') : t('method.newTitle')
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? t('method.unknownZone')
  const unusedZones = zones.filter((z) => !form.rates.some((r) => r.zoneId === z.id))
  const err = (id: string) => {
    const key = errors[id]
    if (!key) return undefined
    return key === 'money' ? t('method.errors.money', { example: fromMinor(12900, 2, language) }) : t(`method.errors.${key}`)
  }

  const update = (patch: Partial<MethodForm>) => setForm({ ...form, ...patch })
  const togglePayment = (pm: PaymentMethod) =>
    update({ paymentMethods: PAYMENT_METHODS.filter((p) => (p === pm ? !form.paymentMethods.includes(p) : form.paymentMethods.includes(p))) })
  const setBand = (i: number, j: number, patch: Partial<BandForm>) =>
    update({ rates: form.rates.map((r, ri) => (ri !== i ? r : { ...r, bands: r.bands.map((b, bj) => (bj === j ? { ...b, ...patch } : b)) })) })
  const addBand = (i: number) => update({ rates: form.rates.map((r, ri) => (ri === i ? { ...r, bands: [...r.bands, emptyBand(currencies)] } : r)) })
  const removeBand = (i: number, j: number) => update({ rates: form.rates.map((r, ri) => (ri === i ? { ...r, bands: r.bands.filter((_, bj) => bj !== j) } : r)) })
  const addRate = (zoneId: string) => update({ rates: [...form.rates, { zoneId, bands: [emptyBand(currencies)] }] })
  const removeRate = (i: number) => update({ rates: form.rates.filter((_, ri) => ri !== i) })

  const save = async () => {
    const result = formToMethod(form, currencies, language, defaultLanguage)
    setErrors(result.errors)
    setServerError(null)
    if (!result.body) return
    setSaving(true)
    try {
      const saved = await writes.saveMethod(method?.id, result.body)
      toast.success(t('method.saved'))
      if (method) setForm(methodToForm(saved, currencies, language))
      else navigate(`/commerce/shipping/methods/${saved.id}`, { replace: true, state: { skipGuard: true } })
    } catch (error) {
      setServerError(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!method) return
    try {
      await writes.removeMethod(method.id)
      toast.success(t('method.deleted'))
      navigate('/commerce/shipping', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setConfirmDelete(false)
    }
  }

  const sectionTitle = 'font-serif text-xl font-semibold'
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/commerce/shipping" className="text-sm text-muted-foreground hover:underline">{t('method.back')}</Link>}
        title={name}
        actions={
          <div className="flex flex-wrap gap-2">
            {method && (
              <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>{t('method.delete')}</Button>
            )}
            <Button onClick={() => void save()} disabled={saving || (!!method && !dirty)}>{t('method.save')}</Button>
          </div>
        }
      />
      {(serverError || Object.keys(errors).length > 0) && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError ?? t('method.fixErrors')}</div>
      )}
      <div className="space-y-8">
        <section aria-labelledby="method-general" className="min-w-0 space-y-3">
          <h2 id="method-general" className={sectionTitle}>{t('method.general')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {languages.map((l) => (
              <TextField
                key={l.code}
                id={`label-${l.code}`}
                label={t('method.label', { language: l.name })}
                value={form.labels[l.code] ?? ''}
                onChange={(value) => update({ labels: { ...form.labels, [l.code]: value } })}
                error={err(`label:${l.code}`)}
              />
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Switch id="method-active" checked={form.active} onCheckedChange={(active) => update({ active })} aria-describedby="method-active-hint" />
              <Label htmlFor="method-active">{t('method.active')}</Label>
            </div>
            <p id="method-active-hint" className="text-xs text-muted-foreground">{t('method.activeHint')}</p>
          </div>
        </section>

        <section aria-labelledby="method-payment" className="min-w-0 space-y-3">
          <h2 id="method-payment" className={sectionTitle}>{t('method.payment')}</h2>
          <p className="text-sm text-muted-foreground">{t('method.paymentHint')}</p>
          <div className="flex flex-wrap gap-4">
            {PAYMENT_METHODS.map((pm) => (
              <label key={pm} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={form.paymentMethods.includes(pm)} onChange={() => togglePayment(pm)} />
                {t(`payment.${pm}`)}
              </label>
            ))}
          </div>
          {errors.payment && <p className="text-sm text-destructive">{t('method.errors.paymentRequired')}</p>}
          {form.paymentMethods.includes('CASH_ON_DELIVERY') && (
            <div className="flex flex-wrap gap-3">
              {currencies.map((c) => (
                <TextField
                  key={c.code}
                  id={`cod-${c.code}`}
                  inputMode="decimal"
                  className="w-56"
                  label={t('method.codFeeLabel', { code: c.code })}
                  value={form.codFees[c.code] ?? ''}
                  onChange={(value) => update({ codFees: { ...form.codFees, [c.code]: value } })}
                  error={err(`cod:${c.code}`)}
                />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="method-free" className="min-w-0 space-y-3">
          <h2 id="method-free" className={sectionTitle}>{t('method.freeOver')}</h2>
          <p className="text-sm text-muted-foreground">{t('method.freeOverHint')}</p>
          <div className="flex flex-wrap gap-3">
            {currencies.map((c) => (
              <TextField
                key={c.code}
                id={`free-${c.code}`}
                inputMode="decimal"
                className="w-56"
                label={t('method.freeOverLabel', { code: c.code })}
                value={form.freeOver[c.code] ?? ''}
                onChange={(value) => update({ freeOver: { ...form.freeOver, [c.code]: value } })}
                error={err(`free:${c.code}`)}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="method-rates" className="min-w-0 space-y-3">
          <h2 id="method-rates" className={sectionTitle}>{t('method.rates')}</h2>
          <p className="text-sm text-muted-foreground">{t('method.ratesHint')}</p>
          {errors.rates && <p className="text-sm text-destructive">{t('method.errors.ratesRequired')}</p>}
          {form.rates.map((rate, i) => (
            <div key={rate.zoneId} className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{zoneName(rate.zoneId)}</h3>
                <Button variant="ghost" size="sm" onClick={() => removeRate(i)}>{t('method.removeZone', { name: zoneName(rate.zoneId) })}</Button>
              </div>
              <ul className="space-y-3">
                {rate.bands.map((band, j) => (
                  <li key={j} className="flex flex-wrap items-start gap-3">
                    <TextField
                      id={`rate-${i}-band-${j}-upTo`}
                      inputMode="numeric"
                      className="w-44"
                      label={t('method.upToLabel', { n: j + 1 })}
                      hint={j === rate.bands.length - 1 ? t('method.noLimitHint') : undefined}
                      value={band.upTo}
                      onChange={(upTo) => setBand(i, j, { upTo })}
                      error={err(`rate:${i}:band:${j}:upTo`)}
                    />
                    {currencies.map((c) => (
                      <TextField
                        key={c.code}
                        id={`rate-${i}-band-${j}-${c.code}`}
                        inputMode="decimal"
                        className="w-44"
                        label={t('method.priceLabel', { code: c.code, n: j + 1 })}
                        value={band.prices[c.code] ?? ''}
                        onChange={(value) => setBand(i, j, { prices: { ...band.prices, [c.code]: value } })}
                        error={err(`rate:${i}:band:${j}:price:${c.code}`)}
                      />
                    ))}
                    {rate.bands.length > 1 && (
                      <Button variant="ghost" size="icon" className="mt-6" aria-label={t('method.removeBand', { n: j + 1 })} onClick={() => removeBand(i, j)}>
                        <Trash2 aria-hidden />
                      </Button>
                    )}
                    {errors[`rate:${i}:band:${j}:price`] && <p className="w-full text-sm text-destructive">{t('method.errors.bandPrice')}</p>}
                  </li>
                ))}
              </ul>
              <Button variant="outline" size="sm" onClick={() => addBand(i)}>{t('method.addBand')}</Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            {unusedZones.map((z) => (
              <Button key={z.id} variant="outline" size="sm" onClick={() => addRate(z.id)}>{t('method.addZoneRates', { name: z.name })}</Button>
            ))}
          </div>
        </section>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('method.deleteTitle', { name })}
        description={t('method.deleteText')}
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        onConfirm={() => void remove()}
      />
      <UnsavedChangesDialog blocker={blocker} />
    </>
  )
}
```

Create `features/commerce/pages/ShippingMethodPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useLanguages } from '@/features/languages/languages-queries'
import { useShopSettings } from '../commerce-queries'
import { useMethods, useZones } from '../shipping-queries'
import { MethodEditor } from '../components/MethodEditor'

export function ShippingMethodPage() {
  const { id } = useParams()
  const { t } = useTranslation('shipping')
  const zones = useZones()
  const methods = useMethods()
  const settings = useShopSettings()
  const languages = useLanguages()

  if (zones.isError || methods.isError || settings.isError || languages.isError) {
    const retry = () => {
      void zones.refetch()
      void methods.refetch()
      void settings.refetch()
      void languages.refetch()
    }
    return <ErrorState message={t('page.loadError')} onRetry={retry} />
  }
  if (zones.isPending || methods.isPending || settings.isPending || languages.isPending) return <Skeleton className="h-64 w-full" />

  const method = id === 'new' ? undefined : methods.data.find((m) => m.id === id)
  if (id !== 'new' && !method) return <ErrorState message={t('method.notFound')} />
  // Keyed by id so a new method's form resets once it has been created.
  return <MethodEditor key={id} method={method} zones={zones.data} currencies={settings.data.currencies} languages={languages.data} />
}
```

In `modules/registry.tsx`, import `ShippingMethodPage` and add its route to the `shipping` module:

```tsx
    routes: [
      { path: 'commerce/shipping', element: <ShippingPage /> },
      { path: 'commerce/shipping/methods/:id', element: <ShippingMethodPage /> },
    ],
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce src/i18n`
Expected: PASS.

- [ ] **Step 7: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(admin): shipping method editor with weight bands, fees and payment choices"
```

---

### Task 5: Orders list and navigation badge

**Files:**
- Create: `features/commerce/components/OrderBadges.tsx`, `features/commerce/pages/OrdersListPage.tsx`, `i18n/locales/{en,cs}/orders.json`
- Modify: `i18n/resources.ts`, `i18n/locales/{en,cs}/shell.json`, `modules/registry.tsx`
- Test: `features/commerce/pages/OrdersListPage.test.tsx`, `modules/registry.test.tsx`

**Interfaces:**
- Consumes: `useOrders`, `useOrdersNeedingAction` (Task 1); `ORDER_STATUSES`, `PAYMENT_STATUSES`, `FULFILMENT_STATUSES`; `useShopSettings`; `formatMoney`, `currencyFor`; `formatAbsolute` from `@/lib/format`; `DataList`, `Pager`, `EmptyState`.
- Produces: `OrderStatusBadge({ status })`, `PaymentBadge({ status })`, `FulfilmentBadge({ status })` (used by Task 6); the `orders` namespace (Task 6 adds keys); module `orders` at `/commerce/orders` with the badge.

- [ ] **Step 1: Write the failing tests**

Create `features/commerce/pages/OrdersListPage.test.tsx`:

```tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { OrdersListPage } from './OrdersListPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/orders', element: <OrdersListPage /> }]
const settings = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [] }
const order = {
  id: 'o1',
  number: '2026000001',
  createdAt: '2026-10-01T10:00:00.000Z',
  customer: { name: 'Jana Nováková', email: 'jana@example.test' },
  total: 91800,
  currency: 'CZK',
  status: 'PLACED',
  paymentStatus: 'UNPAID',
  fulfilmentStatus: 'UNFULFILLED',
}

function serve(orders: unknown[]) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/settings') return { data: { success: true, data: settings } }
    if (url === '/commerce/orders') return { data: { success: true, data: orders, pagination: { page: 1, limit: 20, total: orders.length, totalPages: 1 } } }
    throw new Error(`unexpected GET ${url}`)
  })
}

beforeEach(() => serve([order]))

it('lists orders with number, customer, total and statuses', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/orders' })
  const table = await screen.findByRole('table', { name: 'Orders' })
  expect(table).toHaveTextContent('Jana Nováková')
  expect(table).toHaveTextContent(/918\.00/)
  expect(table).toHaveTextContent('Unpaid')
  expect(table).toHaveTextContent('Not shipped')
  expect(table).toHaveTextContent('Open')
  expect(screen.getAllByRole('link', { name: '2026000001' })[0]).toHaveAttribute('href', '/commerce/orders/o1')
  await expectNoA11yViolations(container)
})

it('sends filters from the address and the needs action toggle', async () => {
  renderRoutes(routes, { route: '/commerce/orders?payment=PAID&shipping=UNFULFILLED&status=nonsense' })
  await screen.findByRole('table', { name: 'Orders' })
  expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders', { params: { paymentStatus: 'PAID', fulfilmentStatus: 'UNFULFILLED', page: 1, limit: 20 } })
  const toggle = screen.getByRole('button', { name: 'Needs action' })
  expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await userEvent.click(toggle)
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith('/commerce/orders', { params: { paymentStatus: 'PAID', fulfilmentStatus: 'UNFULFILLED', needsAction: 'true', page: 1, limit: 20 } }),
  )
  expect(screen.getByRole('button', { name: 'Needs action' })).toHaveAttribute('aria-pressed', 'true')
})

it('shows an empty state, and a different message when filters match nothing', async () => {
  serve([])
  const first = renderRoutes(routes, { route: '/commerce/orders' })
  expect(await screen.findByText('No orders yet')).toBeInTheDocument()
  first.unmount()
  renderRoutes(routes, { route: '/commerce/orders?payment=PAID' })
  expect(await screen.findByText('No orders match these filters.')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/orders' })
  expect(await screen.findByRole('heading', { name: 'Objednávky' })).toBeInTheDocument()
  const table = await screen.findByRole('table', { name: 'Objednávky' })
  expect(table).toHaveTextContent('Nezaplaceno')
  expect(table).toHaveTextContent(/918,00\s?Kč/)
  await expectNoA11yViolations(container)
})
```

In `modules/registry.test.tsx`, change the commerce line to:

```ts
    expect(commerce.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Orders', 'Products', 'Shipping', 'Shop settings'])
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce/pages/OrdersListPage.test.tsx src/modules/registry.test.tsx`
Expected: FAIL (page missing; no Orders module).

- [ ] **Step 3: Add the catalogs and register the namespace**

Create `i18n/locales/en/orders.json`:

```json
{
  "list": {
    "title": "Orders",
    "description": "Orders placed on your sites.",
    "tableLabel": "Orders",
    "search": "Search orders",
    "searchPlaceholder": "Number, email or name",
    "statusFilter": "Order status",
    "paymentFilter": "Payment",
    "shippingFilter": "Shipping",
    "anyStatus": "Any status",
    "anyPayment": "Any payment",
    "anyShipping": "Any shipping",
    "needsAction": "Needs action",
    "emptyTitle": "No orders yet",
    "emptyText": "Orders appear here when customers check out on your site.",
    "noMatches": "No orders match these filters.",
    "loadError": "Could not load orders.",
    "columns": {
      "number": "Order",
      "date": "Date",
      "customer": "Customer",
      "total": "Total",
      "payment": "Payment",
      "shipping": "Shipping",
      "status": "Status"
    }
  },
  "status": {
    "PLACED": "Open",
    "COMPLETED": "Completed",
    "CANCELLED": "Cancelled"
  },
  "payment": {
    "UNPAID": "Unpaid",
    "PAID": "Paid",
    "REFUNDED": "Refunded"
  },
  "fulfilment": {
    "UNFULFILLED": "Not shipped",
    "SHIPPED": "Shipped"
  },
  "method": {
    "BANK_TRANSFER": "Bank transfer",
    "CASH_ON_DELIVERY": "Cash on delivery"
  }
}
```

Create `i18n/locales/cs/orders.json`:

```json
{
  "list": {
    "title": "Objednávky",
    "description": "Objednávky z vašich webů.",
    "tableLabel": "Objednávky",
    "search": "Hledat objednávky",
    "searchPlaceholder": "Číslo, e-mail nebo jméno",
    "statusFilter": "Stav objednávky",
    "paymentFilter": "Platba",
    "shippingFilter": "Doprava",
    "anyStatus": "Jakýkoli stav",
    "anyPayment": "Jakákoli platba",
    "anyShipping": "Jakákoli doprava",
    "needsAction": "Čeká na vyřízení",
    "emptyTitle": "Zatím žádné objednávky",
    "emptyText": "Objednávky se tu objeví, až zákazníci nakoupí na vašem webu.",
    "noMatches": "Filtrům neodpovídá žádná objednávka.",
    "loadError": "Objednávky se nepodařilo načíst.",
    "columns": {
      "number": "Objednávka",
      "date": "Datum",
      "customer": "Zákazník",
      "total": "Celkem",
      "payment": "Platba",
      "shipping": "Doprava",
      "status": "Stav"
    }
  },
  "status": {
    "PLACED": "Otevřená",
    "COMPLETED": "Vyřízená",
    "CANCELLED": "Zrušená"
  },
  "payment": {
    "UNPAID": "Nezaplaceno",
    "PAID": "Zaplaceno",
    "REFUNDED": "Vráceno"
  },
  "fulfilment": {
    "UNFULFILLED": "Neodesláno",
    "SHIPPED": "Odesláno"
  },
  "method": {
    "BANK_TRANSFER": "Bankovní převod",
    "CASH_ON_DELIVERY": "Dobírka"
  }
}
```

In `i18n/resources.ts`, import `enOrders`/`csOrders`, add `'orders'` to the end of `NAMESPACES` and `orders` to both resource maps. In `shell.json` `nav`, add `"orders": "Orders"` (en) and `"orders": "Objednávky"` (cs).

- [ ] **Step 4: Implement the badges, page and module**

Create `features/commerce/components/OrderBadges.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { FulfilmentStatus, OrderStatus, PaymentStatus } from '../orders-api'

type Variant = 'default' | 'secondary' | 'destructive' | 'outline'

const STATUS: Record<OrderStatus, Variant> = { PLACED: 'outline', COMPLETED: 'default', CANCELLED: 'destructive' }
const PAYMENT: Record<PaymentStatus, Variant> = { UNPAID: 'outline', PAID: 'default', REFUNDED: 'secondary' }
const FULFILMENT: Record<FulfilmentStatus, Variant> = { UNFULFILLED: 'outline', SHIPPED: 'default' }

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation('orders')
  return <Badge variant={STATUS[status]}>{t(`status.${status}`)}</Badge>
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { t } = useTranslation('orders')
  return <Badge variant={PAYMENT[status]}>{t(`payment.${status}`)}</Badge>
}

export function FulfilmentBadge({ status }: { status: FulfilmentStatus }) {
  const { t } = useTranslation('orders')
  return <Badge variant={FULFILMENT[status]}>{t(`fulfilment.${status}`)}</Badge>
}
```

Create `features/commerce/pages/OrdersListPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ReceiptText, Search } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { DataList, type DataColumn } from '@/components/common/DataList'
import { Pager } from '@/components/common/Pager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { formatAbsolute } from '@/lib/format'
import {
  FULFILMENT_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  type FulfilmentStatus,
  type OrderListItem,
  type OrderStatus,
  type PaymentStatus,
} from '../orders-api'
import { useOrders } from '../orders-queries'
import { useShopSettings } from '../commerce-queries'
import { currencyFor, formatMoney } from '../money'
import { FulfilmentBadge, OrderStatusBadge, PaymentBadge } from '../components/OrderBadges'

const PAGE_SIZE = 20
const ANY = 'any'

function pick<T extends string>(value: string | null, allowed: T[]): T | undefined {
  return value && (allowed as string[]).includes(value) ? (value as T) : undefined
}

function useListParams() {
  const [sp, setSp] = useSearchParams()
  const params = useMemo(() => {
    const page = Number(sp.get('page'))
    return {
      q: sp.get('q')?.trim().slice(0, 100) || undefined,
      status: pick<OrderStatus>(sp.get('status'), ORDER_STATUSES),
      payment: pick<PaymentStatus>(sp.get('payment'), PAYMENT_STATUSES),
      shipping: pick<FulfilmentStatus>(sp.get('shipping'), FULFILMENT_STATUSES),
      action: sp.get('action') === '1',
      page: Number.isInteger(page) && page > 1 ? page : 1,
    }
  }, [sp])
  const update = (patch: Partial<typeof params>) => {
    const next = { ...params, ...patch, page: patch.page ?? 1 }
    const out = new URLSearchParams()
    if (next.q) out.set('q', next.q)
    if (next.status) out.set('status', next.status)
    if (next.payment) out.set('payment', next.payment)
    if (next.shipping) out.set('shipping', next.shipping)
    if (next.action) out.set('action', '1')
    if (next.page > 1) out.set('page', String(next.page))
    setSp(out, { replace: true })
  }
  return [params, update] as const
}

export function OrdersListPage() {
  const { t, i18n } = useTranslation('orders')
  const settings = useShopSettings()
  const [params, update] = useListParams()
  const [search, setSearch] = useState(params.q ?? '')
  const debounced = useDebouncedValue(search, 300)
  useEffect(() => {
    const next = debounced.trim() || undefined
    if (next !== params.q) update({ q: next })
    // Only react to the debounced text.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const list = useOrders({
    search: params.q,
    status: params.status,
    paymentStatus: params.payment,
    fulfilmentStatus: params.shipping,
    needsAction: params.action,
    page: params.page,
    limit: PAGE_SIZE,
  })
  const filtered = !!(params.q || params.status || params.payment || params.shipping || params.action)
  const money = (o: OrderListItem) => formatMoney(o.total, currencyFor(o.currency, settings.data?.currencies ?? []), i18n.language)

  const columns: DataColumn<OrderListItem>[] = [
    { id: 'number', header: t('list.columns.number'), cell: (o) => <NumberLink order={o} />, className: 'w-32' },
    { id: 'date', header: t('list.columns.date'), cell: (o) => <span className="text-muted-foreground">{formatAbsolute(o.createdAt)}</span>, className: 'w-40 whitespace-nowrap' },
    { id: 'customer', header: t('list.columns.customer'), cell: (o) => <Customer order={o} /> },
    { id: 'total', header: t('list.columns.total'), cell: (o) => money(o), className: 'w-32 whitespace-nowrap' },
    { id: 'payment', header: t('list.columns.payment'), cell: (o) => <PaymentBadge status={o.paymentStatus} />, className: 'w-28' },
    { id: 'shipping', header: t('list.columns.shipping'), cell: (o) => <FulfilmentBadge status={o.fulfilmentStatus} />, className: 'w-28' },
    { id: 'status', header: t('list.columns.status'), cell: (o) => <OrderStatusBadge status={o.status} />, className: 'w-28' },
  ]

  let body: React.ReactNode
  if (list.isPending) body = <Skeleton className="h-40 w-full" />
  else if (list.isError) body = <ErrorState message={t('list.loadError')} onRetry={() => void list.refetch()} />
  else if (list.data.data.length === 0)
    body = filtered ? <p className="py-8 text-center text-sm text-muted-foreground">{t('list.noMatches')}</p> : <EmptyState icon={ReceiptText} title={t('list.emptyTitle')} description={t('list.emptyText')} />
  else
    body = (
      <>
        <DataList
          caption={t('list.tableLabel')}
          rows={list.data.data}
          columns={columns}
          rowKey={(o) => o.id}
          mobileRow={(o) => (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <NumberLink order={o} />
                <span className="text-sm font-medium">{money(o)}</span>
              </div>
              <Customer order={o} />
              <div className="flex flex-wrap gap-1.5">
                <PaymentBadge status={o.paymentStatus} />
                <FulfilmentBadge status={o.fulfilmentStatus} />
                <OrderStatusBadge status={o.status} />
              </div>
            </div>
          )}
        />
        <Pager page={params.page} limit={PAGE_SIZE} total={list.data.pagination.total} onPageChange={(page) => update({ page })} />
      </>
    )

  return (
    <>
      <PageHeader title={t('list.title')} description={t('list.description')} />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" aria-label={t('list.search')} placeholder={t('list.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-full pl-9" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={params.action ? 'default' : 'outline'} className="rounded-full" aria-pressed={params.action} onClick={() => update({ action: !params.action })}>
            {t('list.needsAction')}
          </Button>
          <Select value={params.status ?? ANY} onValueChange={(v) => update({ status: v === ANY ? undefined : (v as OrderStatus) })}>
            <SelectTrigger aria-label={t('list.statusFilter')} className="w-auto min-w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('list.anyStatus')}</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`status.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.payment ?? ANY} onValueChange={(v) => update({ payment: v === ANY ? undefined : (v as PaymentStatus) })}>
            <SelectTrigger aria-label={t('list.paymentFilter')} className="w-auto min-w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('list.anyPayment')}</SelectItem>
              {PAYMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`payment.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={params.shipping ?? ANY} onValueChange={(v) => update({ shipping: v === ANY ? undefined : (v as FulfilmentStatus) })}>
            <SelectTrigger aria-label={t('list.shippingFilter')} className="w-auto min-w-36 rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>{t('list.anyShipping')}</SelectItem>
              {FULFILMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{t(`fulfilment.${s}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {body}
    </>
  )
}

function NumberLink({ order }: { order: OrderListItem }) {
  return (
    <Link to={`/commerce/orders/${order.id}`} className="font-mono font-semibold hover:underline">
      {order.number}
    </Link>
  )
}

function Customer({ order }: { order: OrderListItem }) {
  return (
    <div className="min-w-0">
      <p className="truncate">{order.customer.name}</p>
      <p className="truncate text-xs text-muted-foreground">{order.customer.email}</p>
    </div>
  )
}
```

In `modules/registry.tsx`, import `ReceiptText` and `OrdersListPage`, and add before the `products` module:

```tsx
  {
    id: 'orders',
    labelKey: 'nav.orders',
    icon: ReceiptText,
    group: 'commerce',
    path: '/commerce/orders',
    useBadge: useOrdersNeedingAction,
    routes: [{ path: 'commerce/orders', element: <OrdersListPage /> }],
  },
```

(Import `useOrdersNeedingAction` from `@/features/commerce/orders-queries`.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce src/modules src/i18n src/app`
Expected: PASS. If a shell test fails because its `apiClient.get` mock does not know `/commerce/orders/needs-action`, make that mock return `{ data: { success: true, data: { count: 0 } } }` for the URL (the badge query must not break other screens), and ledger it.

- [ ] **Step 6: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(admin): orders list with filters and a needs-action badge"
```

---

### Task 6: Order page and actions

**Files:**
- Create: `features/commerce/order-rules.ts`, `features/commerce/pages/OrderPage.tsx`, `features/commerce/components/order/OrderLines.tsx`, `OrderDetails.tsx`, `OrderHistory.tsx`, `OrderActions.tsx`, `InternalNote.tsx`
- Modify: `i18n/locales/{en,cs}/orders.json`, `modules/registry.tsx`
- Test: `features/commerce/order-rules.test.ts`, `features/commerce/pages/OrderPage.test.tsx`

**Interfaces:**
- Consumes: `Order`, `useOrder`, `useOrderWrites` (Task 1); badges (Task 5); `TextField` (Task 2); `countryName` (Task 3); `currencyFor`, `formatMoney`; `formatAbsolute`; `ConfirmDialog`; `Dialog`.
- Produces: `availableActions(order): { markPaid, ship, cancel, resendConfirmation, resendDownloads }`; route `/commerce/orders/:id`.

- [ ] **Step 1: Write the failing tests**

Create `features/commerce/order-rules.test.ts`:

```ts
import { availableActions } from './order-rules'

const physical = { type: 'PHYSICAL' as const }
const digital = { type: 'DIGITAL' as const }

it('offers payment, shipping and cancel on an open unpaid order', () => {
  expect(availableActions({ status: 'PLACED', paymentStatus: 'UNPAID', fulfilmentStatus: 'UNFULFILLED', lines: [physical, digital] })).toEqual({
    markPaid: true,
    ship: true,
    cancel: true,
    resendConfirmation: true,
    resendDownloads: false,
  })
})

it('never ships a digital-only order and resends downloads once paid', () => {
  expect(availableActions({ status: 'COMPLETED', paymentStatus: 'PAID', fulfilmentStatus: 'SHIPPED', lines: [digital] })).toEqual({
    markPaid: false,
    ship: false,
    cancel: false,
    resendConfirmation: true,
    resendDownloads: true,
  })
  expect(availableActions({ status: 'PLACED', paymentStatus: 'UNPAID', fulfilmentStatus: 'UNFULFILLED', lines: [digital] }).ship).toBe(false)
})

it('offers nothing on a cancelled order', () => {
  expect(Object.values(availableActions({ status: 'CANCELLED', paymentStatus: 'PAID', fulfilmentStatus: 'UNFULFILLED', lines: [physical, digital] }))).toEqual([false, false, false, false, false])
})
```

Create `features/commerce/pages/OrderPage.test.tsx`:

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { OrderPage } from './OrderPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/orders/:id', element: <OrderPage /> }]
const settings = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [] }
const address = { name: 'Jana Nováková', street: 'Hlavní 1', city: 'Praha', postalCode: '11000', country: 'CZ' }
const base = {
  id: 'o1',
  number: '2026000001',
  accessToken: 'secret',
  currency: 'CZK',
  language: 'cs',
  customer: { email: 'jana@example.test', name: 'Jana Nováková', phone: '+420 777 000 111' },
  billingAddress: address,
  shippingAddress: address,
  note: 'Ring twice',
  lines: [
    { productId: 'p1', variantId: 'v1', itemId: 'i1', sku: 'TEE-S', name: 'Cyklistické tričko', optionLabels: [{ option: 'Size', value: 'S' }], type: 'PHYSICAL', unitPrice: 49000, quantity: 1, vatRate: 2100, lineTotal: 49000, weightGrams: 500 },
    { productId: 'p2', variantId: 'v2', itemId: 'i2', sku: 'GUIDE', name: 'Průvodce Šumavou', optionLabels: [], type: 'DIGITAL', unitPrice: 29900, quantity: 1, vatRate: 1200, lineTotal: 29900, weightGrams: 0 },
  ],
  shipping: { methodId: 'm1', name: 'Courier', price: 12900 },
  payment: { method: 'BANK_TRANSFER', fee: 0, reference: '2026000001' },
  totals: { items: 78900, shipping: 12900, paymentFee: 0, total: 91800, vat: [{ rate: 2100, base: 51314, amount: 10776 }, { rate: 1200, base: 26696, amount: 3204 }] },
  status: 'PLACED',
  paymentStatus: 'UNPAID',
  fulfilmentStatus: 'UNFULFILLED',
  history: [
    { at: '2026-10-01T10:00:00.000Z', type: 'placed' },
    { at: '2026-10-01T10:00:01.000Z', type: 'email-failed', detail: 'confirmation: email is not configured' },
  ],
  createdAt: '2026-10-01T10:00:00.000Z',
  instructions: { holder: 'Test Shop', iban: 'CZ6508000000192000145399', amount: 91800, currency: 'CZK', reference: '2026000001' },
}

function serve(order: Record<string, unknown> = base) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/settings') return { data: { success: true, data: settings } }
    if (url === '/commerce/orders/o1') return { data: { success: true, data: order } }
    throw new Error(`unexpected GET ${url}`)
  })
}

beforeEach(() => {
  serve()
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: base } })
  vi.mocked(apiClient.put).mockResolvedValue({ data: { success: true, data: base } })
})

const orderCalls = () => vi.mocked(apiClient.get).mock.calls.filter((c) => c[0] === '/commerce/orders/o1').length

it('shows lines, totals, customer, addresses, payment instructions and history', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/orders/o1' })
  expect(await screen.findByRole('heading', { name: 'Order 2026000001' })).toBeInTheDocument()
  const lines = screen.getByRole('list', { name: 'Order items' })
  expect(within(lines).getByText('Size: S')).toBeInTheDocument()
  expect(within(lines).getByText('Download')).toBeInTheDocument()
  expect(screen.getByText('Total').nextElementSibling).toHaveTextContent(/918\.00/)
  expect(screen.getByText('Ring twice')).toBeInTheDocument()
  expect(screen.getAllByText('Czechia').length).toBeGreaterThan(0)
  expect(screen.getByText('IBAN: CZ6508000000192000145399')).toBeInTheDocument()
  expect(screen.getByText('Email not sent')).toBeInTheDocument()
  expect(screen.getByText('confirmation: email is not configured')).toBeInTheDocument()
  const actions = screen.getByRole('group', { name: 'Order actions' })
  expect(within(actions).getAllByRole('button').map((b) => b.textContent)).toEqual(['Mark as paid', 'Mark as shipped', 'Cancel order', 'Resend confirmation'])
  await expectNoA11yViolations(container)
})

it('marks the order paid after confirming', async () => {
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as paid' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Mark order 2026000001 as paid?' })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as paid' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/o1/paid'))
  expect(await screen.findByText('Order marked as paid')).toBeInTheDocument()
})

it('ships with tracking and refuses a bad tracking link', async () => {
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Mark as shipped' }))
  const dialog = await screen.findByRole('dialog', { name: 'Mark order 2026000001 as shipped' })
  await userEvent.type(within(dialog).getByLabelText('Tracking number'), 'DR123')
  await userEvent.type(within(dialog).getByLabelText('Tracking link'), 'ftp://x')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as shipped' }))
  expect(within(dialog).getByText('Enter an http or https link')).toBeInTheDocument()
  expect(apiClient.post).not.toHaveBeenCalled()
  const link = within(dialog).getByLabelText('Tracking link')
  await userEvent.clear(link)
  await userEvent.type(link, 'https://track.test/DR123')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as shipped' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/o1/shipped', { trackingNumber: 'DR123', trackingUrl: 'https://track.test/DR123' }))
})

it('cancels a paid order and asks about the refund', async () => {
  serve({ ...base, paymentStatus: 'PAID', instructions: undefined })
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
  const dialog = await screen.findByRole('dialog', { name: 'Cancel order 2026000001?' })
  await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Mark the payment as refunded' }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel order' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/commerce/orders/o1/cancel', { refunded: true }))
})

it('shows the reason when an action is no longer possible and reloads the order', async () => {
  vi.mocked(apiClient.post).mockRejectedValue(
    Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'This action is not possible for the order in its current state' } } }),
  )
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Resend confirmation' }))
  expect(await screen.findByText('This action is not possible for the order in its current state')).toBeInTheDocument()
  await waitFor(() => expect(orderCalls()).toBe(2))
})

it('saves the internal note', async () => {
  renderRoutes(routes, { route: '/commerce/orders/o1' })
  const note = await screen.findByLabelText('Internal note')
  expect(screen.getByRole('button', { name: 'Save note' })).toBeDisabled()
  await userEvent.type(note, 'Called the customer')
  await userEvent.click(screen.getByRole('button', { name: 'Save note' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/commerce/orders/o1/note', { note: 'Called the customer' }))
  expect(await screen.findByText('Note saved')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/orders/o1' })
  expect(await screen.findByRole('heading', { name: 'Objednávka 2026000001' })).toBeInTheDocument()
  expect(screen.getByText('Variabilní symbol: 2026000001')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Označit jako zaplacené' })).toBeInTheDocument()
  expect(screen.getByText('Celkem').nextElementSibling).toHaveTextContent(/918,00\s?Kč/)
  expect(screen.getAllByText('Česko').length).toBeGreaterThan(0)
  await expectNoA11yViolations(container)
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce/order-rules.test.ts src/features/commerce/pages/OrderPage.test.tsx`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the rules**

Create `features/commerce/order-rules.ts`:

```ts
import type { Order } from './orders-api'

export interface OrderActionSet {
  markPaid: boolean
  ship: boolean
  cancel: boolean
  resendConfirmation: boolean
  resendDownloads: boolean
}

/** Mirrors the backend guards, so the page offers only actions the server accepts. */
export function availableActions(order: Pick<Order, 'status' | 'paymentStatus' | 'fulfilmentStatus'> & { lines: Pick<Order['lines'][number], 'type'>[] }): OrderActionSet {
  const open = order.status === 'PLACED'
  const live = order.status !== 'CANCELLED'
  const physical = order.lines.some((l) => l.type === 'PHYSICAL')
  const digital = order.lines.some((l) => l.type === 'DIGITAL')
  return {
    markPaid: open && order.paymentStatus === 'UNPAID',
    ship: open && physical && order.fulfilmentStatus === 'UNFULFILLED',
    cancel: open,
    resendConfirmation: live,
    resendDownloads: live && digital && order.paymentStatus === 'PAID',
  }
}
```

- [ ] **Step 4: Add the order catalog keys**

Add to `i18n/locales/en/orders.json`:

```json
  "order": {
    "title": "Order {{number}}",
    "placedAt": "Placed {{date}}",
    "back": "Orders",
    "loadError": "Could not load the order.",
    "items": "Items",
    "linesLabel": "Order items",
    "option": "{{option}}: {{value}}",
    "sku": "SKU {{sku}}",
    "digital": "Download",
    "quantityPrice": "{{quantity}} × {{price}}",
    "itemsTotal": "Items",
    "shippingTotal": "Shipping: {{name}}",
    "paymentFee": "Payment fee",
    "total": "Total",
    "vatLine": "Incl. VAT {{rate}} %: {{amount}} (base {{base}})",
    "customer": "Customer",
    "billing": "Billing address",
    "shipping": "Shipping address",
    "vatId": "VAT ID {{id}}",
    "payment": "Payment",
    "reference": "Payment reference: {{reference}}",
    "instructions": "Waiting for this transfer",
    "holder": "Account holder: {{holder}}",
    "accountNumber": "Account number: {{number}}",
    "iban": "IBAN: {{iban}}",
    "bic": "BIC: {{bic}}",
    "amount": "Amount: {{amount}}",
    "tracking": "Tracking",
    "trackingNumber": "Number {{number}}",
    "trackingLink": "Track the parcel",
    "customerNote": "Note from the customer",
    "internalNote": "Internal note",
    "internalNoteHint": "Only your team sees this.",
    "saveNote": "Save note",
    "noteSaved": "Note saved",
    "history": "History",
    "historyBy": "{{label}} ({{by}})",
    "actionsLabel": "Order actions"
  },
  "historyTypes": {
    "placed": "Order placed",
    "paid": "Marked as paid",
    "shipped": "Marked as shipped",
    "delivered-digital": "Delivered by download links",
    "cancelled": "Cancelled",
    "email-sent": "Email sent",
    "email-failed": "Email not sent",
    "resent": "Email resent"
  },
  "automatically": "automatically",
  "actions": {
    "markPaid": "Mark as paid",
    "markPaidTitle": "Mark order {{number}} as paid?",
    "markPaidText": "The customer gets a payment confirmation, with download links for digital items.",
    "paidDone": "Order marked as paid",
    "ship": "Mark as shipped",
    "shipTitle": "Mark order {{number}} as shipped",
    "shipText": "The customer gets an email with the tracking details.",
    "trackingNumber": "Tracking number",
    "trackingUrl": "Tracking link",
    "trackingUrlInvalid": "Enter an http or https link",
    "shippedDone": "Order marked as shipped",
    "cancel": "Cancel order",
    "cancelTitle": "Cancel order {{number}}?",
    "cancelText": "Stock goes back, download links stop working and the customer gets an email.",
    "refunded": "Mark the payment as refunded",
    "keep": "Keep order",
    "cancelledDone": "Order cancelled",
    "resendConfirmation": "Resend confirmation",
    "resendDownloads": "Resend download links",
    "resentDone": "The email is on its way. The history shows if it fails."
  }
```

Add to `i18n/locales/cs/orders.json`:

```json
  "order": {
    "title": "Objednávka {{number}}",
    "placedAt": "Vytvořena {{date}}",
    "back": "Objednávky",
    "loadError": "Objednávku se nepodařilo načíst.",
    "items": "Položky",
    "linesLabel": "Položky objednávky",
    "option": "{{option}}: {{value}}",
    "sku": "SKU {{sku}}",
    "digital": "Ke stažení",
    "quantityPrice": "{{quantity}} × {{price}}",
    "itemsTotal": "Zboží",
    "shippingTotal": "Doprava: {{name}}",
    "paymentFee": "Poplatek za platbu",
    "total": "Celkem",
    "vatLine": "Včetně DPH {{rate}} %: {{amount}} (základ {{base}})",
    "customer": "Zákazník",
    "billing": "Fakturační adresa",
    "shipping": "Doručovací adresa",
    "vatId": "DIČ {{id}}",
    "payment": "Platba",
    "reference": "Variabilní symbol: {{reference}}",
    "instructions": "Čekáme na tuto platbu",
    "holder": "Majitel účtu: {{holder}}",
    "accountNumber": "Číslo účtu: {{number}}",
    "iban": "IBAN: {{iban}}",
    "bic": "BIC: {{bic}}",
    "amount": "Částka: {{amount}}",
    "tracking": "Sledování zásilky",
    "trackingNumber": "Číslo {{number}}",
    "trackingLink": "Sledovat zásilku",
    "customerNote": "Poznámka zákazníka",
    "internalNote": "Interní poznámka",
    "internalNoteHint": "Vidí ji jen váš tým.",
    "saveNote": "Uložit poznámku",
    "noteSaved": "Poznámka uložena",
    "history": "Historie",
    "historyBy": "{{label}} ({{by}})",
    "actionsLabel": "Akce objednávky"
  },
  "historyTypes": {
    "placed": "Objednávka vytvořena",
    "paid": "Označeno jako zaplacené",
    "shipped": "Označeno jako odeslané",
    "delivered-digital": "Doručeno odkazy ke stažení",
    "cancelled": "Zrušeno",
    "email-sent": "E-mail odeslán",
    "email-failed": "E-mail neodeslán",
    "resent": "E-mail odeslán znovu"
  },
  "automatically": "automaticky",
  "actions": {
    "markPaid": "Označit jako zaplacené",
    "markPaidTitle": "Označit objednávku {{number}} jako zaplacenou?",
    "markPaidText": "Zákazník dostane potvrzení platby a u digitálních položek odkazy ke stažení.",
    "paidDone": "Objednávka označena jako zaplacená",
    "ship": "Označit jako odeslané",
    "shipTitle": "Označit objednávku {{number}} jako odeslanou",
    "shipText": "Zákazník dostane e-mail s údaji pro sledování zásilky.",
    "trackingNumber": "Číslo zásilky",
    "trackingUrl": "Odkaz na sledování",
    "trackingUrlInvalid": "Zadejte odkaz začínající http nebo https",
    "shippedDone": "Objednávka označena jako odeslaná",
    "cancel": "Zrušit objednávku",
    "cancelTitle": "Zrušit objednávku {{number}}?",
    "cancelText": "Zboží se vrátí na sklad, odkazy ke stažení přestanou fungovat a zákazník dostane e-mail.",
    "refunded": "Označit platbu jako vrácenou",
    "keep": "Ponechat objednávku",
    "cancelledDone": "Objednávka zrušena",
    "resendConfirmation": "Znovu poslat potvrzení",
    "resendDownloads": "Znovu poslat odkazy ke stažení",
    "resentDone": "E-mail je na cestě. Pokud se nepodaří odeslat, uvidíte to v historii."
  }
```

- [ ] **Step 5: Implement the page and its parts**

Create `features/commerce/components/order/OrderLines.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import type { Order } from '../../orders-api'
import { formatMoney } from '../../money'

export function OrderLines({ order, currency }: { order: Order; currency: { code: string; decimals: number } }) {
  const { t, i18n } = useTranslation('orders')
  const money = (minor: number) => formatMoney(minor, currency, i18n.language)
  const percent = (rate: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(rate / 100)
  const row = 'flex items-baseline justify-between gap-4'

  return (
    <section aria-labelledby="order-items" className="min-w-0 space-y-3">
      <h2 id="order-items" className="font-serif text-xl font-semibold">{t('order.items')}</h2>
      <ul aria-label={t('order.linesLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
        {order.lines.map((line, i) => (
          <li key={i} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 py-3">
            <div className="min-w-0">
              <p className="font-medium">
                {line.name}
                {line.type === 'DIGITAL' && <Badge variant="secondary" className="ml-2 align-middle">{t('order.digital')}</Badge>}
              </p>
              {line.optionLabels.map((o) => (
                <p key={o.option} className="text-sm text-muted-foreground">{t('order.option', { option: o.option, value: o.value })}</p>
              ))}
              <p className="font-mono text-xs text-muted-foreground">{t('order.sku', { sku: line.sku })}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">{t('order.quantityPrice', { quantity: line.quantity, price: money(line.unitPrice) })}</p>
              <p className="font-medium">{money(line.lineTotal)}</p>
            </div>
          </li>
        ))}
      </ul>
      <dl className="space-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
        <div className={row}>
          <dt>{t('order.itemsTotal')}</dt>
          <dd>{money(order.totals.items)}</dd>
        </div>
        {order.shipping && (
          <div className={row}>
            <dt>{t('order.shippingTotal', { name: order.shipping.name })}</dt>
            <dd>{money(order.totals.shipping)}</dd>
          </div>
        )}
        {order.totals.paymentFee > 0 && (
          <div className={row}>
            <dt>{t('order.paymentFee')}</dt>
            <dd>{money(order.totals.paymentFee)}</dd>
          </div>
        )}
        <div className={`${row} border-t pt-2 text-base font-semibold`}>
          <dt>{t('order.total')}</dt>
          <dd>{money(order.totals.total)}</dd>
        </div>
        {order.totals.vat.map((v) => (
          <p key={v.rate} className="text-xs text-muted-foreground">
            {t('order.vatLine', { rate: percent(v.rate), amount: money(v.amount), base: money(v.base) })}
          </p>
        ))}
      </dl>
    </section>
  )
}
```

Create `features/commerce/components/order/OrderDetails.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { Address, Order } from '../../orders-api'
import { formatMoney } from '../../money'
import { countryName } from '../../countries'

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
      <h2 id={id} className="mb-1 font-serif text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function AddressLines({ address }: { address: Address }) {
  const { t, i18n } = useTranslation('orders')
  return (
    <>
      <p>{address.name}</p>
      {address.company && <p>{address.company}</p>}
      <p>{address.street}</p>
      <p>{address.postalCode} {address.city}</p>
      <p>{countryName(address.country, i18n.language)}</p>
      {address.vatId && <p className="text-muted-foreground">{t('order.vatId', { id: address.vatId })}</p>}
    </>
  )
}

export function OrderDetails({ order, currency }: { order: Order; currency: { code: string; decimals: number } }) {
  const { t, i18n } = useTranslation('orders')
  const instructions = order.instructions
  return (
    <div className="space-y-4">
      <Block id="order-customer" title={t('order.customer')}>
        <p>{order.customer.name}</p>
        <p>
          <a href={`mailto:${order.customer.email}`} className="underline-offset-2 hover:underline">{order.customer.email}</a>
        </p>
        {order.customer.phone && <p>{order.customer.phone}</p>}
      </Block>
      <Block id="order-billing" title={t('order.billing')}>
        <AddressLines address={order.billingAddress} />
      </Block>
      {order.shippingAddress && (
        <Block id="order-shipping" title={t('order.shipping')}>
          <AddressLines address={order.shippingAddress} />
        </Block>
      )}
      <Block id="order-payment" title={t('order.payment')}>
        <p>{t(`method.${order.payment.method}`)}</p>
        {order.payment.method === 'BANK_TRANSFER' && <p>{t('order.reference', { reference: order.payment.reference })}</p>}
        {instructions && (
          <div className="mt-2 space-y-0.5 rounded-lg bg-muted px-3 py-2">
            <p className="font-medium">{t('order.instructions')}</p>
            <p>{t('order.holder', { holder: instructions.holder })}</p>
            {instructions.accountNumber && <p>{t('order.accountNumber', { number: instructions.accountNumber })}</p>}
            {instructions.iban && <p className="break-all">{t('order.iban', { iban: instructions.iban })}</p>}
            {instructions.bic && <p>{t('order.bic', { bic: instructions.bic })}</p>}
            <p>{t('order.amount', { amount: formatMoney(instructions.amount, currency, i18n.language) })}</p>
          </div>
        )}
      </Block>
      {order.tracking && (order.tracking.number || order.tracking.url) && (
        <Block id="order-tracking" title={t('order.tracking')}>
          {order.tracking.number && <p>{t('order.trackingNumber', { number: order.tracking.number })}</p>}
          {order.tracking.url && (
            <p>
              <a href={order.tracking.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{t('order.trackingLink')}</a>
            </p>
          )}
        </Block>
      )}
      {order.note && (
        <Block id="order-note" title={t('order.customerNote')}>
          <p className="whitespace-pre-wrap">{order.note}</p>
        </Block>
      )}
    </div>
  )
}
```

Create `features/commerce/components/order/OrderHistory.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { formatAbsolute } from '@/lib/format'
import type { OrderHistoryEntry } from '../../orders-api'

const KNOWN = ['placed', 'paid', 'shipped', 'delivered-digital', 'cancelled', 'email-sent', 'email-failed', 'resent'] as const
type Known = (typeof KNOWN)[number]

export function OrderHistory({ history }: { history: OrderHistoryEntry[] }) {
  const { t } = useTranslation('orders')
  const label = (entry: OrderHistoryEntry) => {
    const text = (KNOWN as readonly string[]).includes(entry.type) ? t(`historyTypes.${entry.type as Known}`) : entry.type
    return entry.by === 'system' ? t('order.historyBy', { label: text, by: t('automatically') }) : text
  }
  return (
    <section aria-labelledby="order-history" className="min-w-0 space-y-3">
      <h2 id="order-history" className="font-serif text-xl font-semibold">{t('order.history')}</h2>
      <ol className="flex flex-col divide-y rounded-xl border bg-card">
        {[...history].reverse().map((entry, i) => (
          <li key={i} className="px-4 py-2.5 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{label(entry)}</span>
              <span className="text-xs text-muted-foreground">{formatAbsolute(entry.at)}</span>
            </div>
            {entry.detail && <p className="break-words text-muted-foreground">{entry.detail}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
```

Create `features/commerce/components/order/InternalNote.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api-error'
import type { Order } from '../../orders-api'
import { useOrderWrites } from '../../orders-queries'

export function InternalNote({ order }: { order: Order }) {
  const { t } = useTranslation('orders')
  const writes = useOrderWrites()
  const [note, setNote] = useState(order.internalNote ?? '')
  const [saving, setSaving] = useState(false)
  const unchanged = note === (order.internalNote ?? '')

  const save = async () => {
    setSaving(true)
    try {
      await writes.saveNote(order.id, note)
      toast.success(t('order.noteSaved'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-2 rounded-xl border bg-card px-4 py-3">
      <Label htmlFor="internal-note" className="font-serif text-lg font-semibold">{t('order.internalNote')}</Label>
      <p id="internal-note-hint" className="text-xs text-muted-foreground">{t('order.internalNoteHint')}</p>
      <Textarea id="internal-note" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} aria-describedby="internal-note-hint" />
      <Button variant="outline" size="sm" onClick={() => void save()} disabled={saving || unchanged}>{t('order.saveNote')}</Button>
    </section>
  )
}
```

Create `features/commerce/components/order/OrderActions.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { apiErrorMessage } from '@/lib/api-error'
import type { Order } from '../../orders-api'
import { useOrderWrites } from '../../orders-queries'
import { availableActions } from '../../order-rules'
import { TextField } from '../TextField'

type DialogKind = 'paid' | 'ship' | 'cancel' | null

export function OrderActions({ order }: { order: Order }) {
  const { t } = useTranslation('orders')
  const writes = useOrderWrites()
  const can = availableActions(order)
  const [dialog, setDialog] = useState<DialogKind>(null)
  const [pending, setPending] = useState(false)

  const run = async (action: () => Promise<unknown>, done: string) => {
    setPending(true)
    try {
      await action()
      toast.success(done)
    } catch (error) {
      // Someone else may have changed the order: show why and load its real state.
      toast.error(apiErrorMessage(error))
      await writes.refresh(order.id)
    } finally {
      setPending(false)
      setDialog(null)
    }
  }

  return (
    <>
      <div role="group" aria-label={t('order.actionsLabel')} className="flex flex-wrap gap-2">
        {can.markPaid && <Button onClick={() => setDialog('paid')} disabled={pending}>{t('actions.markPaid')}</Button>}
        {can.ship && <Button onClick={() => setDialog('ship')} disabled={pending}>{t('actions.ship')}</Button>}
        {can.cancel && (
          <Button variant="outline" className="text-destructive" onClick={() => setDialog('cancel')} disabled={pending}>{t('actions.cancel')}</Button>
        )}
        {can.resendConfirmation && (
          <Button variant="outline" onClick={() => void run(() => writes.resend(order.id, 'confirmation'), t('actions.resentDone'))} disabled={pending}>
            {t('actions.resendConfirmation')}
          </Button>
        )}
        {can.resendDownloads && (
          <Button variant="outline" onClick={() => void run(() => writes.resend(order.id, 'downloads'), t('actions.resentDone'))} disabled={pending}>
            {t('actions.resendDownloads')}
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={dialog === 'paid'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('actions.markPaidTitle', { number: order.number })}
        description={t('actions.markPaidText')}
        confirmLabel={t('actions.markPaid')}
        pending={pending}
        onConfirm={() => void run(() => writes.markPaid(order.id), t('actions.paidDone'))}
      />
      <Dialog open={dialog === 'ship'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <ShipForm
            number={order.number}
            pending={pending}
            onSubmit={(tracking) => void run(() => writes.markShipped(order.id, tracking), t('actions.shippedDone'))}
          />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === 'cancel'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent>
          <CancelForm
            number={order.number}
            paid={order.paymentStatus === 'PAID'}
            pending={pending}
            onKeep={() => setDialog(null)}
            onSubmit={(refunded) => void run(() => writes.cancel(order.id, refunded), t('actions.cancelledDone'))}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function isHttpUrl(text: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(text).protocol)
  } catch {
    return false
  }
}

function ShipForm({ number, pending, onSubmit }: { number: string; pending: boolean; onSubmit: (tracking: { trackingNumber?: string; trackingUrl?: string }) => void }) {
  const { t } = useTranslation('orders')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [urlError, setUrlError] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const url = trackingUrl.trim()
    if (url && !isHttpUrl(url)) return setUrlError(true)
    setUrlError(false)
    onSubmit({ ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}), ...(url ? { trackingUrl: url } : {}) })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('actions.shipTitle', { number })}</DialogTitle>
        <DialogDescription>{t('actions.shipText')}</DialogDescription>
      </DialogHeader>
      <TextField id="tracking-number" label={t('actions.trackingNumber')} value={trackingNumber} onChange={setTrackingNumber} />
      <TextField id="tracking-url" type="url" label={t('actions.trackingUrl')} value={trackingUrl} onChange={setTrackingUrl} error={urlError ? t('actions.trackingUrlInvalid') : undefined} />
      <DialogFooter>
        <Button type="submit" disabled={pending}>{t('actions.ship')}</Button>
      </DialogFooter>
    </form>
  )
}

function CancelForm({ number, paid, pending, onKeep, onSubmit }: { number: string; paid: boolean; pending: boolean; onKeep: () => void; onSubmit: (refunded: boolean) => void }) {
  const { t } = useTranslation('orders')
  const [refunded, setRefunded] = useState(false)
  return (
    <div className="space-y-4">
      <DialogHeader>
        <DialogTitle className="font-serif text-xl">{t('actions.cancelTitle', { number })}</DialogTitle>
        <DialogDescription>{t('actions.cancelText')}</DialogDescription>
      </DialogHeader>
      {paid && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-primary" checked={refunded} onChange={(e) => setRefunded(e.target.checked)} />
          {t('actions.refunded')}
        </label>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onKeep}>{t('actions.keep')}</Button>
        <Button variant="destructive" disabled={pending} onClick={() => onSubmit(paid && refunded)}>{t('actions.cancel')}</Button>
      </DialogFooter>
    </div>
  )
}
```

Create `features/commerce/pages/OrderPage.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAbsolute } from '@/lib/format'
import { useOrder } from '../orders-queries'
import { useShopSettings } from '../commerce-queries'
import { currencyFor } from '../money'
import { FulfilmentBadge, OrderStatusBadge, PaymentBadge } from '../components/OrderBadges'
import { OrderLines } from '../components/order/OrderLines'
import { OrderDetails } from '../components/order/OrderDetails'
import { OrderHistory } from '../components/order/OrderHistory'
import { OrderActions } from '../components/order/OrderActions'
import { InternalNote } from '../components/order/InternalNote'

export function OrderPage() {
  const { id } = useParams()
  const { t } = useTranslation('orders')
  const order = useOrder(id)
  const settings = useShopSettings()

  if (order.isError) return <ErrorState message={t('order.loadError')} onRetry={() => void order.refetch()} />
  if (order.isPending) return <Skeleton className="h-64 w-full" />

  const o = order.data
  const currency = currencyFor(o.currency, settings.data?.currencies ?? [])
  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/commerce/orders" className="text-sm text-muted-foreground hover:underline">{t('order.back')}</Link>}
        title={t('order.title', { number: o.number })}
        description={t('order.placedAt', { date: formatAbsolute(o.createdAt) })}
        actions={<OrderActions order={o} />}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <OrderStatusBadge status={o.status} />
        <PaymentBadge status={o.paymentStatus} />
        <FulfilmentBadge status={o.fulfilmentStatus} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <OrderLines order={o} currency={currency} />
          <OrderHistory history={o.history} />
        </div>
        <div className="min-w-0 space-y-4">
          <OrderDetails order={o} currency={currency} />
          {/* Keyed by the stored note so a reload after an action shows the saved text. */}
          <InternalNote key={o.internalNote ?? ''} order={o} />
        </div>
      </div>
    </>
  )
}
```

In `modules/registry.tsx`, import `OrderPage` and add its route to the `orders` module:

```tsx
    routes: [
      { path: 'commerce/orders', element: <OrdersListPage /> },
      { path: 'commerce/orders/:id', element: <OrderPage /> },
    ],
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter admin-dashboard exec vitest run src/features/commerce src/i18n src/modules`
Expected: PASS.

- [ ] **Step 7: Full checks and commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add packages/admin-dashboard/src
git commit -m "feat(admin): order page with payment, shipping, cancel, resend and internal note"
```

---

### Task 7: Browser verification

**Files:**
- Modify: `TEST_RESULTS.md`

- [ ] **Step 1: Start the stack on a throwaway database**

Copy the local database to `thecms_orderui` (the same copy approach as earlier verifications; never touch `thecms`). Start Azurite, the worktree backend on port 3100 (`MONGODB_URI=mongodb://127.0.0.1:27017/thecms_orderui`, `PUBLIC_API_URL=http://localhost:3100/api/v1`, Brevo unset) and the worktree admin on port 5175 pointed at it (`VITE_API_URL=http://localhost:3100/api/v1`).
Expected: both answer; the admin login works with the local user.

- [ ] **Step 2: Set up the shop in the admin, in English**

1. Shop settings: CZK default, Standard 21 %, Reduced 12 %; checkout: CZK account with IBAN `CZ65 0800 0000 1920 0014 5399` typed with spaces, holder "Test Shop", terms link, shop email; save. Reload: the IBAN shows without spaces.
2. Shipping: add zone "Czechia" (CZ) and "Everywhere else"; try `CZ` in a second zone and read the server's 409 message.
3. New method "Courier": bank transfer and cash on delivery, fee 39, rates for Czechia with bands 2000 g → 129 and open → 199, free from 2000; save. New method "Abroad" for everywhere else, 499.
4. Delete "Czechia": the reason "A shipping method uses this zone" shows.
5. Products: a tee with sizes (stock 3) and a digital guide with a file, both active and published (catalogue screens from Plan 2).
Expected: every step as described; nothing scrolls sideways at 360px (check Shipping, the method editor and Shop settings in a 360px window).

- [ ] **Step 3: Place orders through the public API**

Create a site key in Sites, then with curl: one CZ order with the tee and the guide (bank transfer), and one with the tee only (cash on delivery).
Expected: both return 201 with their numbers.

- [ ] **Step 4: Work the orders in the admin**

1. Orders: both orders listed; the navigation badge shows 1 (the cash on delivery order).
2. Open the bank transfer order: lines, totals with VAT 21 % and 12 %, addresses, the transfer details, history with "Email not sent".
3. Mark as paid: badge goes to 2; history shows "Marked as paid"; Resend download links appears.
4. Mark as shipped with a tracking number and link: order shows Completed.
5. Cancel the cash on delivery order: stock of the tee goes back (check the product's variants).
6. "Needs action" filter shows only matching orders.
7. Switch the admin to Czech and repeat a read-through of both pages.
Expected: as described, no console errors.

- [ ] **Step 5: QR code**

Render the SPD string from the order placement response to a PNG (`node -e "require('qrcode').toFile('qr.png', '<SPD>')"` in `packages/backend`) and ask your human partner to scan it with a Czech banking app. Record exactly what they report; if no scan happens, write "not scanned".

- [ ] **Step 6: Record and clean up**

Append "E-shop orders Plan 2 verification" to `TEST_RESULTS.md` with a table of the checks above and their results (failures described as found), stop the servers, drop `thecms_orderui`, and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record e-shop orders Plan 2 verification"
```

---

## Self-Review Notes

- **Spec coverage:** section 9 Orders list (number, date, customer, total, payment, shipping and order status; search; filters; badge) → Tasks 1 and 5; Order page (lines, totals, customer, addresses, payment instructions, tracking, history, internal note; Mark as paid, Mark as shipped with tracking, Cancel with refunded, Resend confirmation, Resend downloads) → Task 6; Shipping (zones; methods with labels per language, zones with bands and prices per currency, free threshold, payment methods, cash on delivery fee, active) → Tasks 3 and 4; Shop settings additions → Task 2; English and Czech, prices in the admin language → every task; section 10 webhooks in the admin event picker → Task 1; section 12 admin tests (Shipping editor, settings, Orders list and filters, order actions, Czech, axe) → Tasks 2 to 6; browser and QR scan → Task 7.
- **Type consistency:** `PaymentMethod`, `PAYMENT_METHODS`, `Order`, `OrderListItem`, `ShippingZone`, `ShippingMethod`, `MethodInput`, `useOrderWrites` (`markPaid`, `markShipped`, `cancel`, `resend`, `saveNote`, `refresh`), `useShippingWrites` (`saveZone`, `removeZone`, `saveMethod`, `removeMethod`), `TextField`, `currencyFor`, `countryName`, `availableActions` are used with the same names in every task.
- **Review Focus:** every line has its test in the owning task (Task 4 Czech money, Task 2 independent saves and IBAN, Task 6 409 reload, Task 3 zone in use).
