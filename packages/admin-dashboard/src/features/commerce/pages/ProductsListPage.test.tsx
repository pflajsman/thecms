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
