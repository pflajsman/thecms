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
  vi.mocked(apiClient.put).mockImplementation(async (url: string, body?: unknown) =>
    url.endsWith('/variants') ? { data: { success: true, data: (body as { variants: unknown[] }).variants } } : { data: { success: true, data: detail } },
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

it('derives keys for new options and values from their labels when applied', async () => {
  const simple = { ...detail, product: { ...detail.product, options: [] }, variants: [{ ...variant('v1', 's', 'TEE'), optionValues: {} }] }
  renderRoutes(routes(simple), { route: '/commerce/products/p1' })
  const options = await screen.findByRole('region', { name: 'Options' })
  await userEvent.click(within(options).getByRole('button', { name: 'Add option' }))
  const name = within(options).getByRole('textbox', { name: 'Option name (English)' })
  await userEvent.clear(name)
  await userEvent.type(name, 'Colour')
  const value = within(options).getAllByRole('textbox', { name: 'Value (English)' })[0]
  await userEvent.clear(value)
  await userEvent.type(value, 'Dark red')
  await userEvent.click(within(options).getByRole('button', { name: 'Apply options' }))
  await waitFor(() =>
    expect(apiClient.put).toHaveBeenCalledWith('/commerce/products/p1', {
      options: [{ key: 'colour', labels: { en: 'Colour' }, values: [{ key: 'dark-red', labels: { en: 'Dark red' } }] }],
    }),
  )
})

it('asks to save variant edits before applying options', async () => {
  renderRoutes(routes(), { route: '/commerce/products/p1' })
  const czkS = await screen.findByRole('textbox', { name: 'CZK price, S' })
  await userEvent.type(czkS, '1')
  const options = screen.getByRole('region', { name: 'Options' })
  await userEvent.click(within(options).getByRole('button', { name: 'Remove value M' }))
  await userEvent.click(within(options).getByRole('button', { name: 'Apply options' }))
  expect(await within(options).findByText('Save the variants first')).toBeInTheDocument()
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(apiClient.put).not.toHaveBeenCalled()
})

it('marks only the row whose SKU the server names', async () => {
  vi.mocked(apiClient.put).mockRejectedValue(Object.assign(new Error('409'), { isAxiosError: true, response: { status: 409, data: { success: false, error: 'SKU TEE-M2 is already used' } } }))
  renderRoutes(routes(), { route: '/commerce/products/p1' })
  const s = await screen.findByRole('textbox', { name: 'SKU, S' })
  await userEvent.clear(s)
  await userEvent.type(s, 'TEE-M')
  const m = screen.getByRole('textbox', { name: 'SKU, M' })
  await userEvent.clear(m)
  await userEvent.type(m, 'TEE-M2')
  await userEvent.click(screen.getByRole('button', { name: 'Save variants' }))
  await screen.findByText('SKU TEE-M2 is already used')
  expect(screen.getByRole('textbox', { name: 'SKU, M' })).toHaveAttribute('aria-invalid', 'true')
  expect(screen.getByRole('textbox', { name: 'SKU, S' })).not.toHaveAttribute('aria-invalid')
})
