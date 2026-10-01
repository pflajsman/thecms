# E-shop Catalogue, Plan 2: Admin

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editors manage the catalogue in a new Commerce section of the admin: shop settings, a products list, a New product dialog, and a product page with a Content tab (the existing entry editor) and a Selling tab (VAT, Active, options, variants, digital file).

**Architecture:** A `commerce` feature folder holds the API client, queries, money helpers and pages. The navigation gets a third group, Commerce. The product page uses route-based tabs (`/commerce/products/:id` for Selling, `/commerce/products/:id/content/:versionId` for Content) so the existing unsaved-changes guard, which compares pathnames, protects both tabs and language switches. The entry editor gains an `embedded` mode so it can live inside the product page.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, react-i18next (typed keys, `en`/`cs`), shadcn/ui, Vitest + Testing Library + axe.

**Spec:** `docs/superpowers/specs/2026-10-01-eshop-catalog-design.md` (sections 5 and 8). Backend: `docs/superpowers/plans/2026-10-01-eshop-catalog-plan-1-backend.md` (merged).

## Global Constraints

- All new UI text comes from catalogs in English and Czech (`one`/`other` and `one`/`few`/`other` plurals); `pnpm --filter admin-dashboard lint` reports 0 problems; typed keys use `{ ns: 'x' }` for other namespaces.
- Prices are integer minor units on the wire; the admin shows and edits them with the currency's decimals and the admin language's number format.
- Every screen passes axe in English and Czech and works at 360px with no horizontal scroll.
- Server messages are shown as sent (`apiErrorMessage`); our own fallbacks follow the admin language.
- Backend contract (Plan 1): `GET/PUT /commerce/settings`; `GET/POST /commerce/products`; `GET/PUT/DELETE /commerce/products/:id`; `PUT /commerce/products/:id/variants` `{ variants }`; `POST /commerce/products/:id/file` (multipart `file`); product detail `{ product, variants, entry: { itemId, defaultVersionId, name }, removedVariantIds? }`; list items `{ id, itemId, type, active, name, published, variantsCount, priceRange, stock }`.
- Run `pnpm --filter admin-dashboard test`, `lint` and `build` at the end of every task.
- Never use an em dash in code, copy or docs.

## Decisions (for the reviewer)

1. **Tabs are routes**, not a tab widget, so the unsaved-changes guard and the browser back button work across tabs and across language versions inside the Content tab.
2. **The Selling tab saves in three parts**: General (VAT rate, Active), Options (applied with a preview of variants that will be removed; the server regenerates variants), Variants (the table). Options change which rows exist, so they are applied before the table is edited.
3. **The embedded entry editor hides Duplicate and Delete**: duplicating would create an entry without a product, and deleting the last version is refused by the server; products are deleted from the Selling tab.
4. **Removed-combination preview is computed in the admin** with the same rule as the backend (current options only; a new option takes its first value).

## Review Focus

1. **Typing a price like "490,5" in Czech or "490.5" in English**: stored as 49050 minor units; "abc" or "1.234" for a 2-decimal currency shows a field error and nothing is sent. Tested in Task 1 (helpers) and Task 5 (table).
2. **Unsaved variant edits, then clicking the Content tab or a language**: the leave dialog appears. Tested in Task 5.
3. **Applying options that remove combinations**: the dialog lists the SKUs that will go before anything is sent. Tested in Task 5.
4. **Shop without currencies or VAT rates**: Products shows a setup prompt linking to Settings and no New product button. Tested in Task 3.
5. **A duplicate SKU from the server (409)**: the message names the SKU and the row is marked; the table keeps the user's edits. Tested in Task 5.

---

## File Structure

All paths relative to `packages/admin-dashboard/src`.

| File | Responsibility |
|---|---|
| `features/commerce/commerce-api.ts` | Types and API calls |
| `features/commerce/commerce-queries.ts` | Query keys, hooks, write helpers |
| `features/commerce/money.ts` | `toMinor`, `fromMinor`, `formatMoney` |
| `features/commerce/variant-plan.ts` | `combinations`, `removedByOptions` (mirror of the backend rule) |
| `features/commerce/pages/ShopSettingsPage.tsx` | Currencies and VAT rates |
| `features/commerce/pages/ProductsListPage.tsx`, `components/NewProductDialog.tsx`, `components/ShopSetupPrompt.tsx` | List, create, setup prompt |
| `features/commerce/pages/ProductPage.tsx` | Header, route tabs, delete |
| `features/commerce/components/ProductContentTab.tsx` | Embedded entry editor |
| `features/commerce/components/SellingTab.tsx`, `OptionsEditor.tsx`, `VariantsTable.tsx`, `DigitalFileSection.tsx` | Selling tab |
| `i18n/locales/{en,cs}/commerce.json`, `i18n/resources.ts` | New namespace |
| `modules/types.ts`, `modules/nav.ts`, `modules/registry.tsx`, `app/shell/Sidebar.tsx`, `app/shell/TopBar.tsx` | Commerce group |
| `features/content/editor/EntryEditor.tsx`, `EditorTopBar.tsx` | `embedded` mode |
| `features/webhooks/webhook-events.ts`, `i18n/locales/{en,cs}/webhooks.json` | Commerce events |

---

## Task 1: Commerce group, API layer, money helpers

**Files:**
- Create: `features/commerce/commerce-api.ts`, `features/commerce/commerce-queries.ts`, `features/commerce/money.ts`, `features/commerce/money.test.ts`, `features/commerce/variant-plan.ts`, `features/commerce/variant-plan.test.ts`, `i18n/locales/{en,cs}/commerce.json`
- Modify: `modules/types.ts` (`ModuleGroup` gains `'commerce'`), `modules/nav.ts` (`groupModules` returns `commerce`), `app/shell/Sidebar.tsx` (third `NavGroup`), `app/shell/TopBar.tsx` (mobile menu lists commerce then setup modules), `modules/registry.tsx` (two modules with placeholder pages replaced in Tasks 2 and 3), `i18n/locales/{en,cs}/shell.json` (`groups.commerce`, `nav.products`, `nav.shopSettings`), `i18n/resources.ts`, `features/webhooks/webhook-events.ts`, `i18n/locales/{en,cs}/webhooks.json`
- Test: `modules/registry.test.tsx`, `modules/nav.test.ts`, `features/webhooks/webhook-events.test.ts` (add cases)

**Interfaces:**
- Produces:
  - Types: `ShopCurrency { code; decimals }`, `VatRate { id; name; rate }`, `ShopSettings { currencies; defaultCurrency?; vatRates }`, `ProductType = 'PHYSICAL' | 'DIGITAL'`, `Labels = Record<string,string>`, `ProductOption { key; labels; values: { key; labels }[] }`, `Product { id; itemId; type; vatRateId; active; options; digitalFile?: { originalName; mimeType; size } }`, `Variant { id; sku; optionValues; prices; weightGrams; stock: { tracked; quantity }; active }`, `ProductDetail { product; variants; entry: { itemId; defaultVersionId: string | null; name }; removedVariantIds? }`, `ProductListItem`, `VariantRow = Omit<Variant, 'id'> & { id?: string }`
  - API: `getShopSettings`, `saveShopSettings(body)`, `listProducts(params)`, `createProduct({ name, type })`, `getProduct(id)`, `updateProduct(id, { vatRateId?, active?, options? })`, `deleteProduct(id)`, `saveVariants(id, rows)`, `uploadProductFile(id, file)`
  - Queries: `commerceKeys`, `useShopSettings()`, `useProducts(params)`, `useProduct(id)`, `useCommerceWrites()` (each write updates `commerceKeys.product(id)` and refreshes `commerceKeys.lists()`)
  - `toMinor(text: string, decimals: number, language: string): number | null`, `fromMinor(minor: number, decimals: number, language: string): string`, `formatMoney(minor: number, currency: ShopCurrency, language: string): string`
  - `combinations(options)`, `removedByOptions(variants, options): Variant[]`
  - Modules: `products` (`/commerce/products`, group `commerce`), `shop-settings` (`/commerce/settings`, group `commerce`)

- [ ] **Step 1: Write the failing tests**

`features/commerce/money.test.ts`:

```ts
import { formatMoney, fromMinor, toMinor } from './money'

it('reads prices typed in English or Czech into minor units', () => {
  expect(toMinor('490', 2, 'en')).toBe(49000)
  expect(toMinor('490.5', 2, 'en')).toBe(49050)
  expect(toMinor('490,5', 2, 'cs')).toBe(49050)
  expect(toMinor('1 490,50', 2, 'cs')).toBe(149050)
  expect(toMinor('1,490.50', 2, 'en')).toBe(149050)
  expect(toMinor('15', 0, 'en')).toBe(15)
})

it('rejects text that is not a price for the currency', () => {
  for (const bad of ['abc', '', '-1', '1.234', '1.5.0']) expect(toMinor(bad, 2, 'en')).toBeNull()
  expect(toMinor('1.5', 0, 'en')).toBeNull()
})

it('shows minor units in the admin language', () => {
  expect(fromMinor(49050, 2, 'en')).toBe('490.50')
  expect(fromMinor(49050, 2, 'cs')).toBe('490,50')
  expect(formatMoney(149050, { code: 'CZK', decimals: 2 }, 'cs')).toMatch(/1\s490,50\sKč/)
  expect(formatMoney(2000, { code: 'EUR', decimals: 2 }, 'en')).toBe('€20.00')
})
```

`features/commerce/variant-plan.test.ts`:

```ts
import { combinations, removedByOptions } from './variant-plan'

const size = { key: 'size', labels: { en: 'Size' }, values: [{ key: 's', labels: { en: 'S' } }, { key: 'm', labels: { en: 'M' } }] }
const v = (id: string, optionValues: Record<string, string>) => ({ id, sku: id.toUpperCase(), optionValues, prices: {}, weightGrams: 0, stock: { tracked: false, quantity: 0 }, active: true })

it('lists every combination', () => {
  const color = { key: 'color', labels: { en: 'Colour' }, values: [{ key: 'red', labels: { en: 'Red' } }] }
  expect(combinations([size, color])).toEqual([{ size: 's', color: 'red' }, { size: 'm', color: 'red' }])
  expect(combinations([])).toEqual([{}])
})

it('finds variants an option change removes, like the server', () => {
  expect(removedByOptions([v('base', {})], [size]).map((x) => x.id)).toEqual([])
  const onlyS = [{ ...size, values: [size.values[0]] }]
  expect(removedByOptions([v('s', { size: 's' }), v('m', { size: 'm' })], onlyS).map((x) => x.id)).toEqual(['m'])
  expect(removedByOptions([v('s', { size: 's' }), v('s2', { size: 's' })], [size]).map((x) => x.id)).toEqual(['s2'])
})
```

Add to `modules/registry.test.tsx` (replace the IA test's expectations):

```ts
  it('matches the approved information architecture', () => {
    const { workspace, commerce, setup } = groupModules(modules)
    expect(workspace.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Home', 'Content', 'Media', 'Inbox'])
    expect(commerce.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Products', 'Shop settings'])
    expect(setup.map((m) => i18n.t(m.labelKey, { ns: 'shell' }))).toEqual(['Content models', 'Forms', 'Sites & API keys', 'Webhooks', 'Languages'])
  })
```

Add to `features/webhooks/webhook-events.test.ts`:

```ts
it('offers the commerce events', () => {
  const commerce = getEventGroups().find((g) => g.label === 'Commerce')
  expect(commerce?.events.map((e) => e.value)).toEqual(['product.updated', 'product.deleted', 'stock.changed'])
  expect(eventLabel('stock.changed')).toBe('Stock changed')
})
```

(Update `modules/nav.test.ts` so `groupModules` is expected to return `{ workspace, commerce, setup }`.)

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm --filter admin-dashboard test -- money variant-plan registry nav webhook-events`
Expected: FAIL: missing modules and groups.

- [ ] **Step 3: Implement**

`features/commerce/money.ts`:

```ts
/** Decimal and group separators of a language, from Intl (for example "," and " " in Czech). */
function separators(language: string): { decimal: string; group: string } {
  const parts = new Intl.NumberFormat(language).formatToParts(12345.6)
  return {
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
  }
}

/** Text typed in the admin language to integer minor units; null when it is not a valid price. */
export function toMinor(text: string, decimals: number, language: string): number | null {
  const { decimal, group } = separators(language)
  const cleaned = text.trim().replace(/\s/g, '').split(group.trim() || ' ').join('')
  const normalized = decimal === '.' ? cleaned : cleaned.replace(decimal, '.')
  const pattern = decimals > 0 ? new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`) : /^\d+$/
  if (!pattern.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  return Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0') || 0)
}

export function fromMinor(minor: number, decimals: number, language: string): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(minor / 10 ** decimals)
}

export function formatMoney(minor: number, currency: { code: string; decimals: number }, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(minor / 10 ** currency.decimals)
}
```

(Check `toMinor('1,490.50', 2, 'en')`: the English group separator is ",", which the split removes. Czech uses a narrow no-break space as group separator, removed by the `\s` replace.)

`features/commerce/variant-plan.ts`:

```ts
import type { ProductOption, Variant } from './commerce-api'

export function combinations(options: ProductOption[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.key]: v.key }))), [{}])
}

const same = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v)

/** Variants the server removes when these options are applied (backend products.service regenerate). */
export function removedByOptions<V extends Pick<Variant, 'id' | 'optionValues'>>(variants: V[], options: ProductOption[]): V[] {
  const wanted = combinations(options)
  const keys = options.map((o) => o.key)
  const project = (values: Record<string, string>) => ({
    ...Object.fromEntries(options.map((o) => [o.key, o.values[0]?.key])),
    ...Object.fromEntries(Object.entries(values ?? {}).filter(([k]) => keys.includes(k))),
  })
  const kept: Record<string, string>[] = []
  return variants.filter((v) => {
    const p = project(v.optionValues)
    const match = wanted.find((w) => same(w, p))
    if (match && !kept.some((k) => same(k, match))) {
      kept.push(match)
      return false
    }
    return true
  })
}
```

`commerce-api.ts` follows `features/webhooks/webhooks-api.ts` (types above, `apiClient` calls, `.data.data`). `uploadProductFile`:

```ts
export async function uploadProductFile(id: string, file: File): Promise<DigitalFile> {
  const form = new FormData()
  form.append('file', file)
  return (await apiClient.post<ApiResponse<DigitalFile>>(`/commerce/products/${id}/file`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data.data
}
```

`commerce-queries.ts` follows `webhooks-queries.ts`:

```ts
export const commerceKeys = {
  all: ['commerce'] as const,
  settings: () => [...commerceKeys.all, 'settings'] as const,
  lists: () => [...commerceKeys.all, 'list'] as const,
  list: (params: ProductListParams) => [...commerceKeys.lists(), params] as const,
  product: (id: string) => [...commerceKeys.all, 'product', id] as const,
}
```

`useCommerceWrites()` returns `saveSettings`, `create`, `update`, `remove`, `saveVariants`, `uploadFile`. `update`, `saveVariants` and `uploadFile` refresh `commerceKeys.product(id)` (set data from the response when it is a full detail, else invalidate) and invalidate `commerceKeys.lists()`; `create` and `remove` also invalidate `contentKeys.lists()` and `statsKeys.all` (they create and delete entries).

Navigation:
- `modules/types.ts`: `export type ModuleGroup = 'workspace' | 'commerce' | 'setup'`.
- `nav.ts` `groupModules` returns `{ workspace, commerce, setup }`.
- `Sidebar.tsx`: `<NavGroup label={t('groups.commerce')} modules={commerce} pathname={pathname} />` between workspace and setup.
- `TopBar.tsx`: `setupModules={[...commerce, ...setup]}` for the mobile menu.
- `registry.tsx`: after `inbox`, modules `products` (`labelKey: 'nav.products'`, icon `ShoppingBag`, path `/commerce/products`, routes `commerce/products` and `commerce/products/:id` and `commerce/products/:id/content/:versionId`) and `shop-settings` (`labelKey: 'nav.shopSettings'`, icon `Store`, path `/commerce/settings`). Until Tasks 2 to 4 replace them, route elements are `<p>` stubs rendered through a tiny `ComingSoon` component that uses a catalog key (the lint guard forbids literal text).
- `shell.json`: en `groups.commerce` "Commerce", `nav.products` "Products", `nav.shopSettings` "Shop settings"; cs "Obchod", "Produkty", "Nastavení obchodu".

Webhooks: add `{ key: 'commerce', events: ['product.updated', 'product.deleted', 'stock.changed'] }` to `GROUPS`; `webhooks.json` en `groups.commerce` "Commerce", `events.product_updated` "Product updated", `events.product_deleted` "Product deleted", `events.stock_changed` "Stock changed"; cs "Obchod", "Produkt upraven", "Produkt smazán", "Změna skladu".

`commerce.json` starts with the keys Tasks 2 to 5 add; create both files with `{}` plus `comingSoon` ("Coming soon" / "Připravujeme") here and register the namespace in `resources.ts`.

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): Commerce navigation, API layer and money helpers"
```

---

## Task 2: Shop settings page

**Files:**
- Create: `features/commerce/pages/ShopSettingsPage.tsx`, `features/commerce/pages/ShopSettingsPage.test.tsx`
- Modify: `modules/registry.tsx` (route element), `commerce.json` (`settings.*`)

**Interfaces:**
- Consumes: `useShopSettings`, `useCommerceWrites().saveSettings` (Task 1).
- Produces: route `/commerce/settings`.

- [ ] **Step 1: Write the failing test** `features/commerce/pages/ShopSettingsPage.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ShopSettingsPage } from './ShopSettingsPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const routes = [{ path: '/commerce/settings', element: <ShopSettingsPage /> }]
const saved = {
  currencies: [{ code: 'CZK', decimals: 2 }],
  defaultCurrency: 'CZK',
  vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }],
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: saved } })
  vi.mocked(apiClient.put).mockImplementation(async (_url: string, body: unknown) => ({ data: { success: true, data: body } }))
})

it('shows currencies and VAT rates and adds EUR and a reduced rate', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  const currencies = await screen.findByRole('list', { name: 'Currencies' })
  expect(within(currencies).getByText('CZK')).toBeInTheDocument()
  expect(within(currencies).getByText('Default')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('Currency code'), 'eur')
  await userEvent.click(screen.getByRole('button', { name: 'Add currency' }))
  await userEvent.type(screen.getByLabelText('VAT rate name'), 'Reduced')
  await userEvent.type(screen.getByLabelText('Rate (%)'), '12')
  await userEvent.click(screen.getByRole('button', { name: 'Add VAT rate' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith('/commerce/settings', {
      currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
      defaultCurrency: 'CZK',
      vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }, { id: 'reduced', name: 'Reduced', rate: 1200 }],
    }),
  )
  await expectNoA11yViolations(container)
})

it('shows the server reason when a currency in use cannot be removed', async () => {
  vi.mocked(apiClient.put).mockRejectedValue(Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'Currency CZK has prices; remove them from the variants first' } } }))
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.click(await screen.findByRole('button', { name: 'Remove CZK' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  expect(await screen.findByText(/Currency CZK has prices/)).toBeInTheDocument()
})

it('rejects a bad currency code and a rate over 100 %', async () => {
  renderRoutes(routes, { route: '/commerce/settings' })
  await userEvent.type(await screen.findByLabelText('Currency code'), 'EURO')
  await userEvent.click(screen.getByRole('button', { name: 'Add currency' }))
  expect(screen.getByText('Use a three-letter code such as EUR')).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('VAT rate name'), 'Wrong')
  await userEvent.type(screen.getByLabelText('Rate (%)'), '101')
  await userEvent.click(screen.getByRole('button', { name: 'Add VAT rate' }))
  expect(screen.getByText('Use a rate from 0 to 100')).toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/settings' })
  expect(await screen.findByRole('heading', { name: 'Nastavení obchodu' })).toBeInTheDocument()
  expect(await screen.findByText('Výchozí')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
```

(`apiErrorMessage` uses `isAxiosError`; check how other tests build a rejected axios error and reuse that helper if one exists.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter admin-dashboard test -- ShopSettingsPage`
Expected: FAIL: module missing.

- [ ] **Step 3: Implement** `ShopSettingsPage.tsx`

Behaviour:
- Loads settings into local draft state (`currencies`, `defaultCurrency`, `vatRates`).
- **Currencies** section: `<ul aria-label={t('settings.currencies')}>` rows with code (mono), decimals, "Default" badge or a "Make default" button, and a "Remove {{code}}" icon button (removing the default picks the next currency as default). Add row: inputs "Currency code" (uppercased, `^[A-Z]{3}$`, unique) and "Decimals" (select 0, 1, 2, 3; default 2), button "Add currency". The first currency becomes default.
- **VAT rates** section: rows with name and rate (`formatPercent(rate / 100)` in the admin language), Rename inline (input) and "Remove {{name}}". Add row: "VAT rate name" (1 to 50), "Rate (%)" (0 to 100, up to 2 decimals, parsed with the language's decimal separator; stored as basis points `Math.round(value * 100)`), "Add VAT rate". The id is a slug of the name (`toApiKey`-like: lowercase ASCII, hyphens), unique by suffix.
- "Save settings" sends the whole draft with `PUT`; success toast "Settings saved"; errors toast and show inline via `apiErrorMessage`.
- Unsaved guard (`useUnsavedGuard(dirty)` and `UnsavedChangesDialog` from the editor) while the draft differs from the loaded settings.

`commerce.json` keys (en / cs):

| Key | en | cs |
|---|---|---|
| `settings.title` | Shop settings | Nastavení obchodu |
| `settings.description` | Currencies your prices use and the VAT rates of your products. | Měny, ve kterých zadáváte ceny, a sazby DPH vašich produktů. |
| `settings.currencies` | Currencies | Měny |
| `settings.currencyCode` | Currency code | Kód měny |
| `settings.decimals` | Decimals | Desetinná místa |
| `settings.addCurrency` | Add currency | Přidat měnu |
| `settings.default` | Default | Výchozí |
| `settings.makeDefault` | Make default | Nastavit jako výchozí |
| `settings.removeCurrency` | Remove {{code}} | Odebrat {{code}} |
| `settings.codeInvalid` | Use a three-letter code such as EUR | Zadejte třípísmenný kód, například EUR |
| `settings.codeTaken` | This currency is already in the list | Tato měna už v seznamu je |
| `settings.vatRates` | VAT rates | Sazby DPH |
| `settings.vatName` | VAT rate name | Název sazby |
| `settings.vatRate` | Rate (%) | Sazba (%) |
| `settings.addVat` | Add VAT rate | Přidat sazbu |
| `settings.removeVat` | Remove {{name}} | Odebrat {{name}} |
| `settings.rateInvalid` | Use a rate from 0 to 100 | Zadejte sazbu od 0 do 100 |
| `settings.nameInvalid` | Enter a name of up to 50 characters | Zadejte název o délce nejvýše 50 znaků |
| `settings.save` | Save settings | Uložit nastavení |
| `settings.saved` | Settings saved | Nastavení uloženo |
| `settings.empty` | No currencies yet | Zatím žádné měny |
| `settings.emptyVat` | No VAT rates yet | Zatím žádné sazby |

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): shop settings page"
```

---

## Task 3: Products list and New product

**Files:**
- Create: `features/commerce/pages/ProductsListPage.tsx`, `features/commerce/components/NewProductDialog.tsx`, `features/commerce/components/ShopSetupPrompt.tsx`, `features/commerce/pages/ProductsListPage.test.tsx`
- Modify: `modules/registry.tsx`, `commerce.json` (`products.*`, `newProduct.*`, `setup.*`)

**Interfaces:**
- Consumes: `useProducts`, `useShopSettings`, `useCommerceWrites().create`, `formatMoney` (Task 1).
- Produces: route `/commerce/products`; list URL params `q`, `type`, `status`, `page`.

- [ ] **Step 1: Write the failing test** `features/commerce/pages/ProductsListPage.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ProductsListPage } from './ProductsListPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const settings = { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] }
const tee = { id: 'p1', itemId: 'i1', type: 'PHYSICAL', active: true, name: 'Bike T-shirt', published: true, variantsCount: 2, priceRange: { min: 49000, max: 52000 }, stock: 'low' }
const guide = { id: 'p2', itemId: 'i2', type: 'DIGITAL', active: false, name: 'Šumava guide', published: false, variantsCount: 1, priceRange: null, stock: null }
const routes = [
  { path: '/commerce/products', element: <ProductsListPage /> },
  { path: '/commerce/products/:id', element: <p>product page</p> },
  { path: '/commerce/settings', element: <p>settings page</p> },
]

function mockApi(s = settings) {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/settings') return { data: { success: true, data: s } }
    if (url === '/commerce/products') return { data: { success: true, data: [tee, guide], pagination: { page: 1, limit: 20, total: 2, totalPages: 1 } } }
    return { data: { success: true, data: [] } }
  })
}

beforeEach(() => mockApi())

it('lists products with type, variants, price range, stock and status', async () => {
  const { container } = renderRoutes(routes, { route: '/commerce/products' })
  const table = await screen.findByRole('table', { name: 'Products' })
  const teeRow = within(table).getByRole('link', { name: 'Bike T-shirt' }).closest('tr')!
  expect(teeRow).toHaveTextContent('Physical')
  expect(teeRow).toHaveTextContent('2')
  expect(teeRow).toHaveTextContent(/CZK\s?490\.00.*CZK\s?520\.00/)
  expect(teeRow).toHaveTextContent('Low stock')
  expect(teeRow).toHaveTextContent('Active')
  const guideRow = within(table).getByRole('link', { name: 'Šumava guide' }).closest('tr')!
  expect(guideRow).toHaveTextContent('Digital')
  expect(guideRow).toHaveTextContent('Not published')
  await expectNoA11yViolations(container)
})

it('filters by search, type and status through the API', async () => {
  renderRoutes(routes, { route: '/commerce/products?type=DIGITAL&status=inactive' })
  await screen.findByRole('table', { name: 'Products' })
  expect(apiClient.get).toHaveBeenCalledWith('/commerce/products', expect.objectContaining({ params: expect.objectContaining({ type: 'DIGITAL', status: 'inactive' }) }))
  await userEvent.type(screen.getByRole('searchbox', { name: 'Search products' }), 'TEE-1')
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/commerce/products', expect.objectContaining({ params: expect.objectContaining({ search: 'TEE-1' }) })))
})

it('creates a product from the dialog and opens it', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { product: { ...tee, id: 'p9' }, variants: [], entry: { itemId: 'i9', defaultVersionId: 'e9', name: 'Cap' } } } })
  const { router } = renderRoutes(routes, { route: '/commerce/products' })
  await userEvent.click(await screen.findByRole('button', { name: 'New product' }))
  const dialog = await screen.findByRole('dialog', { name: 'New product' })
  await userEvent.type(within(dialog).getByLabelText('Name'), 'Cap')
  await userEvent.click(within(dialog).getByRole('radio', { name: /Digital/ }))
  await userEvent.click(within(dialog).getByRole('button', { name: 'Create product' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/commerce/products/p9'))
  expect(apiClient.post).toHaveBeenCalledWith('/commerce/products', { name: 'Cap', type: 'DIGITAL' })
})

it('asks for currencies and VAT rates first', async () => {
  mockApi({ currencies: [], vatRates: [] } as never)
  renderRoutes(routes, { route: '/commerce/products' })
  expect(await screen.findByText('Set up your shop first')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Open shop settings' })).toHaveAttribute('href', '/commerce/settings')
  expect(screen.queryByRole('button', { name: 'New product' })).not.toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes, { route: '/commerce/products' })
  const table = await screen.findByRole('table', { name: 'Produkty' })
  expect(within(table).getByText('Fyzický')).toBeInTheDocument()
  expect(within(table).getByText('Dochází')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})
```

(The English currency format for CZK is "CZK 490.00" in Node's ICU; match it loosely as above.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter admin-dashboard test -- ProductsListPage`
Expected: FAIL: module missing.

- [ ] **Step 3: Implement**

- `ProductsListPage.tsx`: `PageHeader` (title "Products", description, action `NewProductButton` when settings are ready), filters row (search input with debounce like `ContentFilters`, Type select: Any type / Physical / Digital, Status select: Any status / Active / Inactive / Not published), `DataList` with caption "Products" and columns Name (link to `/commerce/products/:id`), Type, Variants, Price (range with `formatMoney` in the default currency; one price when min equals max; "–" when null), Stock (badge "Out of stock" or "Low stock"), Status (`Active`, `Inactive`, `Not published` pill), `Pager`. URL params via a small `useSearchParams` helper like `list-params.ts` (`q`, `type`, `status`, `page`). Empty state "No products yet" with the New product button; loading skeleton; error state.
- `ShopSetupPrompt.tsx`: `EmptyState` with title "Set up your shop first", text "Add a currency and a VAT rate before you create products.", action link "Open shop settings" to `/commerce/settings`. Shown when settings have no currency or no VAT rate.
- `NewProductDialog.tsx`: `Dialog` titled "New product" with "Name" (1 to 200) and a radio group "Type" (Physical: "Shipped to the customer", Digital: "A file the customer downloads"); "Create product" calls `writes.create`, then `navigate('/commerce/products/' + detail.product.id)`.

`commerce.json` keys (en / cs):

| Key | en | cs |
|---|---|---|
| `products.title` | Products | Produkty |
| `products.description` | What you sell, with prices, stock and variants. | Co prodáváte, s cenami, skladem a variantami. |
| `products.tableLabel` | Products | Produkty |
| `products.search` | Search products | Hledat produkty |
| `products.searchPlaceholder` | Search by name or SKU… | Hledat podle názvu nebo SKU… |
| `products.type` | Type | Typ |
| `products.anyType` | Any type | Jakýkoli typ |
| `products.status` | Status | Stav |
| `products.anyStatus` | Any status | Jakýkoli stav |
| `products.columns.name` / `variants` / `price` / `stock` | Name / Variants / Price / Stock | Název / Varianty / Cena / Sklad |
| `products.outOfStock` | Out of stock | Vyprodáno |
| `products.lowStock` | Low stock | Dochází |
| `products.active` | Active | Aktivní |
| `products.inactive` | Inactive | Neaktivní |
| `products.unpublished` | Not published | Nepublikováno |
| `products.emptyTitle` | No products yet | Zatím žádné produkty |
| `products.emptyText` | Create your first product to start selling. | Vytvořte první produkt a začněte prodávat. |
| `products.loadError` | Could not load products. | Produkty se nepodařilo načíst. |
| `types.PHYSICAL` / `types.DIGITAL` | Physical / Digital | Fyzický / Digitální |
| `types.PHYSICAL_hint` / `types.DIGITAL_hint` | Shipped to the customer / A file the customer downloads | Posílá se zákazníkovi / Soubor, který si zákazník stáhne |
| `newProduct.button` / `newProduct.title` | New product | Nový produkt |
| `newProduct.name` | Name | Název |
| `newProduct.create` | Create product | Vytvořit produkt |
| `newProduct.nameRequired` | Enter a name | Zadejte název |
| `setup.title` | Set up your shop first | Nejdřív nastavte obchod |
| `setup.text` | Add a currency and a VAT rate before you create products. | Než vytvoříte produkty, přidejte měnu a sazbu DPH. |
| `setup.action` | Open shop settings | Otevřít nastavení obchodu |

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): products list and New product"
```

---

## Task 4: Product page, Content tab and delete

**Files:**
- Create: `features/commerce/pages/ProductPage.tsx`, `features/commerce/components/ProductContentTab.tsx`, `features/commerce/pages/ProductPage.test.tsx`
- Modify: `features/content/editor/EntryEditor.tsx`, `features/content/editor/EditorTopBar.tsx`, `features/content/editor/editor-actions.ts` (if the menu is built there), `modules/registry.tsx`, `commerce.json` (`product.*`)

**Interfaces:**
- Consumes: `useProduct`, `useCommerceWrites().remove`, `useEntry`, `useContentType`, `entryTypeId` (content feature).
- Produces:
  - `EntryEditor` prop `embedded?: { backTo: string; backLabel: string; versionPath: (versionId: string) => string }`: the top bar's back link uses `backTo`/`backLabel`; the language menu, the Languages section links and Translate navigate to `versionPath(id)` instead of `/content/:id`; Duplicate and Delete are hidden (Decision 3).
  - Routes: `/commerce/products/:id` (Selling, Task 5 fills it), `/commerce/products/:id/content/:versionId` (Content).

- [ ] **Step 1: Write the failing test** `features/commerce/pages/ProductPage.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { ProductPage } from './ProductPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@/components/RichTextEditor', () => ({ RichTextEditor: () => <textarea aria-label="rich text" /> }))
vi.mock('@/features/content/editor/fields/MediaField', () => ({ MediaField: () => <div>media field</div> }))

const productType = {
  id: 'pt', name: 'Product', slug: 'product', system: 'product', titleField: 'name', createdAt: '', updatedAt: '',
  fields: [
    { name: 'name', label: 'Name', type: 'TEXT', required: true },
    { name: 'description', label: 'Description', type: 'RICH_TEXT', required: false },
  ],
}
const entry = { id: 'e1', itemId: 'e1', language: 'en', contentTypeId: { id: 'pt' }, data: { name: 'Bike T-shirt' }, title: 'Bike T-shirt', status: 'DRAFT', createdAt: '', updatedAt: '' }
const detail = {
  product: { id: 'p1', itemId: 'e1', type: 'PHYSICAL', vatRateId: 'standard', active: false, options: [] },
  variants: [{ id: 'v1', sku: 'BIKE-T-SHIRT', optionValues: {}, prices: {}, weightGrams: 0, stock: { tracked: true, quantity: 0 }, active: true }],
  entry: { itemId: 'e1', defaultVersionId: 'e1', name: 'Bike T-shirt' },
}
const routes = [
  { path: '/commerce/products/:id', element: <ProductPage /> },
  { path: '/commerce/products/:id/content/:versionId', element: <ProductPage /> },
  { path: '/commerce/products', element: <p>products list</p> },
]

beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/products/p1') return { data: { success: true, data: detail } }
    if (url === '/commerce/settings') return { data: { success: true, data: { currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK', vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }] } } }
    if (url === '/entries/e1') return { data: { success: true, data: entry } }
    if (url === '/content-types/pt') return { data: { success: true, data: productType } }
    if (url === '/languages') return { data: { success: true, data: [{ id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }] } }
    return { data: { success: true, data: [] } }
  })
})

it('shows the product name and switches between Selling and Content tabs by URL', async () => {
  const { router, container } = renderRoutes(routes, { route: '/commerce/products/p1' })
  expect(await screen.findByRole('heading', { name: 'Bike T-shirt' })).toBeInTheDocument()
  const tabs = screen.getByRole('navigation', { name: 'Product sections' })
  expect(within(tabs).getByRole('link', { name: 'Selling' })).toHaveAttribute('aria-current', 'page')
  await userEvent.click(within(tabs).getByRole('link', { name: 'Content' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/commerce/products/p1/content/e1'))
  expect(await screen.findByDisplayValue('Bike T-shirt')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('embeds the entry editor without Duplicate and Delete, with a back link to Products', async () => {
  renderRoutes(routes, { route: '/commerce/products/p1/content/e1' })
  await screen.findByDisplayValue('Bike T-shirt')
  expect(screen.getByRole('link', { name: /Products/ })).toHaveAttribute('href', '/commerce/products')
  const more = screen.queryByRole('button', { name: 'More actions' })
  if (more) {
    await userEvent.click(more)
    expect(screen.queryByRole('menuitem', { name: 'Duplicate' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument()
  }
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})

it('deletes the product after typing its name', async () => {
  vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true, data: null } })
  const { router } = renderRoutes(routes, { route: '/commerce/products/p1' })
  await userEvent.click(await screen.findByRole('button', { name: 'Delete product' }))
  const confirm = await screen.findByRole('alertdialog')
  const button = within(confirm).getByRole('button', { name: 'Delete' })
  expect(button).toBeDisabled()
  await userEvent.type(within(confirm).getByRole('textbox'), 'Bike T-shirt')
  await userEvent.click(button)
  await waitFor(() => expect(router.state.location.pathname).toBe('/commerce/products'))
  expect(apiClient.delete).toHaveBeenCalledWith('/commerce/products/p1')
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/commerce/products/p1' })
  const tabs = await screen.findByRole('navigation', { name: 'Části produktu' })
  expect(within(tabs).getByRole('link', { name: 'Prodej' })).toBeInTheDocument()
  expect(within(tabs).getByRole('link', { name: 'Obsah' })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter admin-dashboard test -- ProductPage`
Expected: FAIL: module missing.

- [ ] **Step 3: Implement**

`ProductPage.tsx`:

```tsx
export function ProductPage() {
  const { id = '', versionId } = useParams()
  const { t } = useTranslation('commerce')
  const product = useProduct(id)
  const writes = useCommerceWrites()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (product.isPending) return <Skeleton className="h-40 w-full" />
  if (product.isError) return <ErrorState message={t('product.loadError')} onRetry={() => void product.refetch()} />
  const { entry } = product.data
  const contentVersion = versionId ?? entry.defaultVersionId
  const name = entry.name || t('product.untitled')

  return (
    <>
      <PageHeader
        title={name}
        description={t(`types.${product.data.product.type}`)}
        actions={<Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>{t('product.delete')}</Button>}
      />
      <nav aria-label={t('product.sections')} className="mb-6 flex gap-1 border-b">
        <TabLink to={`/commerce/products/${id}`} active={!versionId}>{t('product.selling')}</TabLink>
        {contentVersion && <TabLink to={`/commerce/products/${id}/content/${contentVersion}`} active={!!versionId}>{t('product.content')}</TabLink>}
      </nav>
      {versionId ? <ProductContentTab productId={id} versionId={versionId} /> : <SellingTab detail={product.data} />}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('product.deleteTitle', { name })}
        description={t('product.deleteText')}
        confirmLabel={t('actions.delete', { ns: 'common' })}
        destructive
        confirmText={name}
        onConfirm={async () => {
          setConfirmDelete(false)
          try {
            await writes.remove(id)
            toast.success(t('product.deleted', { name }))
            navigate('/commerce/products', { state: { skipGuard: true } })
          } catch (error) {
            toast.error(apiErrorMessage(error))
          }
        }}
      />
    </>
  )
}

function TabLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={cn('-mb-px border-b-2 px-3 py-2 text-sm', active ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground hover:text-foreground')}>
      {children}
    </Link>
  )
}
```

(Until Task 5, `SellingTab` is a small component showing VAT rate and Active read-only; Task 5 replaces it.)

`ProductContentTab.tsx`: loads `useEntry(versionId)` and `useContentType(entryTypeId(entry))` like `EntryEditorPage`, then renders

```tsx
<EntryEditor
  key={versionId}
  contentType={type}
  entry={entry}
  embedded={{ backTo: '/commerce/products', backLabel: t('nav.products', { ns: 'shell' }), versionPath: (v) => `/commerce/products/${productId}/content/${v}` }}
/>
```

`EntryEditor` and `EditorTopBar`:
- `EditorTopBar` gets `backTo?: string` and `backLabel?: string` (default `/content` and `t('topBar.back')`).
- `EntryEditor` gets `embedded?` (interface above): pass `backTo/backLabel`; `openVersion` and `translate` navigate to `embedded?.versionPath(id) ?? '/content/' + id`; `LanguagesSection` links use the same path (give it a `pathFor` prop); filter `'duplicate'` and `'delete'` out of the actions menu and pass `onDelete={undefined}` with the side-panel Delete hidden when embedded.

`commerce.json` keys (en / cs): `product.sections` "Product sections" / "Části produktu", `product.selling` "Selling" / "Prodej", `product.content` "Content" / "Obsah", `product.delete` "Delete product" / "Smazat produkt", `product.deleteTitle` "Delete {{name}}?" / "Smazat {{name}}?", `product.deleteText` "This removes the product, its variants, its file and its text in every language." / "Smaže se produkt, jeho varianty, soubor i texty ve všech jazycích.", `product.deleted` "Deleted {{name}}" / "Produkt {{name}} je smazaný", `product.loadError` "Could not load the product." / "Produkt se nepodařilo načíst.", `product.untitled` "Untitled product" / "Produkt bez názvu".

- [ ] **Step 4: Run tests, lint and build; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass, including the existing entry editor tests (embedded is optional).

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): product page with Content tab and delete"
```

---

## Task 5: Selling tab

**Files:**
- Create: `features/commerce/components/SellingTab.tsx` (replace the Task 4 placeholder), `features/commerce/components/OptionsEditor.tsx`, `features/commerce/components/VariantsTable.tsx`, `features/commerce/components/DigitalFileSection.tsx`, `features/commerce/components/SellingTab.test.tsx`
- Modify: `commerce.json` (`selling.*`, `options.*`, `variants.*`, `file.*`)

**Interfaces:**
- Consumes: `ProductDetail`, `useShopSettings`, `useLanguages` (languages feature), `useCommerceWrites().update/saveVariants/uploadFile`, `toMinor`, `fromMinor`, `removedByOptions` (Task 1).
- Produces: `SellingTab({ detail })`.

- [ ] **Step 1: Write the failing test** `features/commerce/components/SellingTab.test.tsx`

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router-dom'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { SellingTab } from './SellingTab'
import type { ProductDetail } from '../commerce-api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

const settings = {
  currencies: [{ code: 'CZK', decimals: 2 }, { code: 'EUR', decimals: 2 }],
  defaultCurrency: 'CZK',
  vatRates: [{ id: 'standard', name: 'Standard', rate: 2100 }, { id: 'reduced', name: 'Reduced', rate: 1200 }],
}
const size = { key: 'size', labels: { en: 'Size', cs: 'Velikost' }, values: [{ key: 's', labels: { en: 'S' } }, { key: 'm', labels: { en: 'M' } }] }
const variant = (id: string, sizeKey: string, sku: string) => ({ id, sku, optionValues: { size: sizeKey }, prices: { CZK: 49000 }, weightGrams: 180, stock: { tracked: true, quantity: 3 }, active: true })
const detail: ProductDetail = {
  product: { id: 'p1', itemId: 'e1', type: 'PHYSICAL', vatRateId: 'standard', active: false, options: [size] },
  variants: [variant('v1', 's', 'TEE-S'), variant('v2', 'm', 'TEE-M')],
  entry: { itemId: 'e1', defaultVersionId: 'e1', name: 'Tee' },
}

function routes(d: ProductDetail = detail) {
  return [
    { path: '/commerce/products/:id', element: <><SellingTab detail={d} /><Link to="/elsewhere">elsewhere</Link></> },
    { path: '/elsewhere', element: <p>elsewhere page</p> },
  ]
}

beforeEach(() => {
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/commerce/settings') return { data: { success: true, data: settings } }
    if (url === '/languages') return { data: { success: true, data: [{ id: 'l1', code: 'en', name: 'English', isDefault: true, order: 0 }, { id: 'l2', code: 'cs', name: 'Čeština', isDefault: false, order: 1 }] } }
    return { data: { success: true, data: [] } }
  })
  vi.mocked(apiClient.put).mockImplementation(async (url: string, body: { variants?: unknown[] }) =>
    url.endsWith('/variants') ? { data: { success: true, data: body.variants } } : { data: { success: true, data: detail } },
  )
})

it('saves VAT rate and Active', async () => {
  const { container } = renderRoutes(routes(), { route: '/commerce/products/p1' })
  await userEvent.click(await screen.findByRole('combobox', { name: 'VAT rate' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Reduced (12 %)' }))
  await userEvent.click(screen.getByRole('switch', { name: 'Active' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save general' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/commerce/products/p1', { vatRateId: 'reduced', active: true }))
  await expectNoA11yViolations(container)
})

it('edits prices in the variants table, sets one for all and saves minor units', async () => {
  renderRoutes(routes(), { route: '/commerce/products/p1' })
  const table = await screen.findByRole('table', { name: 'Variants' })
  const eur = within(table).getAllByRole('textbox', { name: /EUR price/ })
  await userEvent.type(eur[0], '20')
  await userEvent.click(screen.getByRole('button', { name: 'Set EUR for all' }))
  const czkS = within(table).getByRole('textbox', { name: 'CZK price, S' })
  await userEvent.clear(czkS)
  await userEvent.type(czkS, '490.5')
  await userEvent.click(screen.getByRole('button', { name: 'Save variants' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/commerce/products/p1/variants', expect.anything()))
  const rows = vi.mocked(apiClient.put).mock.calls.find((c) => c[0].endsWith('/variants'))![1] as { variants: { sku: string; prices: Record<string, number> }[] }
  expect(rows.variants.map((v) => [v.sku, v.prices])).toEqual([
    ['TEE-S', { CZK: 49050, EUR: 2000 }],
    ['TEE-M', { CZK: 49000, EUR: 2000 }],
  ])
})

it('refuses a price that is not a number and sends nothing', async () => {
  renderRoutes(routes(), { route: '/commerce/products/p1' })
  const czkS = await screen.findByRole('textbox', { name: 'CZK price, S' })
  await userEvent.clear(czkS)
  await userEvent.type(czkS, 'abc')
  await userEvent.click(screen.getByRole('button', { name: 'Save variants' }))
  expect(await screen.findByText('Enter a price such as 490.00')).toBeInTheDocument()
  expect(apiClient.put).not.toHaveBeenCalledWith('/commerce/products/p1/variants', expect.anything())
})

it('marks the row and keeps edits when the server says a SKU is taken', async () => {
  vi.mocked(apiClient.put).mockRejectedValue(Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'SKU CAP-1 is already used' } } }))
  renderRoutes(routes(), { route: '/commerce/products/p1' })
  const sku = await screen.findByRole('textbox', { name: 'SKU, S' })
  await userEvent.clear(sku)
  await userEvent.type(sku, 'CAP-1')
  await userEvent.click(screen.getByRole('button', { name: 'Save variants' }))
  expect(await screen.findByText('SKU CAP-1 is already used')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'SKU, S' })).toHaveValue('CAP-1')
  expect(screen.getByRole('textbox', { name: 'SKU, S' })).toHaveAttribute('aria-invalid', 'true')
})

it('lists the variants an option change removes before applying it', async () => {
  renderRoutes(routes(), { route: '/commerce/products/p1' })
  const options = await screen.findByRole('region', { name: 'Options' })
  await userEvent.click(within(options).getByRole('button', { name: 'Remove value M' }))
  await userEvent.click(within(options).getByRole('button', { name: 'Apply options' }))
  const dialog = await screen.findByRole('alertdialog', { name: 'Remove variants?' })
  expect(dialog).toHaveTextContent('TEE-M')
  expect(apiClient.put).not.toHaveBeenCalled()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Apply options' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/commerce/products/p1', { options: [{ ...size, values: [size.values[0]] }] }))
})

it('guards unsaved variant edits when leaving', async () => {
  const { router } = renderRoutes(routes(), { route: '/commerce/products/p1' })
  const czkS = await screen.findByRole('textbox', { name: 'CZK price, S' })
  await userEvent.type(czkS, '1')
  await userEvent.click(screen.getByRole('link', { name: 'elsewhere' }))
  expect(await screen.findByRole('alertdialog', { name: 'Leave without saving?' })).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/commerce/products/p1')
})

it('uploads a file for a digital product and shows its name and size', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { originalName: 'sumava.gpx', mimeType: 'application/gpx+xml', size: 2048 } } })
  const digital = { ...detail, product: { ...detail.product, type: 'DIGITAL' as const, options: [] }, variants: [{ ...variant('v1', 's', 'GUIDE'), optionValues: {} }] }
  renderRoutes(routes(digital), { route: '/commerce/products/p1' })
  const input = await screen.findByLabelText('Upload file')
  await userEvent.upload(input, new File(['<gpx/>'], 'sumava.gpx', { type: 'application/gpx+xml' }))
  expect(await screen.findByText('sumava.gpx')).toBeInTheDocument()
  expect(screen.getByText('2 KB')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: /Weight/ })).not.toBeInTheDocument()
})

it('renders in Czech', async () => {
  await setTestLanguage('cs')
  const { container } = renderRoutes(routes(), { route: '/commerce/products/p1' })
  expect(await screen.findByRole('table', { name: 'Varianty' })).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Cena CZK, S' })).toHaveValue('490,00')
  await expectNoA11yViolations(container)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter admin-dashboard test -- SellingTab`
Expected: FAIL: the placeholder has no table.

- [ ] **Step 3: Implement**

`SellingTab.tsx` composes three sections and the file section, each a `<section aria-labelledby>` with a heading:
- **General**: type (read-only text), VAT rate select (labels `"{{name}} ({{rate}} %)"` with the rate formatted in the admin language), Active switch; "Save general" sends only changed fields with `writes.update`.
- **Options**: `OptionsEditor` (`role="region"`, `aria-label={t('options.title')}`).
- **Variants**: `VariantsTable`.
- **File** (digital only): `DigitalFileSection`.
- One unsaved guard for the tab: `useUnsavedGuard(generalDirty || optionsDirty || variantsDirty)` with `UnsavedChangesDialog`. Each section reports its dirty state up through a callback.

`OptionsEditor.tsx`:
- Props `{ productId, options, variants, languages, onDirty }`; local draft of options.
- Per option: label inputs for every content language (`aria-label` "Option name ({{language}})"), the key shown read-only for saved options and derived from the default-language label for new ones (`toApiKey` from `features/builder/api-key`), a values list with label inputs per language and "Remove value {{value}}" buttons, "Add value", "Remove option {{name}}". "Add option" (max 3, disabled after). 
- "Apply options": compute `removedByOptions(variants, draft)`; when non-empty, open `ConfirmDialog` titled "Remove variants?" listing the SKUs (`confirmLabel` "Apply options"); then `writes.update(productId, { options: draft })`; toast "Options applied".
- Validation before sending: every option and value has a default-language label, keys unique: inline errors.

`VariantsTable.tsx`:
- Props `{ productId, type, options, variants, currencies, language, onDirty }`.
- Local rows: `{ id, sku, optionValues, prices: Record<code, string> (formatted with fromMinor), weight: string, tracked, quantity: string, active }`.
- `<table aria-label={t('variants.title')}>` columns: Variant (option value labels joined by " / ", or the product name when there are no options), SKU, one price column per currency, Weight (g) (physical only), Stock (tracked checkbox and quantity, physical only), Active.
- Input accessible names: `"SKU, {{variant}}"`, `"{{currency}} price, {{variant}}"`, `"Weight, {{variant}}"`, `"Quantity, {{variant}}"` (cs: "Cena {{currency}}, {{variant}}" and so on).
- "Set {{currency}} for all" button under each price column header: copies the first non-empty value of that column to every row.
- "Save variants": parse every price with `toMinor(text, decimals, language)` (empty means no price in that currency), quantities and weight as integers; invalid cells get `aria-invalid` and the message "Enter a price such as 490.00" (formatted example with the language's decimal separator), nothing is sent. Otherwise `writes.saveVariants(productId, rows)`; toast "Variants saved"; on error show the server message above the table and mark rows whose SKU appears in the message.
- On narrow screens the table scrolls inside its own container (`overflow-x-auto` on a wrapper), so the page itself never scrolls sideways.

`DigitalFileSection.tsx`: shows the file name, MIME type and size (`formatBytes` from `features/media/media-utils` if it exists, else a small helper: B / KB / MB, rounded), and a visually hidden `<input type="file" aria-label="Upload file">` triggered by an "Upload file" / "Replace file" button; uploads with `writes.uploadFile`; shows progress text "Uploading…" while pending; errors via toast.

`commerce.json` keys (en / cs), all under `selling`, `options`, `variants`, `file`:

| Key | en | cs |
|---|---|---|
| `selling.general` | General | Obecné |
| `selling.type` | Type | Typ |
| `selling.vatRate` | VAT rate | Sazba DPH |
| `selling.vatOption` | {{name}} ({{rate}} %) | {{name}} ({{rate}} %) |
| `selling.active` | Active | Aktivní |
| `selling.activeHint` | Active products are for sale once their content is published. | Aktivní produkty jsou v prodeji, jakmile je jejich obsah publikovaný. |
| `selling.saveGeneral` | Save general | Uložit obecné |
| `selling.saved` | Saved | Uloženo |
| `options.title` | Options | Možnosti |
| `options.hint` | For example Size or Colour. Each combination becomes a variant. | Například velikost nebo barva. Každá kombinace je jedna varianta. |
| `options.name` | Option name ({{language}}) | Název možnosti ({{language}}) |
| `options.value` | Value ({{language}}) | Hodnota ({{language}}) |
| `options.addOption` | Add option | Přidat možnost |
| `options.addValue` | Add value | Přidat hodnotu |
| `options.removeOption` | Remove option {{name}} | Odebrat možnost {{name}} |
| `options.removeValue` | Remove value {{value}} | Odebrat hodnotu {{value}} |
| `options.apply` | Apply options | Použít možnosti |
| `options.applied` | Options applied | Možnosti použity |
| `options.removeTitle` | Remove variants? | Odebrat varianty? |
| `options.removeText` | These variants no longer match the options and will be deleted: | Tyto varianty už neodpovídají možnostem a budou smazány: |
| `options.labelRequired` | Enter a name in {{language}} | Zadejte název v jazyce {{language}} |
| `options.max` | Up to 3 options | Nejvýše 3 možnosti |
| `variants.title` | Variants | Varianty |
| `variants.variant` | Variant | Varianta |
| `variants.sku` | SKU | SKU |
| `variants.skuLabel` | SKU, {{variant}} | SKU, {{variant}} |
| `variants.price` | {{currency}} price | Cena {{currency}} |
| `variants.priceLabel` | {{currency}} price, {{variant}} | Cena {{currency}}, {{variant}} |
| `variants.setAll` | Set {{currency}} for all | Nastavit {{currency}} všem |
| `variants.weight` | Weight (g) | Hmotnost (g) |
| `variants.weightLabel` | Weight, {{variant}} | Hmotnost, {{variant}} |
| `variants.stock` | Stock | Sklad |
| `variants.tracked` | Track stock, {{variant}} | Sledovat sklad, {{variant}} |
| `variants.quantityLabel` | Quantity, {{variant}} | Množství, {{variant}} |
| `variants.activeLabel` | Active, {{variant}} | Aktivní, {{variant}} |
| `variants.save` | Save variants | Uložit varianty |
| `variants.saved` | Variants saved | Varianty uloženy |
| `variants.priceInvalid` | Enter a price such as {{example}} | Zadejte cenu, například {{example}} |
| `variants.numberInvalid` | Enter a whole number | Zadejte celé číslo |
| `file.title` | File | Soubor |
| `file.hint` | Customers get this file after paying. It is never public. | Zákazníci tento soubor dostanou po zaplacení. Nikdy není veřejný. |
| `file.upload` | Upload file | Nahrát soubor |
| `file.replace` | Replace file | Nahradit soubor |
| `file.uploading` | Uploading… | Nahrávám… |
| `file.none` | No file yet | Zatím žádný soubor |
| `file.uploaded` | File uploaded | Soubor nahrán |

(`variants.priceInvalid` gets `example` from `fromMinor(49000, 2, language)`, so the test's English text is "Enter a price such as 490.00".)

- [ ] **Step 4: Run tests, lint and build; check 360px; commit**

Run: `pnpm --filter admin-dashboard test && pnpm --filter admin-dashboard lint && pnpm --filter admin-dashboard build`
Expected: all pass.

```bash
git add -A packages/admin-dashboard
git commit -m "feat(admin): Selling tab with options, variants and digital file"
```

---

## Task 6: Browser verification

**Files:** none unless a defect is found (fix with a test).

- [ ] **Step 1: Local run on a throwaway copy of the local database** (as before: copy `thecms` to `thecms_shopadmin`, worktree backend on port 3100, worktree admin on 5175 with `VITE_API_URL=http://localhost:3100/api/v1`, dev token in `localStorage.auth_token`).

Check in English, then Czech:

1. Sidebar shows Commerce (Products, Shop settings); at 360px the mobile menu lists them.
2. Products shows the setup prompt; Shop settings: add CZK (default), EUR, Standard 21 %, Reduced 12 %; save.
3. New product "Bike T-shirt" (physical) opens the product page on Selling.
4. Options: add Size with S, M (English and Czech labels); apply. Variants table shows two rows; type prices (CZK for both, EUR for S), "Set CZK for all", stock 3 and 0; save.
5. Content tab: the entry editor shows the name; translate to Czech; the URL stays under `/commerce/products/...`; publish; Back goes to Products.
6. Unsaved price edit, then click Content: the leave dialog appears.
7. Remove value M and apply: the dialog lists the M variant's SKU; cancel.
8. A digital product: upload a small file; name and size shown.
9. Products list shows price range, stock "Low stock", status Active after toggling Active and saving.
10. Delete a product with its typed name.
11. Dark theme and 360px: no horizontal page scroll (the variants table scrolls inside its box).

- [ ] **Step 2: Record and commit**

Append "E-shop catalogue Plan 2 verification" to `TEST_RESULTS.md`, drop the throwaway database and commit:

```bash
git add TEST_RESULTS.md
git commit -m "docs: record e-shop catalogue Plan 2 verification"
```

---

## Self-Review Notes

- **Spec coverage (section 5):** 5.1 navigation → Task 1; 5.2 settings → Task 2; 5.3 list → Task 3; 5.4 New product → Task 3; 5.5 product page: Content tab → Task 4, Selling tab (type, VAT, Active, options with labels per language, variants table with Set for all, regeneration preview, digital file) → Task 5, delete → Task 4; en/cs, lint, number format → every task; section 8 admin and browser testing → Tasks 1 to 6. Webhook events in the admin → Task 1.
- **Type consistency:** `ShopSettings`, `Product`, `Variant`, `ProductDetail`, `ProductListItem`, `commerceKeys`, `useShopSettings`, `useProducts`, `useProduct`, `useCommerceWrites` (`saveSettings`, `create`, `update`, `remove`, `saveVariants`, `uploadFile`), `toMinor`, `fromMinor`, `formatMoney`, `combinations`, `removedByOptions`, `EntryEditor.embedded` are used with the same names in every task.
