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
const entry = { id: 'e1', itemId: 'e1', language: 'en', contentTypeId: { id: 'pt' }, data: { name: 'Bike T-shirt' }, title: 'Bike T-shirt', status: 'DRAFT', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z' }
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
